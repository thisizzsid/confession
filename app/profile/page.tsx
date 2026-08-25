"use client";

import { useAuth } from "../context/AuthContext";
import { db } from "../../firebase";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  updateDoc,
  Timestamp,
  Firestore,
} from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";

/* ------------------------------- Types -------------------------------- */

interface ProfileData {
  username?: string;
  bio?: string;
  photoURL?: string;
  email?: string;
  phoneNumber?: string;
  accentColor?: string;
  joined?: Timestamp | Date | string | null;
  age?: string | number;
  gender?: string;
  location?: string;
  lastDevice?: string;
}

interface Stats {
  postsPerDay: number[];
  likesPerDay: number[];
  viewsPerDay: number[];
  totalLikes: number;
  totalPosts: number;
  totalViews: number;
}

const ACCENT_PRESETS = [
  "#F5C26B",
  "#FF8A00",
  "#4ADE80",
  "#60A5FA",
  "#A78BFA",
  "#F472B6",
];

const EMPTY_STATS: Stats = {
  postsPerDay: Array(7).fill(0),
  likesPerDay: Array(7).fill(0),
  viewsPerDay: Array(7).fill(0),
  totalLikes: 0,
  totalPosts: 0,
  totalViews: 0,
};

/* ----------------------------- Utilities ------------------------------- */

const lighten = (hex: string, amt = 20) => {
  try {
    const h = hex.replace("#", "");
    const num = parseInt(h, 16);
    const r = Math.min(255, ((num >> 16) & 0xff) + amt);
    const g = Math.min(255, ((num >> 8) & 0xff) + amt);
    const b = Math.min(255, (num & 0xff) + amt);
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
  } catch {
    return hex;
  }
};

const toDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === "object" && value !== null && "seconds" in value) {
    return new Date((value as { seconds: number }).seconds * 1000);
  }
  const parsed = new Date(value as string);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const dayBucketIndex = (date: Date) => {
  const daysAgo = Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(0, Math.min(6, 6 - daysAgo));
};

/* --------------------------- Small components --------------------------- */

const VerifiedBadge = () => (
  <svg
    className="inline-block h-5 w-5 animate-badge-pop align-text-bottom text-blue-500 sm:h-6 sm:w-6"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-label="Verified profile"
  >
    <title>Verified</title>
    <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .495.083.965.238 1.4-1.272.65-2.147 2.02-2.147 3.6 0 1.457.748 2.795 1.863 3.474C3.12 16.59 3 17.29 3 18c0 2.21 1.79 4 4 4 .71 0 1.41-.12 2.026-.363.68 1.115 2.018 1.863 3.474 1.863 1.457 0 2.795-.748 3.474-1.863.614.243 1.314.363 2.026.363 2.21 0 4-1.79 4-4 0-.71-.12-1.41-.363-2.026 1.115-.68 1.863-2.017 1.863-3.474zM10 17l-4-4 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
  </svg>
);

const Sparkline = ({ values, color }: { values: number[]; color: string }) => {
  if (values.length < 2) return null;
  const max = Math.max(1, ...values);
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * 100;
      const y = 100 - (v / max) * 100;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="mt-2 h-10 w-full">
      <polyline points={points} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const StatCard = ({
  label,
  value,
  sparkline,
}: {
  label: string;
  value: number;
  sparkline?: React.ReactNode;
}) => (
  <div className="glass glass-hover rounded-2xl border border-white/10 p-4 transition-transform duration-300 hover:-translate-y-0.5">
    <div className="text-xs text-zinc-500">{label}</div>
    <div className="text-2xl font-bold text-(--gold-primary)">{value}</div>
    {sparkline}
  </div>
);

const DetailRow = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) => (
  <div className="flex items-center gap-3">
    <div className="flex h-5 w-5 shrink-0 items-center justify-center text-zinc-400">{icon}</div>
    <span className="text-zinc-400">{label}</span>
    <span className="ml-auto truncate text-(--gold-primary)">{value}</span>
  </div>
);

/* -------------------------------- Page ---------------------------------- */

