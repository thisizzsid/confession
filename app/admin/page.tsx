"use client";

import { useEffect, useState } from "react";
import { collection, Firestore, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { Shield, Bell, Send, Lock, Image as ImageIcon, Link as LinkIcon, LogOut, Users, Search, Ban, ShieldCheck, MapPinned } from "lucide-react";
import { db } from "../../firebase";
import Toast from "../components/Toast";
import { normalizeGeoPoint } from "../lib/utils";

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [isConfigured, setIsConfigured] = useState(true);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [managedUsers, setManagedUsers] = useState<any[]>([]);
  const [userAction, setUserAction] = useState<string | null>(null);
  const [geoPosts, setGeoPosts] = useState<any[]>([]);

  const [campaign, setCampaign] = useState({
    title: "",
    body: "",
    image: "",
    link: ""
  });

  useEffect(() => {
    fetch("/api/admin/auth", { credentials: "include" })
      .then((response) => response.json())
      .then((data) => {
        setIsAuthenticated(data.authenticated === true);
        setIsConfigured(data.configured !== false);
      })
      .catch(() => setIsAuthenticated(false))
      .finally(() => setCheckingSession(false));
  }, []);

  useEffect(() => {
    if (!isAuthenticated || userSearch.trim().length < 2) {
      setManagedUsers([]);
      return;
    }
    const timer = setTimeout(async () => {
      const response = await fetch(`/api/admin/users?q=${encodeURIComponent(userSearch.trim())}`, { credentials: "include" });
      if (response.ok) setManagedUsers((await response.json()).users || []);
    }, 300);
    return () => clearTimeout(timer);
  }, [isAuthenticated, userSearch]);

  useEffect(() => {
    if (!isAuthenticated || !db) {
      setGeoPosts([]);
      return;
    }

    const q = query(collection(db as Firestore, "posts"), orderBy("createdAt", "desc"), limit(60));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const nextPosts: any[] = snapshot.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
          .filter((post: any) => typeof post.latitude === "number" && typeof post.longitude === "number");
        setGeoPosts(nextPosts.slice(0, 18));
      },
      () => setGeoPosts([])
    );

    return () => unsubscribe();
  }, [isAuthenticated]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Invalid admin credentials");
      }
      setIsAuthenticated(true);
      setPassword("");
    } catch (error: any) {
      setToast({ message: error.message, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/admin/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...campaign
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to send campaign");
      }

      setToast({ 
        message: `Sent to ${data.sent} users (${data.failed} failed)`, 
        type: "success" 
      });
      
      // Reset form (optional)
      // setCampaign({ title: "", body: "", image: "", link: "" });

    } catch (error: any) {
      setToast({ message: error.message, type: "error" });
      if (error.message === "Unauthorized") {
        setIsAuthenticated(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/admin/auth", { method: "DELETE", credentials: "include" });
    setIsAuthenticated(false);
    setCampaign({ title: "", body: "", image: "", link: "" });
  };

  const updateUserStatus = async (uid: string, action: "block" | "unblock") => {
    setUserAction(uid);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ uid, action }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update user");
      setManagedUsers((users) => users.map((user) => user.uid === uid ? { ...user, isBlocked: action === "block" } : user));
      setToast({ message: action === "block" ? "User blocked and notified." : data.emailSent ? "User unblocked. Admin email sent." : `User unblocked. ${data.warning || ""}`, type: "success" });
    } catch (error: any) {
      setToast({ message: error.message, type: "error" });
    } finally {
      setUserAction(null);
    }
  };

  if (!isAuthenticated) {
    if (checkingSession) {
      return <div className="flex min-h-dvh items-center justify-center bg-(--background) text-sm text-zinc-500">Checking admin session...</div>;
    }
    return (
      <div className="min-h-dvh flex items-center justify-center bg-(--background) p-4">
        <div className="glass-card max-w-md w-full rounded-3xl border border-(--glass-border) bg-(--glass-bg) p-6 sm:p-8">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-(--gold-primary)/10">
              <Shield className="w-8 h-8 text-(--gold-primary)" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Admin Access</h1>
            <p className="text-zinc-400">{isConfigured ? "Enter secure password to continue" : "Admin access is not configured on this deployment."}</p>
          </div>

          {isConfigured && <form onSubmit={handleLogin} className="space-y-6">
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full bg-black/40 border border-zinc-800 rounded-xl py-3 pl-12 pr-4 text-white focus:border-(--gold-primary) outline-none transition-colors"
                autoFocus
              />
            </div>
              <button
              type="submit"
                disabled={loading || !password}
                className="w-full rounded-xl bg-(--gold-primary) py-3 font-bold text-black transition-colors hover:bg-(--gold-light) disabled:cursor-not-allowed disabled:opacity-50"
            >
              Access Dashboard
            </button>
          </form>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-(--background) p-4 text-white md:p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <header className="mb-12 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-(--gold-primary)/10 rounded-xl flex items-center justify-center">
            <Shield className="w-6 h-6 text-(--gold-primary)" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-zinc-400">Push Notification Campaigns</p>
          </div>
          </div>
          <button type="button" onClick={handleLogout} className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-zinc-400 transition hover:border-(--gold-primary)/40 hover:text-(--gold-primary)" aria-label="Sign out of admin panel">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </header>

        <section className="glass-card rounded-3xl border border-(--glass-border) bg-(--glass-bg) p-6 md:p-8">
          <div className="mb-5 flex items-center gap-3 border-b border-white/10 pb-5">
            <ShieldCheck className="h-5 w-5 text-(--gold-primary)" />
            <div>
              <h2 className="font-semibold text-white">User access</h2>
              <p className="text-sm text-zinc-500">Block or unblock accounts by username.</p>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Search username" className="w-full rounded-xl border border-white/10 bg-black/30 py-3 pl-11 pr-4 text-sm text-white outline-none transition focus:border-(--gold-primary)/50" />
          </div>
          {managedUsers.length > 0 && <div className="mt-4 space-y-2">
            {managedUsers.map((managedUser) => (
              <div key={managedUser.uid} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <div className="min-w-0"><p className="truncate font-semibold text-white">{managedUser.username}</p><p className="truncate text-xs text-zinc-500">{managedUser.email || managedUser.uid}</p></div>
                <button type="button" disabled={userAction === managedUser.uid} onClick={() => updateUserStatus(managedUser.uid, managedUser.isBlocked ? "unblock" : "block")} className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition disabled:opacity-50 ${managedUser.isBlocked ? "border border-(--gold-primary)/30 text-(--gold-primary) hover:bg-(--gold-primary)/10" : "bg-red-500/15 text-red-200 hover:bg-red-500/25"}`}>
                  {managedUser.isBlocked ? <ShieldCheck className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                  {managedUser.isBlocked ? "Unblock" : "Block"}
                </button>
              </div>
            ))}
          </div>}
        </section>

        <section className="glass-card rounded-3xl border border-(--glass-border) bg-(--glass-bg) p-6 md:p-8">
          <div className="mb-5 flex items-center gap-3 border-b border-white/10 pb-5">
            <MapPinned className="h-5 w-5 text-(--gold-primary)" />
            <div>
              <h2 className="font-semibold text-white">Live map</h2>
              <p className="text-sm text-zinc-500">Recent geotagged posts from the platform.</p>
            </div>
          </div>

          {geoPosts.length === 0 ? (
            <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/20 text-sm text-zinc-400">
              No geotagged posts yet.
            </div>
          ) : (
            <div className="relative h-72 overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(212,175,55,0.18),_transparent_35%),linear-gradient(135deg,#101010,#1b1b1b)]">
              <svg viewBox="0 0 100 100" className="h-full w-full">
                <g opacity="0.2" stroke="rgba(255,255,255,0.35)" strokeWidth="0.2">
                  {[...Array(11)].map((_, index) => (
                    <line key={`v-${index}`} x1={index * 10} y1="0" x2={index * 10} y2="100" />
                  ))}
                  {[...Array(11)].map((_, index) => (
                    <line key={`h-${index}`} x1="0" y1={index * 10} x2="100" y2={index * 10} />
                  ))}
                </g>
                {geoPosts.map((post) => {
                  const point = normalizeGeoPoint(post.latitude, post.longitude);
                  return (
                    <g key={post.id}>
                      <circle cx={point.x} cy={point.y} r="2.2" fill="rgba(212,175,55,0.35)" />
                      <circle cx={point.x} cy={point.y} r="1.1" fill="#f5d76e" />
                    </g>
                  );
                })}
              </svg>
              <div className="absolute bottom-3 left-3 rounded-full border border-(--gold-primary)/30 bg-black/40 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-(--gold-primary)">
                {geoPosts.length} active markers
              </div>
            </div>
          )}
        </section>

        <div className="glass-card rounded-3xl border border-(--glass-border) bg-(--glass-bg) p-6 md:p-8">
          <div className="mb-6 flex items-center gap-3 border-b border-white/10 pb-5">
            <Users className="h-5 w-5 text-(--gold-primary)" />
            <p className="text-sm text-zinc-400">Send a notification to all users with push notifications enabled.</p>
          </div>
          <form onSubmit={handleSend} className="space-y-6">
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300 ml-1">Campaign Title</label>
              <div className="relative">
                <Bell className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <input
                  type="text"
                  value={campaign.title}
                  onChange={(e) => setCampaign({ ...campaign, title: e.target.value })}
                  placeholder="e.g., New Feature Alert! 🚀"
                  className="w-full bg-black/40 border border-zinc-800 rounded-xl py-3 pl-12 pr-4 text-white focus:border-(--gold-primary) outline-none transition-colors"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300 ml-1">Message Body</label>
              <textarea
                value={campaign.body}
                onChange={(e) => setCampaign({ ...campaign, body: e.target.value })}
                placeholder="Write your message here..."
                className="w-full bg-black/40 border border-zinc-800 rounded-xl py-3 px-4 text-white focus:border-(--gold-primary) outline-none transition-colors h-32 resize-none"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300 ml-1">Image URL (Optional)</label>
                <div className="relative">
                  <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                  <input
                    type="url"
                    value={campaign.image}
                    onChange={(e) => setCampaign({ ...campaign, image: e.target.value })}
                    placeholder="https://..."
                    className="w-full bg-black/40 border border-zinc-800 rounded-xl py-3 pl-12 pr-4 text-white focus:border-(--gold-primary) outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300 ml-1">Target Link (Optional)</label>
                <div className="relative">
                  <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                  <input
                    type="text"
                    value={campaign.link}
                    onChange={(e) => setCampaign({ ...campaign, link: e.target.value })}
                    placeholder="/feed"
                    className="w-full bg-black/40 border border-zinc-800 rounded-xl py-3 pl-12 pr-4 text-white focus:border-(--gold-primary) outline-none transition-colors"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-linear-to-r from-(--gold-primary) to-(--gold-light) text-black font-bold py-4 rounded-xl hover:shadow-[0_0_20px_color-mix(in_srgb,var(--gold-primary),transparent_70%)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    <span>Pushing Campaign...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    <span>Send Notification Campaign</span>
                  </>
                )}
              </button>
            </div>

          </form>
        </div>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
