"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Ban,
  Bell,
  Check,
  ChevronRight,
  CircleHelp,
  FileText,
  Image as ImageIcon,
  LayoutDashboard,
  Link as LinkIcon,
  Loader2,
  LogOut,
  Megaphone,
  Search,
  Send,
  Settings2,
  Shield,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import Toast from "../components/Toast";

type Panel = "overview" | "campaign" | "users";
type ToastState = { message: string; type: "success" | "error" | "info" };
type ManagedUser = { uid: string; username: string; email: string; isBlocked: boolean };

const initialCampaign = { title: "", body: "", image: "", link: "" };

const navItems: { id: Panel; label: string; description: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", description: "Workspace summary", icon: LayoutDashboard },
  { id: "campaign", label: "Broadcasts", description: "Push campaigns", icon: Megaphone },
  { id: "users", label: "User access", description: "Manage accounts", icon: Users },
];

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [isConfigured, setIsConfigured] = useState(true);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [activePanel, setActivePanel] = useState<Panel>("overview");
  const [userSearch, setUserSearch] = useState("");
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [userAction, setUserAction] = useState<string | null>(null);
  const [campaign, setCampaign] = useState(initialCampaign);

  const campaignReady = campaign.title.trim().length > 0 && campaign.body.trim().length > 0;
  const titleCount = campaign.title.length;
  const bodyCount = campaign.body.length;
  const blockedUsers = useMemo(() => managedUsers.filter((user) => user.isBlocked).length, [managedUsers]);

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

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
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
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "Unable to sign in", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!campaignReady) return;
    setLoading(true);
    try {
      const response = await fetch("/api/admin/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(campaign),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to send campaign");
      setToast({ message: data.sent === undefined ? data.message : `Broadcast delivered to ${data.sent} devices.`, type: "success" });
      setCampaign(initialCampaign);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to send broadcast";
      setToast({ message, type: "error" });
      if (message === "Unauthorized") setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/admin/auth", { method: "DELETE", credentials: "include" });
    setIsAuthenticated(false);
    setCampaign(initialCampaign);
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
      setToast({
        message: action === "block" ? "Account blocked and notification sent." : data.emailSent ? "Account restored. Admin email sent." : `Account restored. ${data.warning || ""}`,
        type: "success",
      });
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "Unable to update user", type: "error" });
    } finally {
      setUserAction(null);
    }
  };

  if (!isAuthenticated) {
    if (checkingSession) {
      return <div className="flex min-h-dvh items-center justify-center bg-(--background) text-sm text-zinc-500">Checking secure session...</div>;
    }
    return (
      <main className="admin-login min-h-dvh bg-[#101310] p-6 text-white">
        <div className="admin-login-grid" />
        <div className="relative mx-auto flex min-h-[calc(100dvh-3rem)] max-w-md items-center">
          <div className="w-full rounded-[2rem] border border-white/10 bg-[#191d1a]/95 p-8 shadow-2xl shadow-black/30 backdrop-blur-xl">
            <div className="mb-9 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#d7dfd0] text-[#111511]"><Shield className="h-5 w-5" /></div>
              <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#b8c4b0]">Confession</p><p className="text-sm text-zinc-500">Operations console</p></div>
            </div>
            <div className="mb-8">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Restricted area</p>
              <h1 className="text-3xl font-semibold tracking-tight">Welcome back.</h1>
              <p className="mt-2 text-sm leading-6 text-zinc-400">{isConfigured ? "Sign in to manage broadcasts and protect your community." : "Admin access is not configured on this deployment."}</p>
            </div>
            {isConfigured && <form onSubmit={handleLogin} className="space-y-4">
              <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500" htmlFor="admin-password">Admin password</label>
              <div className="relative">
                <ShieldCheck className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input id="admin-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" className="w-full rounded-xl border border-white/10 bg-black/20 py-3.5 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-[#b8c4b0]" autoFocus />
              </div>
              <button type="submit" disabled={loading || !password} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#d7dfd0] py-3.5 text-sm font-bold text-[#111511] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />} Access console</button>
            </form>}
            <div className="mt-8 flex items-center gap-2 border-t border-white/8 pt-5 text-xs text-zinc-600"><CircleHelp className="h-3.5 w-3.5" /> Your session is protected with an encrypted cookie.</div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="admin-shell min-h-dvh bg-[#101310] text-white">
      <aside className="admin-sidebar border-r border-white/8 bg-[#151915]">
        <div className="flex items-center gap-3 px-6 py-7">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d7dfd0] text-[#111511]"><Sparkles className="h-5 w-5" /></div>
          <div><p className="font-semibold tracking-tight">Confession</p><p className="text-[11px] uppercase tracking-[0.18em] text-zinc-600">Admin console</p></div>
        </div>
        <div className="px-4 pt-8">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">Workspace</p>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activePanel === item.id;
              return <button key={item.id} type="button" onClick={() => setActivePanel(item.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${active ? "bg-[#d7dfd0] text-[#111511]" : "text-zinc-400 hover:bg-white/5 hover:text-white"}`}>
                <Icon className="h-[18px] w-[18px]" /><span className="flex-1"><span className="block text-sm font-semibold">{item.label}</span><span className={`block text-[11px] ${active ? "text-[#4f594d]" : "text-zinc-600"}`}>{item.description}</span></span>{active && <ChevronRight className="h-4 w-4" />}
              </button>;
            })}
          </nav>
        </div>
        <div className="mt-auto p-4">
          <div className="mb-3 rounded-xl border border-[#b8c4b0]/15 bg-[#b8c4b0]/5 p-3"><div className="flex items-center gap-2 text-xs font-semibold text-[#d7dfd0]"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Systems operational</div><p className="mt-2 text-[11px] leading-5 text-zinc-600">Firebase services are connected and ready.</p></div>
          <button type="button" onClick={handleLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-zinc-500 transition hover:bg-white/5 hover:text-white"><LogOut className="h-4 w-4" /> Sign out</button>
        </div>
      </aside>

      <section className="admin-content">
        <header className="flex items-start justify-between border-b border-white/8 px-6 py-7 sm:px-10">
          <div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#b8c4b0]">Control center / {activePanel === "users" ? "User access" : activePanel === "campaign" ? "Broadcasts" : "Overview"}</p><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{activePanel === "users" ? "User access" : activePanel === "campaign" ? "Broadcast center" : "Good evening, admin."}</h1><p className="mt-2 text-sm text-zinc-500">{activePanel === "overview" ? "A focused view of the tools that keep your community moving." : activePanel === "campaign" ? "Reach your community with a clear, thoughtful message." : "Search accounts and take action when it matters."}</p></div>
          <div className="hidden items-center gap-3 sm:flex"><span className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-zinc-500">Live environment</span><div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#d7dfd0] text-sm font-bold text-[#111511]">A</div></div>
        </header>

        <div className="admin-page-body px-6 py-7 sm:px-10 sm:py-9">
          {activePanel === "overview" && <div className="space-y-7">
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { label: "Platform status", value: "Operational", detail: "All systems normal", icon: ShieldCheck, color: "text-emerald-300" },
                { label: "Search results", value: managedUsers.length ? `${managedUsers.length}` : "—", detail: "Search user access below", icon: Users, color: "text-[#d7dfd0]" },
                { label: "Blocked in view", value: managedUsers.length ? `${blockedUsers}` : "—", detail: "Based on current search", icon: Ban, color: "text-rose-300" },
              ].map((stat) => { const Icon = stat.icon; return <div key={stat.label} className="rounded-2xl border border-white/8 bg-[#181c18] p-5"><div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-[0.13em] text-zinc-600">{stat.label}</p><Icon className={`h-4 w-4 ${stat.color}`} /></div><p className="mt-5 text-2xl font-semibold tracking-tight">{stat.value}</p><p className="mt-1 text-xs text-zinc-600">{stat.detail}</p></div>; })}
            </div>
            <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
              <button type="button" onClick={() => setActivePanel("campaign")} className="group rounded-2xl border border-[#b8c4b0]/20 bg-gradient-to-br from-[#242c24] to-[#181c18] p-7 text-left transition hover:border-[#d7dfd0]/50"><div className="flex items-start justify-between"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#d7dfd0] text-[#111511]"><Megaphone className="h-5 w-5" /></div><ArrowUpRight className="h-5 w-5 text-zinc-600 transition group-hover:text-[#d7dfd0]" /></div><h2 className="mt-12 text-2xl font-semibold">Create a broadcast</h2><p className="mt-2 max-w-md text-sm leading-6 text-zinc-500">Send a polished push notification to every opted-in member. Preview the message before it leaves your console.</p><span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#d7dfd0]">Open broadcast center <ChevronRight className="h-4 w-4" /></span></button>
              <div className="rounded-2xl border border-white/8 bg-[#181c18] p-7"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-[#d7dfd0]"><Settings2 className="h-5 w-5" /></div><h2 className="mt-12 text-xl font-semibold">Keep control</h2><p className="mt-2 text-sm leading-6 text-zinc-500">Use user access tools to protect the space and communicate account changes responsibly.</p><button type="button" onClick={() => setActivePanel("users")} className="mt-6 text-sm font-semibold text-[#d7dfd0] hover:text-white">Manage accounts <ArrowUpRight className="ml-1 inline h-4 w-4" /></button></div>
            </div>
          </div>}

          {activePanel === "campaign" && <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="rounded-2xl border border-white/8 bg-[#181c18] p-6 sm:p-8">
              <div className="mb-8 flex items-start justify-between border-b border-white/8 pb-6"><div><div className="mb-3 flex items-center gap-2 text-[#d7dfd0]"><Megaphone className="h-4 w-4" /><span className="text-xs font-bold uppercase tracking-[0.16em]">New broadcast</span></div><h2 className="text-2xl font-semibold tracking-tight">Compose message</h2><p className="mt-2 text-sm text-zinc-500">Make it useful, concise, and worth opening.</p></div><span className="rounded-full bg-white/5 px-3 py-1.5 text-xs text-zinc-500">Push notification</span></div>
              <form onSubmit={handleSend} className="space-y-6">
                <div><div className="mb-2 flex items-center justify-between"><label htmlFor="campaign-title" className="text-sm font-semibold text-zinc-300">Title</label><span className={`text-xs ${titleCount > 80 ? "text-rose-300" : "text-zinc-600"}`}>{titleCount}/80</span></div><div className="relative"><Bell className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" /><input id="campaign-title" maxLength={80} value={campaign.title} onChange={(event) => setCampaign({ ...campaign, title: event.target.value })} placeholder="e.g. A new chapter starts today" className="w-full rounded-xl border border-white/10 bg-[#101310] py-3.5 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-[#b8c4b0]" required /></div></div>
                <div><div className="mb-2 flex items-center justify-between"><label htmlFor="campaign-body" className="text-sm font-semibold text-zinc-300">Message</label><span className={`text-xs ${bodyCount > 500 ? "text-rose-300" : "text-zinc-600"}`}>{bodyCount}/500</span></div><textarea id="campaign-body" maxLength={500} value={campaign.body} onChange={(event) => setCampaign({ ...campaign, body: event.target.value })} placeholder="Write a message your community will appreciate..." className="min-h-36 w-full resize-y rounded-xl border border-white/10 bg-[#101310] px-4 py-3.5 text-sm leading-6 text-white outline-none transition placeholder:text-zinc-700 focus:border-[#b8c4b0]" required /></div>
                <div className="grid gap-5 md:grid-cols-2"><div><label htmlFor="campaign-image" className="mb-2 block text-sm font-semibold text-zinc-300">Image URL <span className="font-normal text-zinc-600">Optional</span></label><div className="relative"><ImageIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" /><input id="campaign-image" type="url" value={campaign.image} onChange={(event) => setCampaign({ ...campaign, image: event.target.value })} placeholder="https://..." className="w-full rounded-xl border border-white/10 bg-[#101310] py-3.5 pl-11 pr-4 text-sm text-white outline-none focus:border-[#b8c4b0]" /></div></div><div><label htmlFor="campaign-link" className="mb-2 block text-sm font-semibold text-zinc-300">Target link <span className="font-normal text-zinc-600">Optional</span></label><div className="relative"><LinkIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" /><input id="campaign-link" value={campaign.link} onChange={(event) => setCampaign({ ...campaign, link: event.target.value })} placeholder="/feed or https://..." className="w-full rounded-xl border border-white/10 bg-[#101310] py-3.5 pl-11 pr-4 text-sm text-white outline-none focus:border-[#b8c4b0]" /></div></div></div>
                <div className="flex flex-col justify-between gap-4 border-t border-white/8 pt-6 sm:flex-row sm:items-center"><button type="button" onClick={() => setCampaign(initialCampaign)} className="text-sm text-zinc-600 transition hover:text-white">Clear draft</button><button type="submit" disabled={loading || !campaignReady} className="flex items-center justify-center gap-2 rounded-xl bg-[#d7dfd0] px-6 py-3.5 text-sm font-bold text-[#111511] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send to opted-in users</button></div>
              </form>
            </section>
            <aside className="space-y-5"><div className="rounded-2xl border border-white/8 bg-[#181c18] p-6"><div className="mb-5 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-zinc-500"><FileText className="h-4 w-4" /> Live preview</div><div className="rounded-xl border border-white/8 bg-[#101310] p-4"><div className="mb-4 flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#d7dfd0] text-[#111511]"><Bell className="h-3.5 w-3.5" /></div><span className="text-[11px] font-semibold text-zinc-500">Confession · now</span></div><p className="text-sm font-semibold">{campaign.title || "Your notification title"}</p><p className="mt-1 text-xs leading-5 text-zinc-500">{campaign.body || "Your message preview will appear here."}</p></div><p className="mt-4 text-xs leading-5 text-zinc-600">Only members with notifications enabled will receive this broadcast.</p></div><div className="rounded-2xl border border-[#b8c4b0]/15 bg-[#b8c4b0]/5 p-6"><p className="text-sm font-semibold text-[#d7dfd0]">Before you send</p><ul className="mt-4 space-y-3 text-xs leading-5 text-zinc-500"><li className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" /> Keep the title under 80 characters.</li><li className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" /> Confirm links open the intended destination.</li><li className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" /> Broadcasts cannot be recalled.</li></ul></div></aside>
          </div>}

          {activePanel === "users" && <section className="max-w-5xl rounded-2xl border border-white/8 bg-[#181c18] p-6 sm:p-8"><div className="mb-7 flex flex-col justify-between gap-4 border-b border-white/8 pb-6 sm:flex-row sm:items-end"><div><div className="mb-3 flex items-center gap-2 text-[#d7dfd0]"><Users className="h-4 w-4" /><span className="text-xs font-bold uppercase tracking-[0.16em]">Directory</span></div><h2 className="text-2xl font-semibold tracking-tight">Manage user access</h2><p className="mt-2 text-sm text-zinc-500">Search by username, then block or restore an account.</p></div><div className="rounded-lg bg-white/5 px-3 py-2 text-xs text-zinc-500">Results: <span className="font-semibold text-white">{managedUsers.length}</span></div></div><div className="relative max-w-xl"><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" /><input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Search username..." className="w-full rounded-xl border border-white/10 bg-[#101310] py-3.5 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-[#b8c4b0]" /></div>{userSearch.trim().length < 2 ? <div className="mt-10 rounded-xl border border-dashed border-white/10 px-6 py-12 text-center"><Search className="mx-auto h-6 w-6 text-zinc-700" /><p className="mt-3 text-sm text-zinc-500">Type at least two characters to search the directory.</p></div> : managedUsers.length === 0 ? <div className="mt-6 rounded-xl border border-dashed border-white/10 px-6 py-12 text-center"><p className="text-sm text-zinc-500">No matching accounts found.</p></div> : <div className="mt-6 overflow-hidden rounded-xl border border-white/8"><div className="hidden grid-cols-[1fr_1.4fr_120px_130px] gap-4 bg-white/[0.03] px-5 py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-600 sm:grid"><span>Account</span><span>Email</span><span>Status</span><span>Action</span></div>{managedUsers.map((user) => <div key={user.uid} className="grid gap-3 border-t border-white/8 px-5 py-4 sm:grid-cols-[1fr_1.4fr_120px_130px] sm:items-center"><div><p className="text-sm font-semibold">{user.username}</p><p className="mt-1 text-[11px] text-zinc-600">{user.uid}</p></div><p className="truncate text-sm text-zinc-500">{user.email || "No email address"}</p><span className={`w-fit rounded-full px-2.5 py-1 text-[11px] font-semibold ${user.isBlocked ? "bg-rose-400/10 text-rose-300" : "bg-emerald-400/10 text-emerald-300"}`}>{user.isBlocked ? "Blocked" : "Active"}</span><button type="button" disabled={userAction === user.uid} onClick={() => updateUserStatus(user.uid, user.isBlocked ? "unblock" : "block")} className={`flex w-fit items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition disabled:opacity-50 ${user.isBlocked ? "border-emerald-300/20 text-emerald-300 hover:bg-emerald-300/10" : "border-rose-300/20 text-rose-300 hover:bg-rose-300/10"}`}>{userAction === user.uid ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : user.isBlocked ? <Check className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}{user.isBlocked ? "Restore" : "Block"}</button></div>)}</div>}</section>}
        </div>
      </section>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </main>
  );
}