export default function ProfilePage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const [data, setData] = useState<ProfileData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [isOwner, setIsOwner] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followDocId, setFollowDocId] = useState<string | null>(null);
  const [followLoading, setFollowLoading] = useState(false);

  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [accentColor, setAccentColor] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [stats, setStats] = useState<Stats>(EMPTY_STATS);

  const profileUid = searchParams.get("uid") || user?.uid || null;

  /* ------------------------------ Load data ------------------------------ */

  const load = useCallback(async () => {
    if (!user || !profileUid || !db) return;
    setLoading(true);
    setError(null);
    setNotFound(false);

    try {
      const database = db as Firestore;
      const profileRef = doc(database, "users", profileUid);
      const myFollowQ = query(
        collection(database, "follows"),
        where("follower", "==", user.uid),
        where("followed", "==", profileUid)
      );
      const followersQ = query(collection(database, "follows"), where("followed", "==", profileUid));
      const followingQ = query(collection(database, "follows"), where("follower", "==", profileUid));

      const [profileSnap, myFollowSnap, followersSnap, followingSnap] = await Promise.all([
        getDoc(profileRef),
        getDocs(myFollowQ),
        getDocs(followersQ),
        getDocs(followingQ),
      ]);

      if (!profileSnap.exists()) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const profileData = profileSnap.data() as ProfileData;
      setData(profileData);
      setIsOwner(profileUid === user.uid);
      setAccentColor(profileData.accentColor || null);

      if (!myFollowSnap.empty) {
        setIsFollowing(true);
        setFollowDocId(myFollowSnap.docs[0].id);
      } else {
        setIsFollowing(false);
        setFollowDocId(null);
      }

      setFollowersCount(followersSnap.size);
      setFollowingCount(followingSnap.size);

      // Best-effort profile view log — never blocks the page.
      if (user.uid !== profileUid) {
        addDoc(collection(database, "profileViews"), {
          targetUid: profileUid,
          viewerUid: user.uid,
          createdAt: Timestamp.now(),
        }).catch(() => {});
      }

      // Last 7 days of activity.
      const start = Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const postsQ = query(
        collection(database, "posts"),
        where("uid", "==", profileUid),
        where("createdAt", ">", start)
      );
      const viewsQ = query(
        collection(database, "profileViews"),
        where("targetUid", "==", profileUid),
        where("createdAt", ">", start)
      );
      const [postsSnap, viewsSnap] = await Promise.all([getDocs(postsQ), getDocs(viewsQ)]);

      const postsPerDay = Array(7).fill(0);
      const likesPerDay = Array(7).fill(0);
      let totalLikes = 0;
      postsSnap.forEach((p) => {
        const pd = p.data();
        const created = toDate(pd.createdAt) ?? new Date();
        const idx = dayBucketIndex(created);
        postsPerDay[idx] += 1;
        const likesCount = Array.isArray(pd.likes) ? pd.likes.length : 0;
        likesPerDay[idx] += likesCount;
        totalLikes += likesCount;
      });

      const viewsPerDay = Array(7).fill(0);
      viewsSnap.forEach((v) => {
        const created = toDate(v.data().createdAt) ?? new Date();
        viewsPerDay[dayBucketIndex(created)] += 1;
      });

      setStats({
        postsPerDay,
        likesPerDay,
        viewsPerDay,
        totalLikes,
        totalPosts: postsSnap.size,
        totalViews: viewsSnap.size,
      });
    } catch (err) {
      console.error("Error loading profile:", err);
      setError("We couldn't load this profile. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [user, profileUid]);

  useEffect(() => {
    if (profileUid) load();
  }, [profileUid, load]);

  /* ------------------------------- Actions -------------------------------- */

  const follow = async () => {
    if (!user || !db || !profileUid || followLoading) return;
    setFollowLoading(true);
    try {
      const database = db as Firestore;
      const fQ = query(
        collection(database, "follows"),
        where("follower", "==", user.uid),
        where("followed", "==", profileUid)
      );
      const fSnap = await getDocs(fQ);

      if (!fSnap.empty) {
        setIsFollowing(true);
        setFollowDocId(fSnap.docs[0].id);
        return;
      }

      const docRef = await addDoc(collection(database, "follows"), {
        follower: user.uid,
        followed: profileUid,
        createdAt: Timestamp.now(),
      });

      addDoc(collection(database, `users/${profileUid}/notifications`), {
        type: "follow",
        fromUid: user.uid,
        fromName: user.displayName || "User",
        createdAt: Timestamp.now(),
        read: false,
      }).catch(() => {});

      setIsFollowing(true);
      setFollowDocId(docRef.id);
      setFollowersCount((prev) => prev + 1);
    } catch (err) {
      console.error("Error following user:", err);
    } finally {
      setFollowLoading(false);
    }
  };

  const unfollow = async () => {
    if (!followDocId || !db || followLoading) return;
    setFollowLoading(true);
    try {
      await deleteDoc(doc(db as Firestore, "follows", followDocId));
      setIsFollowing(false);
      setFollowDocId(null);
      setFollowersCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Error unfollowing user:", err);
    } finally {
      setFollowLoading(false);
    }
  };

  const saveAccentColor = async (hex: string) => {
    if (!isOwner || !db || !profileUid) return;
    const previous = accentColor;
    setAccentColor(hex); // optimistic
    try {
      await updateDoc(doc(db as Firestore, "users", profileUid), { accentColor: hex });
      addDoc(collection(db as Firestore, `users/${profileUid}/notifications`), {
        type: "theme",
        fromUid: profileUid,
        message: "Accent color updated",
        createdAt: Timestamp.now(),
        read: false,
      }).catch(() => {});
    } catch (err) {
      console.error("Error saving accent color:", err);
      setAccentColor(previous);
    }
  };

  const shareProfile = async () => {
    if (!profileUid || typeof window === "undefined") return;
    const url = `${window.location.origin}/profile?uid=${profileUid}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Error copying profile link:", err);
    }
  };

  /* ------------------------------ Derived data ----------------------------- */

  const isVerified = useMemo(() => {
    if (!data) return false;
    const hasName = !!data.username;
    const hasBio = !!data.bio;
    const hasAvatar = !!data.photoURL;
    const hasEmail = !!(data.email || (isOwner && user?.email));
    const hasPhone = !!(data.phoneNumber || (isOwner && user?.phoneNumber));
    return hasName && hasBio && hasAvatar && hasEmail && hasPhone;
  }, [data, isOwner, user]);

  const displayJoined = useMemo(() => {
    const date = toDate(data?.joined);
    return date ? date.toLocaleDateString() : "N/A";
  }, [data?.joined]);

  const chatId = useMemo(
    () => (user && profileUid ? [user.uid, profileUid].sort().join("_") : null),
    [user, profileUid]
  );

  /* -------------------------------- States -------------------------------- */

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-6 text-center text-(--gold-primary)">
        Login Required
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-black px-6 text-center text-(--gold-primary)">
        <div className="text-5xl">🔍</div>
        <p className="text-xl font-bold">Profile not found</p>
        <p className="max-w-sm text-sm text-zinc-500">
          This user doesn&apos;t exist or may have deleted their account.
        </p>
        <Link href="/feed" className="mt-2 rounded-xl bg-(--gold-primary) px-6 py-2.5 font-bold text-black transition hover:bg-(--gold-light)">
          Back to Feed
        </Link>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex min-h-screen items-center justify-center bg-black text-(--gold-primary)"
      >
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-(--gold-primary) border-t-transparent" />
        <span className="sr-only">Loading profile…</span>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black px-6 text-center text-(--gold-primary)">
        <p>{error}</p>
        <button
          onClick={load}
          className="rounded-xl bg-(--gold-primary) px-6 py-2.5 font-bold text-black transition hover:bg-(--gold-light)"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  /* -------------------------------- Render -------------------------------- */

  return (
    <div
      className="flex min-h-screen flex-col items-center bg-linear-to-br from-[#0A0A0A] via-black to-[#0A0A0A] px-4 py-10 text-(--gold-primary) sm:px-6 md:px-6 md:py-16"
      style={accentColor ? ({ "--gold-primary": accentColor } as React.CSSProperties) : undefined}
    >
      <div className="w-full max-w-5xl animate-fadeIn">
        {/* Hero */}
        <div className="glass relative mb-6 overflow-hidden rounded-3xl border border-white/10 sm:mb-8">
          <div className="absolute inset-0 bg-linear-to-r from-(--gold-primary)/20 via-transparent to-(--gold-light)/10 opacity-20" />
          <div className="relative flex flex-col items-center gap-6 p-6 sm:p-10 md:flex-row md:items-end">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border border-(--gold-primary)/30 bg-linear-to-br from-(--gold-primary)/15 to-transparent text-3xl font-bold shadow-lg shadow-(--gold-primary)/10 sm:h-28 sm:w-28">
              {data.username ? data.username.charAt(0).toUpperCase() : "?"}
            </div>

            <div className="w-full min-w-0 flex-1">
              <div className="flex flex-col items-center justify-between gap-4 sm:flex-row sm:items-end sm:gap-6">
                <div className="min-w-0 text-center sm:text-left">
                  <h1 className="flex flex-wrap items-center justify-center gap-2 text-3xl font-black tracking-tight text-(--gold-secondary) sm:justify-start sm:text-4xl">
                    {data.username || "No Username"}
                    {isVerified && <VerifiedBadge />}
                  </h1>
                  <p className="mt-1 text-xs text-zinc-500 sm:text-sm">Joined {displayJoined}</p>
                </div>

                <div className="flex w-full items-center justify-center gap-2 sm:w-auto sm:justify-end">
                  <button
                    onClick={shareProfile}
                    type="button"
                    aria-label="Copy profile link"
                    className="shrink-0 rounded-xl border border-white/10 bg-white/5 p-2.5 text-zinc-300 transition hover:border-(--gold-primary)/30 hover:text-(--gold-primary) active:scale-95"
                    title={copied ? "Copied!" : "Share profile"}
                  >
                    {copied ? (
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342a4 4 0 100-2.684m0 2.684a4 4 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a4 4 0 105.367-5.367 4 4 0 00-5.367 5.367zm0 6.684a4 4 0 105.367 5.367 4 4 0 00-5.367-5.367z" />
                      </svg>
                    )}
                  </button>

                  {!isOwner && chatId && (
                    <Link
                      href={`/chat/${chatId}`}
                      aria-label="Message user"
                      className="flex-1 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-center font-semibold text-zinc-200 transition hover:border-(--gold-primary)/30 hover:text-(--gold-primary) active:scale-95 sm:flex-none"
                    >
                      Message
                    </Link>
                  )}

                  {isOwner ? (
                    <Link
                      href="/profile/edit"
                      aria-label="Edit profile"
                      className="flex-1 rounded-xl bg-(--gold-primary) px-6 py-2.5 text-center font-bold text-black shadow-lg shadow-(--gold-primary)/20 transition hover:bg-(--gold-light) active:scale-95 sm:flex-none"
                    >
                      Edit Profile
                    </Link>
                  ) : isFollowing ? (
                    <button
                      onClick={unfollow}
                      type="button"
                      disabled={followLoading}
                      aria-label="Unfollow user"
                      className="flex-1 rounded-xl bg-red-500/90 px-6 py-2.5 font-bold text-white shadow-lg shadow-red-500/20 transition hover:bg-red-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
                    >
                      {followLoading ? "..." : "Unfollow"}
                    </button>
                  ) : (
                    <button
                      onClick={follow}
                      type="button"
                      disabled={followLoading}
                      aria-label="Follow user"
                      className="flex-1 rounded-xl bg-(--gold-primary) px-6 py-2.5 font-bold text-black shadow-lg shadow-(--gold-primary)/20 transition hover:bg-(--gold-light) active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
                    >
                      {followLoading ? "..." : "Follow"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 flex flex-col items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-center sm:flex-row sm:justify-between sm:text-left">
            <p className="text-sm text-red-300">{error}</p>
            <button
              onClick={load}
              className="shrink-0 rounded-lg bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-500/30"
            >
              Retry
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:mb-8 sm:gap-4 lg:grid-cols-5">
          <StatCard label="Followers" value={followersCount} />
          <StatCard label="Following" value={followingCount} />
          <StatCard
            label="Posts (7d)"
            value={stats.totalPosts}
            sparkline={<Sparkline values={stats.postsPerDay} color={accentColor || "#F5C26B"} />}
          />
          <StatCard
            label="Likes (7d)"
            value={stats.totalLikes}
            sparkline={<Sparkline values={stats.likesPerDay} color={lighten(accentColor || "#F5C26B", 25)} />}
          />
          <StatCard
            label="Views (7d)"
            value={stats.totalViews}
            sparkline={<Sparkline values={stats.viewsPerDay} color={lighten(accentColor || "#F5C26B", -40)} />}
          />
        </div>

        {/* Theme Options (owner only) */}
        {isOwner && (
          <div className="glass mb-6 rounded-3xl border border-white/10 p-6 sm:mb-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Accent Theme</h2>
              <span className="text-xs text-zinc-500">Personalize your profile</span>
            </div>
            <div className="flex flex-wrap gap-3">
              {ACCENT_PRESETS.map((hex) => (
                <button
                  key={hex}
                  aria-label={`Set accent color ${hex}`}
                  aria-pressed={accentColor === hex}
                  onClick={() => saveAccentColor(hex)}
                  type="button"
                  style={{ backgroundColor: hex }}
                  className={`h-9 w-9 rounded-full border transition-transform hover:scale-110 active:scale-95 ${
                    accentColor === hex ? "ring-2 ring-white/80" : "border-white/20"
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Details */}
        <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
          <div className="glass rounded-3xl border border-white/10 p-6">
            <h3 className="mb-4 text-sm uppercase tracking-widest text-zinc-500">Profile</h3>
            <div className="space-y-3 text-sm">
              <DetailRow
                icon={<Image src="/age.png" width={20} height={20} alt="" />}
                label="Age"
                value={data.age ?? "N/A"}
              />
              <DetailRow
                icon={<Image src="/gender.png" width={20} height={20} alt="" />}
                label="Gender"
                value={data.gender || "N/A"}
              />
              <DetailRow
                icon={<Image src="/location.png" width={20} height={20} alt="" />}
                label="Location"
                value={data.location || "N/A"}
              />
              <DetailRow
                icon={
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                    <line x1="12" y1="18" x2="12" y2="18" />
                  </svg>
                }
                label="Last Device"
                value={data.lastDevice || "Unknown"}
              />
            </div>
          </div>
          <div className="glass rounded-3xl border border-white/10 p-6">
            <h3 className="mb-4 text-sm uppercase tracking-widest text-zinc-500">Bio</h3>
            <p className="text-[15px] leading-relaxed text-(--gold-secondary)">{data.bio || "No bio added"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}