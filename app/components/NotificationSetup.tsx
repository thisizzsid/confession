"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  getMessaging,
  getToken,
  onMessage,
  isSupported as isFCMSupported,
} from "firebase/messaging";
import { db, auth, getFirebaseApp } from "@/firebase";
import {
  addDoc,
  and,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import { X, Heart, MessageCircle, Repeat, UserPlus, AtSign, Palette, Megaphone } from "lucide-react";

export type InAppNotification = {
  id: string;
  type: "like" | "comment" | "reply" | "follow" | "mention" | "theme" | "campaign" | "system";
  fromUid?: string;
  fromName?: string;
  message?: string;
  postId?: string;
  chatId?: string;
  createdAt: Timestamp | { seconds: number; nanoseconds: number };
  read?: boolean;
  [k: string]: any;
};

type NotificationContextValue = {
  enabled: boolean;
  loading: boolean;
  requestPermission: () => Promise<boolean>;
  items: InAppNotification[];
  unreadCount: number;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  clearAll: () => Promise<void>;
  toast: InAppNotification | null;
  dismissToast: () => void;
  openDrawer: boolean;
  setOpenDrawer: (v: boolean) => void;
  followBack: (fromUid: string) => Promise<void>;
  following: Set<string>;
};

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

const NOTIFICATION_ICON = "/notification-icon.png";
const LOGO_512 = "/icon-512.png";

const typeToIcon = (t?: string) => {
  switch (t) {
    case "like":
      return <Heart className="w-4 h-4 text-pink-400" />;
    case "comment":
    case "reply":
      return <MessageCircle className="w-4 h-4 text-(--gold-primary)" />;
    case "follow":
      return <UserPlus className="w-4 h-4 text-blue-400" />;
    case "mention":
      return <AtSign className="w-4 h-4 text-violet-400" />;
    case "theme":
      return <Palette className="w-4 h-4 text-emerald-400" />;
    case "campaign":
    case "system":
      return <Megaphone className="w-4 h-4 text-white" />;
    default:
      return <Repeat className="w-4 h-4 text-zinc-400" />;
  }
};

const typeToLabel = (n: InAppNotification) => {
  if (n.message) return n.message;
  switch (n.type) {
    case "like":
      return "liked your post";
    case "comment":
      return "commented on your post";
    case "reply":
      return "replied to your comment";
    case "follow":
      return "followed you";
    case "mention":
      return "mentioned you";
    case "theme":
      return "updated their accent color";
    case "campaign":
    case "system":
      return "";
    default:
      return "";
  }
};

const toTs = (t?: any) => {
  if (!t) return Timestamp.now();
  if (t instanceof Timestamp) return t;
  if (typeof t.seconds === "number") return new Timestamp(t.seconds, t.nanoseconds || 0);
  return Timestamp.fromDate(new Date(t));
};

const formatTime = (t: any) => {
  try {
    const ms = toTs(t).toMillis();
    const diff = Math.max(0, Date.now() - ms);
    const s = Math.floor(diff / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    const d = Math.floor(h / 24);
    return `${d}d`;
  } catch {
    return "";
  }
};

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<InAppNotification[]>([]);
  const [toast, setToast] = useState<InAppNotification | null>(null);
  const [openDrawer, setOpenDrawer] = useState(false);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const appRef = useRef<any>(null);

  const dismissToast = useCallback(() => setToast(null), []);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pushToast = useCallback((n: InAppNotification) => {
    setToast(n);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 6000);
  }, []);

  const unreadCount = useMemo(() => items.filter((i) => !i.read).length, [items]);

  const currentUser = auth?.currentUser;
  const uid = currentUser?.uid;

  const upsertInAppItem = useCallback(
    (n: InAppNotification) => {
      setItems((prev) => {
        const exists = prev.some((p) => p.id === n.id);
        const next = exists ? prev.map((p) => (p.id === n.id ? { ...p, ...n } : p)) : [n, ...prev];
        return next.sort((a, b) => toTs(b.createdAt).toMillis() - toTs(a.createdAt).toMillis());
      });
    },
    [],
  );

  const showBrowserNotification = useCallback(
    (title: string, body: string, opts?: { tag?: string; imageUrl?: string; url?: string; silent?: boolean }) => {
      if (typeof window === "undefined") return;
      if (!("Notification" in window)) return;
      if (Notification.permission !== "granted") return;
      try {
        const tag = opts?.tag || "confession-" + Math.random().toString(36).slice(2, 8);
        const options: any = {
          body,
          icon: LOGO_512,
          badge: NOTIFICATION_ICON,
          tag,
          requireInteraction: !!opts?.url,
          silent: !!opts?.silent,
          data: { url: opts?.url || "/feed" },
        };
        if (opts?.imageUrl) (options as any).image = opts.imageUrl;
        const n = new Notification(title, options);
        const targetUrl = opts?.url || "/feed";
        n.onclick = (evt: any) => {
          evt.preventDefault();
          window.focus();
          window.location.href = targetUrl;
          try {
            n.close();
          } catch {}
        };
      } catch (e) {
        console.warn("Browser notification failed:", e);
      }
    },
    [],
  );

  const firestorePush = useCallback(
    async (toUid: string, n: Omit<InAppNotification, "id" | "createdAt"> & { createdAt?: any }) => {
      if (!db || !toUid) return;
      try {
        await addDoc(collection(db as Firestore, `users/${toUid}/notifications`), {
          ...n,
          createdAt: n.createdAt ?? Timestamp.now(),
          read: false,
        });
      } catch (e) {
        console.warn("Failed to write notification:", e);
      }
    },
    [],
  );

  const requestPermission = useCallback(async () => {
    if (typeof window === "undefined") return false;
    if (!("Notification" in window)) return false;
    try {
      const perm = await Notification.requestPermission();
      if (perm === "granted") {
        setEnabled(true);
        try {
          await attemptRegisterFCM();
        } catch {}
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [attemptRegisterFCM]);

  const attemptRegisterFCM = useCallback(async () => {
    if (typeof window === "undefined" || !uid || !db) return;
    const user = auth?.currentUser;
    if (!user) return;
    try {
      const supported = await isFCMSupported();
      if (!supported) return;

      if ("serviceWorker" in navigator) {
        try {
          const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
            scope: "/",
            updateViaCache: "none",
          });
          await navigator.serviceWorker.ready;
          if (reg.installing || reg.waiting) {
            // wait a tick for SW to activate so messaging can find it
            await new Promise((r) => setTimeout(r, 250));
          }
        } catch (swErr) {
          console.warn("SW registration skipped:", swErr);
        }
      }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_KEY || undefined;
      const app = getFirebaseApp();
      if (!app) return;
      const messaging = getMessaging(app);

      let token: string | null = null;
      try {
        token = await getToken(messaging, vapidKey ? { vapidKey } : undefined);
      } catch (e) {
        console.warn("FCM getToken failed (VAPID likely missing):", e);
      }

      if (token) {
        const userRef = doc(db as Firestore, "users", user.uid);
        await setDoc(
          userRef,
          {
            fcmTokens: arrayUnion(token),
            notificationsEnabled: true,
            lastTokenRefreshAt: Timestamp.now(),
          },
          { merge: true },
        );

        onMessage(messaging, (payload) => {
          const title = payload.notification?.title || "Confession";
          const body = payload.notification?.body || "";
          const tag = payload.data?.type || "fcm-" + Math.random().toString(36).slice(2, 8);
          const img = payload.notification?.image || undefined;
          const url = payload.data?.click_action || payload.data?.url || "/feed";

          showBrowserNotification(title, body, { tag, imageUrl: img, url });

          const synthetic: InAppNotification = {
            id: "fcm-" + tag + "-" + Date.now(),
            type: (payload.data?.type as any) || "campaign",
            fromName: title,
            message: body,
            createdAt: Timestamp.now(),
            read: false,
          };
          pushToast(synthetic);
          upsertInAppItem(synthetic);
        });
      }
    } catch (e) {
      console.warn("FCM setup error:", e);
    }
  }, [uid, showBrowserNotification, pushToast, upsertInAppItem]);

  // Expose firestorePush globally so comment/like/etc flows can call it WITHOUT re-importing
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).__confessionNotify = {
        push: firestorePush,
        browser: showBrowserNotification,
        inApp: pushToast,
      };
    }
  }, [firestorePush, showBrowserNotification, pushToast]);

  // === Setup: permissions, FCM, Android bridge ===
  useEffect(() => {
    let cancelled = false;
    appRef.current = typeof window !== "undefined" ? getFirebaseApp() : null;

    const init = async () => {
      setLoading(true);

      // Android WebView bridge
      if (typeof window !== "undefined") {
        (window as any).onFCMToken = async (token: string) => {
          if (!uid || !db) return;
          try {
            await setDoc(
              doc(db as Firestore, "users", uid),
              {
                fcmTokens: arrayUnion(token),
                notificationsEnabled: true,
              },
              { merge: true },
            );
            setEnabled(true);
          } catch (e) {
            console.warn("Android FCM bridge failed:", e);
          }
        };
      }

      // If user exists, check Notification API
      if (uid && typeof window !== "undefined" && "Notification" in window) {
        const perm = Notification.permission;
        if (perm === "granted") {
          setEnabled(true);
          try {
            await attemptRegisterFCM();
          } catch {}
        } else {
          setEnabled(false);
        }
      } else if (!uid) {
        setEnabled(false);
      }

      if (!cancelled) setLoading(false);
    };

    init();
    return () => {
      cancelled = true;
    };
  }, [uid, attemptRegisterFCM]);

  // === Live Firestore listener for notifications subcollection ===
  useEffect(() => {
    if (!uid || !db) return;
    const q = query(
      collection(db as Firestore, `users/${uid}/notifications`),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const newItems: InAppNotification[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));
        setItems(newItems);

        const latest = snap.docChanges().filter((c) => c.type === "added").map((c) => c.doc);
        for (const d of latest) {
          const n = { id: d.id, ...(d.data() as any) } as InAppNotification;
          const age = Date.now() - toTs(n.createdAt).toMillis();
          if (age < 60_000) {
            pushToast(n);
            if (n.type !== "theme") {
              showBrowserNotification(
                n.fromName ? `${n.fromName} on Confession` : "Confession",
                `${typeToLabel(n)}${n.message ? " · " + n.message : ""}`,
                {
                  tag: n.id,
                  url: n.postId ? `/feed#post-${n.postId}` : n.chatId ? `/chat/${n.chatId}` : "/notifications",
                  silent: true,
                },
              );
            }
          }
        }
      },
      (err) => {
        console.warn("Notifications listener error:", err);
      },
    );
    return () => unsub();
  }, [uid, pushToast, showBrowserNotification]);

  // === Live follows listener (for "Follow Back" state) ===
  useEffect(() => {
    if (!uid || !db) return;
    const qFollows = query(
      collection(db as Firestore, "follows"),
      where("follower", "==", uid),
    );
    const unsub = onSnapshot(qFollows, (snap) => {
      const set = new Set<string>();
      snap.docs.forEach((d) => {
        const d2 = d.data() as any;
        if (d2?.followed) set.add(d2.followed);
      });
      setFollowing(set);
    });
    return () => unsub();
  }, [uid]);

  const markRead = useCallback(
    async (id: string) => {
      if (!uid || !db) return;
      const ref = doc(db as Firestore, `users/${uid}/notifications`, id);
      await updateDoc(ref, { read: true });
    },
    [uid],
  );

  const markAllRead = useCallback(async () => {
    if (!uid || !db) return;
    const unread = items.filter((i) => !i.read);
    if (unread.length === 0) return;
    const batch = writeBatch(db as Firestore);
    unread.slice(0, 450).forEach((i) => {
      batch.update(doc(db as Firestore, `users/${uid}/notifications`, i.id), { read: true });
    });
    await batch.commit();
  }, [uid, items]);

  const clearAll = useCallback(async () => {
    if (!uid || !db) return;
    const batch = writeBatch(db as Firestore);
    items.slice(0, 450).forEach((i) => {
      batch.delete(doc(db as Firestore, `users/${uid}/notifications`, i.id));
    });
    await batch.commit();
  }, [uid, items]);

  const followBack = useCallback(
    async (fromUid: string) => {
      if (!uid || !db || fromUid === uid) return;
      if (following.has(fromUid)) return;
      const userObj = auth?.currentUser;
      const displayName = userObj?.displayName || "User";
      await addDoc(collection(db as Firestore, "follows"), {
        follower: uid,
        followed: fromUid,
        createdAt: Timestamp.now(),
      });
      await firestorePush(fromUid, {
        type: "follow",
        fromUid: uid,
        fromName: displayName,
        message: "followed you back",
        read: false,
      });
    },
    [uid, following, firestorePush],
  );

  const value: NotificationContextValue = {
    enabled,
    loading,
    requestPermission,
    items,
    unreadCount,
    markRead,
    markAllRead,
    clearAll,
    toast,
    dismissToast,
    openDrawer,
    setOpenDrawer,
    followBack,
    following,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <NotificationDrawer />
      <NotificationToast />
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    // Graceful fallback for legacy consumers (if rendered outside provider)
    return {
      notificationEnabled: false,
      loading: false,
    } as any;
  }
  // Keep legacy shape compatibility:
  return {
    notificationEnabled: ctx.enabled,
    loading: ctx.loading,
    enabled: ctx.enabled,
    requestPermission: ctx.requestPermission,
    items: ctx.items,
    unreadCount: ctx.unreadCount,
    markRead: ctx.markRead,
    markAllRead: ctx.markAllRead,
    clearAll: ctx.clearAll,
    openDrawer: ctx.openDrawer,
    setOpenDrawer: ctx.setOpenDrawer,
    followBack: ctx.followBack,
    following: ctx.following,
  } as any;
}

