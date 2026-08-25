"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../../firebase";
import {
  collection,
  getDocs,
  orderBy,
  query,
  doc,
  updateDoc,
  setDoc,
  deleteDoc,
  Firestore,
  where,
  addDoc,
  Timestamp,
} from "firebase/firestore";
import Link from "next/link";
import { useNotifications } from "../components/NotificationSetup";
import { Bell, CheckCheck, ChevronRight, Megaphone, UserPlus, Heart, MessageCircle, Palette, AtSign, Repeat2 } from "lucide-react";

export default function NotificationsPage() {
  const { user } = useAuth();
  const ctx = useNotifications() as any;
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (Array.isArray(ctx.items)) setItems(ctx.items);
  }, [ctx.items]);

  const load = async () => {
    if (!user || !db) return;
    setLoading(true);
    try {
      const q = query(
        collection(db as Firestore, `users/${user.uid}/notifications`),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } finally {
      setLoading(false);
    }
  };

  const markRead = async (id: string) => {
    if (ctx.markRead) {
      await ctx.markRead(id);
      return;
    }
    if (!user || !db) return;
    await updateDoc(doc(db as Firestore, `users/${user.uid}/notifications/${id}`), {
      read: true,
    });
    load();
  };

  const followBack = async (fromUid: string) => {
    if (ctx.followBack) {
      await ctx.followBack(fromUid);
      return;
    }
    if (!user || !db) return;
    
    // Check if already following
    const q = query(
      collection(db as Firestore, "follows"),
      where("follower", "==", user.uid),
      where("followed", "==", fromUid)
    );
    const snap = await getDocs(q);
    
    if (!snap.empty) {
      alert("You are already following this user.");
      return;
    }

    // Create follow relationship (using same collection as FeedPage)
    await addDoc(collection(db as Firestore, "follows"), {
      follower: user.uid,
      followed: fromUid,
    });

    // Send notification to the user we are following back
    await addDoc(collection(db as Firestore, `users/${fromUid}/notifications`), {
      type: "follow",
      fromUid: user.uid,
      fromName: user.displayName || "User",
      createdAt: Timestamp.now(),
      read: false,
    });

    load();
    alert("Followed back!");
  };

  useEffect(() => {
    load();
  }, [user]);

  const formatTimestamp = (value: any) => {
    try {
      const date = value?.toDate ? value.toDate() : new Date(value);
      return Number.isNaN(date.getTime()) ? "Just now" : date.toLocaleString();
    } catch {
      return "Just now";
    }
  };

  const iconFor = (type?: string) => {
    if (type === "like") return <Heart className="h-4 w-4" />;
    if (type === "comment" || type === "reply") return <MessageCircle className="h-4 w-4" />;
    if (type === "follow") return <UserPlus className="h-4 w-4" />;
    if (type === "mention") return <AtSign className="h-4 w-4" />;
    if (type === "theme") return <Palette className="h-4 w-4" />;
    if (type === "campaign" || type === "system") return <Megaphone className="h-4 w-4" />;
    return <Repeat2 className="h-4 w-4" />;
  };

  if (!user) return <div className="flex min-h-screen items-center justify-center text-(--gold-primary)">Login Required</div>;

  return (
    <div className="min-h-screen bg-(--background) px-4 py-8 text-white sm:px-6 md:px-10">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-(--gold-primary)/20 bg-(--gold-primary)/10 text-(--gold-primary)">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white sm:text-3xl">Notifications</h1>
              <p className="text-sm text-zinc-500">Your latest activity and updates</p>
            </div>
          </div>
          {items.some((item) => !item.read) && ctx.markAllRead && (
            <button type="button" onClick={() => ctx.markAllRead()} className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-zinc-400 transition hover:border-(--gold-primary)/30 hover:text-(--gold-primary)">
              <CheckCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Mark all read</span>
            </button>
          )}
        </header>

        {loading ? (
          <div className="space-y-3" aria-busy="true">
            {[1, 2, 3].map((key) => <div key={key} className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/5" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/3 p-12 text-center">
            <Bell className="mx-auto h-8 w-8 text-zinc-600" />
            <p className="mt-4 font-semibold text-zinc-300">You&apos;re all caught up</p>
            <p className="mt-1 text-sm text-zinc-500">New activity will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">

      {items.map((n) => {
        let label = "";
        let icon = "";
        if (n.type === "like") icon = "❤️";
        if (n.type === "comment") icon = "💬";
        if (n.type === "reply") icon = "🔁";
        if (n.type === "follow") icon = "➕";
        if (n.type === "mention") icon = "💠";
        if (n.type === "theme") icon = "🎨";
        if (n.type === "campaign" || n.type === "system") icon = "📢";

        if (n.type === "like") label = "liked your post";
        if (n.type === "comment") label = "commented on your post";
        if (n.type === "reply") label = "replied to your comment";
        if (n.type === "follow") label = "followed you";
        if (n.type === "mention") label = "mentioned you";
        if (n.type === "theme") label = "updated their accent color";
        if (n.type === "campaign" || n.type === "system") label = n.message || "new update";

        return (
          <div
            key={n.id}
            className={`p-4 rounded bg-zinc-900 space-y-2 ${
              n.read ? "opacity-50" : "opacity-100"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-(--gold-primary)/10 text-(--gold-primary)">{iconFor(n.type)}</div>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-relaxed text-zinc-200">
                  <b className="font-semibold text-white">{n.fromName || "Confession"}</b>{label ? ` ${label}` : ""}
                </p>
                <p className="mt-1 text-xs text-zinc-500">{formatTimestamp(n.createdAt)}</p>
              </div>
              {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-(--gold-primary)" aria-label="Unread" />}
            </div>

            {/* Follow Back Button */}
            {n.type === "follow" && (
              <button
                onClick={() => followBack(n.fromUid)}
                className="mt-2 inline-flex items-center gap-1 rounded-lg bg-(--gold-primary) px-3 py-1.5 text-xs font-semibold text-black"
              >
                Follow Back
              </button>
            )}

            {!n.read && (
              <button
                onClick={() => markRead(n.id)}
                className="mt-2 inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-(--gold-primary)/30 hover:text-(--gold-primary)"
              >
                Mark Read
              </button>
            )}
          </div>
        );
      })}
          </div>
        )}
      </div>
    </div>
  );
}
