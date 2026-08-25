"use client";

import { useAuth } from "../context/AuthContext";
import { db } from "../../firebase";
import {
  collection,
  getDocs,
  getDoc,
  doc,
  Firestore,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

/* ----------------------------- Types ----------------------------- */

interface ChatUser {
  id: string;
  username?: string;
  email?: string;
  lastSeen?: Timestamp | Date | string | null;
}

/* --------------------------- Utilities ---------------------------- */

const maskEmail = (email?: string) => {
  if (!email) return "";
  const [name, domain] = email.split("@");
  if (!name || !domain) return email;
  const maskedName = name.length > 2 ? `${name.substring(0, 2)}...` : name;
  return `${maskedName}@${domain}`;
};

const isUserOnline = (lastSeen?: Timestamp | Date | string | null) => {
  if (!lastSeen) return false;
  const date =
    lastSeen instanceof Timestamp ? lastSeen.toDate() : new Date(lastSeen);
  if (Number.isNaN(date.getTime())) return false;
  const diffMinutes = (Date.now() - date.getTime()) / 1000 / 60;
  return diffMinutes < 5;
};

/* ------------------------------ Page ------------------------------ */

export default function ChatListPage() {
  const { user } = useAuth();
  const [usersList, setUsersList] = useState<ChatUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user || !db) return;
    setLoading(true);
    setError(null);

    try {
      const followsQuery = query(
        collection(db as Firestore, "follows"),
        where("follower", "==", user.uid)
      );
      const followsSnap = await getDocs(followsQuery);
      const followedIds = followsSnap.docs.map((d) => d.data().followed as string);

      if (followedIds.length === 0) {
        setUsersList([]);
        return;
      }

      const userDocs = await Promise.all(
        followedIds.map((uid) => getDoc(doc(db as Firestore, "users", uid)))
      );

      const users: ChatUser[] = userDocs
        .filter((snap) => snap.exists())
        .map((snap) => ({ id: snap.id, ...(snap.data() as Omit<ChatUser, "id">) }))
        .sort((a, b) => {
          const aOnline = isUserOnline(a.lastSeen);
          const bOnline = isUserOnline(b.lastSeen);
          if (aOnline !== bOnline) return aOnline ? -1 : 1;
          return (a.username ?? "").localeCompare(b.username ?? "");
        });

      setUsersList(users);
    } catch (err) {
      console.error("Error loading users:", err);
      setError("We couldn't load your chats. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  /* --------------------------- Not logged in --------------------------- */

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-[#0A0A0A] via-black to-[#0A0A0A] px-6 text-(--gold-primary)">
        <div className="glass animate-bounceIn rounded-3xl p-10 text-center sm:p-12">
          <p className="text-xl font-bold sm:text-2xl">Login Required</p>
          <p className="mt-2 text-sm text-zinc-500">
            Please sign in to view your conversations.
          </p>
        </div>
      </div>
    );
  }

  /* -------------------------------- Page -------------------------------- */

  return (
    <div className="relative min-h-screen overflow-hidden bg-linear-to-br from-[#0A0A0A] via-black to-[#0A0A0A] px-4 py-16 text-(--gold-primary) sm:px-6 md:px-8 md:py-24">
      {/* Background accents */}
      <div
        aria-hidden="true"
        className="animate-float pointer-events-none absolute left-10 top-32 h-72 w-72 rounded-full bg-(--gold-primary)/10 blur-3xl sm:left-20 sm:h-96 sm:w-96"
      />
      <div
        aria-hidden="true"
        className="animate-float pointer-events-none absolute bottom-32 right-10 h-72 w-72 rounded-full bg-[#00F0FF]/5 blur-3xl [animation-delay:2s] sm:right-20 sm:h-96 sm:w-96"
      />

      {/* Header */}
      <header className="relative z-10 mb-12 animate-fadeIn text-center sm:mb-16">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-(--gold-primary) to-(--gold-light) shadow-2xl shadow-(--gold-primary)/50 animate-pulse-glow sm:h-20 sm:w-20">
          <span className="text-3xl sm:text-4xl">💬</span>
        </div>

        <h1 className="bg-linear-to-r from-(--gold-primary) via-(--gold-light) to-(--gold-primary) bg-size-[200%_auto] bg-clip-text font-[Orbitron] text-4xl font-black tracking-tighter text-transparent drop-shadow-lg animate-textShine sm:text-5xl md:text-7xl">
          Private Chats
        </h1>

        <p className="mx-auto mt-4 max-w-2xl px-2 text-base font-light tracking-tight text-zinc-500 sm:text-lg">
          Secure end-to-end encrypted conversations.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-6 sm:mt-8 sm:gap-8">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 animate-pulse rounded-full bg-(--gold-primary)" />
            <span className="text-sm font-medium text-zinc-600">
              {usersList.length} Connection{usersList.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="relative z-10 mx-auto mb-6 flex max-w-5xl flex-col items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-center sm:flex-row sm:justify-between sm:text-left">
          <p className="text-sm text-red-300">{error}</p>
          <button
            onClick={load}
            className="shrink-0 rounded-lg bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-500/30"
          >
            Retry
          </button>
        </div>
      )}

      <ul className="relative z-10 mx-auto grid max-w-5xl list-none gap-4 sm:gap-6">
        {/* AI companion card */}
        {!loading && (
          <li className="glass glass-hover group relative overflow-hidden rounded-2xl border border-(--gold-primary)/25 p-5 shadow-2xl animate-fadeIn sm:p-6 md:p-8">
            <div className="absolute left-0 top-0 h-1 w-full bg-linear-to-r from-blue-500 to-purple-500" />
            <div className="relative z-10 flex flex-col items-center justify-between gap-5 md:flex-row md:gap-6">
              <div className="flex w-full items-center gap-4 sm:gap-5 md:flex-1">
                <div className="relative shrink-0">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-blue-500 to-purple-500 text-xl font-black text-white shadow-xl transition-all duration-500 group-hover:scale-110 group-hover:rotate-6 sm:h-16 sm:w-16 sm:text-2xl">
                    AI
                  </div>
                  <span className="absolute -bottom-1 -right-1 h-4 w-4 animate-pulse rounded-full border-2 border-black bg-green-500 sm:h-5 sm:w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="mb-1 truncate text-lg font-bold text-(--gold-primary) transition-colors group-hover:text-(--gold-light) sm:text-xl md:text-2xl">
                    Emesis AI
                  </p>
                  <p className="mb-2 flex items-center gap-2 text-xs text-zinc-600 sm:text-sm">
                    <span className="truncate">Always here for you</span>
                  </p>
                  <div className="flex w-fit items-center gap-2 rounded-lg border border-blue-500/30 bg-(--dark-base)/40 px-3 py-2 text-xs text-blue-400">
                    <span>24/7 Companion • Smart Reply</span>
                  </div>
                </div>
              </div>
              <div className="w-full shrink-0 md:w-auto">
                <Link
                  href={`/chat/ai_${user.uid}`}
                  className="modern-btn flex w-full items-center justify-center gap-3 rounded-2xl bg-linear-to-r from-blue-500 to-purple-500 px-8 py-4 font-bold text-white shadow-xl shadow-blue-500/30 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/50 active:scale-95 md:w-auto"
                >
                  Chat AI
                </Link>
              </div>
            </div>
          </li>
        )}

        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <li
              key={`skeleton-${i}`}
              className="glass animate-pulse rounded-2xl border border-(--gold-primary)/20 p-5 shadow-xl sm:p-6 md:p-8"
            >
              <div className="flex items-center gap-4 sm:gap-5 md:gap-6">
                <div className="skeleton h-14 w-14 rounded-2xl sm:h-16 sm:w-16" />
                <div className="flex-1 space-y-2 sm:space-y-3">
                  <div className="skeleton h-5 w-36 rounded sm:h-6 sm:w-40" />
                  <div className="skeleton h-3.5 w-52 rounded sm:h-4 sm:w-60" />
                </div>
                <div className="skeleton h-9 w-24 rounded-xl sm:h-10 sm:w-28" />
              </div>
            </li>
          ))
        ) : usersList.length === 0 && !error ? (
          <li className="glass animate-fadeIn rounded-3xl border border-(--gold-primary)/30 p-10 text-center shadow-2xl sm:p-16">
            <div className="mb-4 text-5xl sm:text-6xl">👻</div>
            <p className="mb-2 text-xl font-bold text-(--gold-primary) sm:text-2xl">
              It&apos;s quiet here...
            </p>
            <p className="mx-auto mb-8 max-w-md text-sm text-zinc-600 sm:text-base">
              You haven&apos;t followed anyone yet. Explore the feed or confessions to
              find people to chat with!
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/feed"
                className="w-full rounded-xl bg-linear-to-r from-(--gold-primary) to-(--gold-light) px-8 py-4 text-center font-bold text-black shadow-lg transition-transform hover:scale-105 sm:w-auto"
              >
                Explore Feed
              </Link>
              <Link
                href="/confession"
                className="w-full rounded-xl bg-zinc-800 px-8 py-4 text-center font-bold text-white shadow-lg transition-all hover:scale-105 hover:bg-zinc-700 sm:w-auto"
              >
                Read Confessions
              </Link>
            </div>
          </li>
        ) : (
          usersList.map((u) => {
            const chatId = [user.uid, u.id].sort().join("_");
            const online = isUserOnline(u.lastSeen);

            return (
              <li
                key={u.id}
                className="glass glass-hover group relative overflow-hidden rounded-2xl border border-(--gold-primary)/25 p-5 shadow-2xl animate-fadeIn sm:p-6 md:p-8"
              >
                <div className="absolute left-0 top-0 h-1 w-full bg-linear-to-r from-green-500 to-emerald-500" />

                <div className="relative z-10 flex flex-col items-center justify-between gap-5 md:flex-row md:gap-6">
                  <div className="flex w-full items-center gap-4 sm:gap-5 md:flex-1">
                    <div className="relative shrink-0">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-green-500 to-emerald-500 text-xl font-black text-black shadow-xl transition-all duration-500 group-hover:scale-110 group-hover:rotate-6 sm:h-16 sm:w-16 sm:text-2xl">
                        {u.username?.[0]?.toUpperCase() || "U"}
                      </div>
                      {online && (
                        <span className="absolute -bottom-1 -right-1 h-4 w-4 animate-pulse rounded-full border-2 border-black bg-green-500 sm:h-5 sm:w-5" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="mb-1 truncate text-lg font-bold text-(--gold-primary) transition-colors group-hover:text-(--gold-light) sm:text-xl md:text-2xl">
                        {u.username || "No Name"}
                      </p>
                      <p className="mb-2 flex flex-wrap items-center gap-2 text-xs text-zinc-600 sm:text-sm">
                        <span className="truncate">{maskEmail(u.email)}</span>
                        <span className="rounded-full bg-(--gold-primary)/10 px-2 py-0.5 text-xs text-(--gold-primary)">
                          {online ? "Online" : "Connected"}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="w-full shrink-0 md:w-auto">
                    <Link
                      href={`/chat/${chatId}`}
                      className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-xl border border-white/10 bg-white/5 px-6 py-3 backdrop-blur-md transition-all duration-300 hover:border-(--gold-primary)/30 hover:bg-white/10 md:w-auto"
                    >
                      <span className="absolute inset-0 bg-linear-to-r from-(--gold-primary)/20 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                      <span className="relative z-10 font-medium text-zinc-300 transition-colors group-hover:text-(--gold-primary)">
                        Open Chat
                      </span>
                      <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/5 transition-all duration-300 group-hover:bg-(--gold-primary) group-hover:text-black">
                        <svg
                          className="h-4 w-4 -rotate-45 transition-transform duration-300 group-hover:rotate-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M14 5l7 7m0 0l-7 7m7-7H3"
                          />
                        </svg>
                      </span>
                    </Link>
                  </div>
                </div>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}