function NotificationToast() {
  const ctx = useContext(NotificationContext);
  if (!ctx || !ctx.toast) return null;
  const n = ctx.toast;
  return (
    <div className="fixed top-20 right-4 z-[120] w-[min(92vw,420px)] animate-slideInUp">
      <div className="glass-card border border-(--gold-primary)/20 rounded-2xl p-4 flex items-start gap-3 shadow-2xl">
        <div className="shrink-0 w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
          {typeToIcon(n.type)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-bold text-white truncate">{n.fromName || "Confession"}</p>
            <span className="text-[10px] text-zinc-500 font-bold tabular-nums">{formatTime(n.createdAt)}</span>
          </div>
          <p className="text-xs text-zinc-300 mt-0.5 line-clamp-3">
            {typeToLabel(n)}
            {n.message && n.type !== "theme" && n.type !== "comment" && n.type !== "reply" ? (
              <span className="block text-zinc-400 mt-0.5">{n.message}</span>
            ) : null}
          </p>
        </div>
        <button
          onClick={ctx.dismissToast}
          className="shrink-0 w-8 h-8 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition"
          aria-label="Dismiss"
          type="button"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function NotificationDrawer() {
  const ctx = useContext(NotificationContext);
  if (!ctx) return null;
  const { openDrawer, setOpenDrawer, items, unreadCount, markAllRead, clearAll, markRead, followBack, following } = ctx;

  return (
    <>
      {openDrawer && (
        <div
          className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setOpenDrawer(false)}
        />
      )}
      <aside
        className={`fixed right-0 top-16 h-[calc(100dvh-64px)] w-full md:w-[420px] z-[95] glass border-l border-white/10 overflow-y-auto transform transition-transform duration-300 ${
          openDrawer ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="sticky top-0 z-10 glass border-b border-white/10 px-5 py-4 flex items-center justify-between backdrop-blur-2xl">
          <div>
            <p className="text-lg font-black text-white">Notifications</p>
            <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-[0.18em]">
              {unreadCount > 0 ? `${unreadCount} new` : "All caught up"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-[11px] font-bold text-(--gold-primary) hover:underline px-3 py-1.5 rounded-full border border-(--gold-primary)/30 hover:bg-(--gold-primary)/10 transition"
                type="button"
              >
                Mark all read
              </button>
            )}
            {items.length > 0 && (
              <button
                onClick={clearAll}
                className="text-[11px] font-bold text-zinc-400 hover:text-white px-3 py-1.5 rounded-full border border-white/10 hover:bg-white/5 transition"
                type="button"
              >
                Clear
              </button>
            )}
            <button
              onClick={() => setOpenDrawer(false)}
              className="w-9 h-9 rounded-xl hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center"
              type="button"
              aria-label="Close notifications"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {items.length === 0 ? (
            <div className="text-center py-20 text-zinc-500">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                <Megaphone className="w-7 h-7 text-(--gold-primary)" />
              </div>
              <p className="font-bold text-zinc-300">No notifications yet</p>
              <p className="text-xs mt-1">Likes, comments, follows, and more will appear here.</p>
            </div>
          ) : (
            items.map((n) => (
              <div
                key={n.id}
                className={`group rounded-2xl p-3.5 border transition ${
                  n.read
                    ? "bg-white/[0.02] border-white/5 opacity-80"
                    : "bg-(--gold-primary)/[0.04] border-(--gold-primary)/20"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="shrink-0 w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                    {typeToIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-bold text-white truncate">{n.fromName || "Confession"}</p>
                      <span className="text-[10px] text-zinc-500 font-bold tabular-nums shrink-0">
                        {formatTime(n.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-300 mt-0.5">
                      {typeToLabel(n)}
                      {n.message &&
                      n.type !== "comment" &&
                      n.type !== "reply" &&
                      n.type !== "theme" ? (
                        <span className="block text-zinc-400 mt-0.5">{n.message}</span>
                      ) : null}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {n.postId && (
                        <a
                          href={`/feed#post-${n.postId}`}
                          onClick={() => {
                            markRead(n.id).catch(() => {});
                            setOpenDrawer(false);
                          }}
                          className="text-[11px] font-bold text-(--gold-primary) hover:underline px-3 py-1.5 rounded-full border border-(--gold-primary)/30 hover:bg-(--gold-primary)/10 transition"
                        >
                          View post
                        </a>
                      )}
                      {n.type === "follow" && n.fromUid && !following.has(n.fromUid) && (
                        <button
                          onClick={() => followBack(n.fromUid!)}
                          className="text-[11px] font-bold text-black bg-(--gold-primary) hover:bg-(--gold-light) px-3 py-1.5 rounded-full transition active:scale-95"
                          type="button"
                        >
                          Follow back
                        </button>
                      )}
                      {!n.read && (
                        <button
                          onClick={() => markRead(n.id)}
                          className="text-[11px] font-bold text-zinc-400 hover:text-white px-3 py-1.5 rounded-full border border-white/10 hover:bg-white/5 transition ml-auto"
                          type="button"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>
    </>
  );
}

export default function NotificationSetup() {
  const ctx = useContext(NotificationContext);
  if (!ctx) return null;
  const { notificationEnabled, loading, requestPermission } = ctx as any;

  if (loading) return null;

  if (notificationEnabled) {
    return (
      <p className="text-green-400 text-xs flex items-center gap-1.5 font-bold">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Push enabled
      </p>
    );
  }

  return (
    <button
      onClick={() => requestPermission()}
      className="text-amber-300 text-xs hover:text-(--gold-primary) hover:underline underline-offset-4 font-bold text-left"
      type="button"
    >
      📱 Enable push notifications
    </button>
  );
}
