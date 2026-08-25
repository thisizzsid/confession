"use client";

import { useEffect, useState } from "react";
import { Shield, Bell, Send, Lock, Image as ImageIcon, Link as LinkIcon, LogOut, Users, CheckCircle, AlertCircle } from "lucide-react";
import Toast from "../components/Toast";

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const [campaign, setCampaign] = useState({
    title: "",
    body: "",
    image: "",
    link: ""
  });

  useEffect(() => {
    fetch("/api/admin/auth", { credentials: "include" })
      .then((response) => response.json())
      .then((data) => setIsAuthenticated(data.authenticated === true))
      .catch(() => setIsAuthenticated(false));
  }, []);

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

  if (!isAuthenticated) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-(--background) p-4">
        <div className="glass-card max-w-md w-full rounded-3xl border border-(--glass-border) bg-(--glass-bg) p-6 sm:p-8">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-(--gold-primary)/10">
              <Shield className="w-8 h-8 text-(--gold-primary)" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Admin Access</h1>
            <p className="text-zinc-400">Enter secure password to continue</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
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
          </form>
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
