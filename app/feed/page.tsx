"use client";

import { useAuth } from "../context/AuthContext";
import { db } from "../../firebase";
import {
  collection,
  addDoc,
  query,
  orderBy,
  where,
  getDocs,
  Timestamp,
  doc,
  updateDoc,
  deleteDoc,
  Firestore,
  onSnapshot,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { MapPin, Send, Ghost, Hash, Sparkles, Radio, X } from "lucide-react";
import TrendingSidebar from "../components/TrendingSidebar";
import Toast from "../components/Toast";
import PostCard from "../components/PostCard";
import StoryFeature from "../components/StoryFeature";
import { getPlaceName } from "../utils/geocoding";
import { FadeIn, HoverScale } from "../components/Motion";
import { extractHashtags, getDeviceName } from "../lib/utils";

const LOCAL_RADIUS_KM = 2;

const distanceInKm = (latitudeA: number, longitudeA: number, latitudeB: number, longitudeB: number) => {
  const earthRadiusKm = 6371;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(latitudeB - latitudeA);
  const longitudeDelta = toRadians(longitudeB - longitudeA);
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(toRadians(latitudeA)) * Math.cos(toRadians(latitudeB)) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};

export default function FeedPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [followMap, setFollowMap] = useState<{ [key: string]: boolean }>({});
  const [location, setLocation] = useState<string>("Unknown");
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [deviceType, setDeviceType] = useState<string>("Web");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [feedType, setFeedType] = useState<"local" | "global">("local");
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [showUpcoming, setShowUpcoming] = useState(false);
  const [composerFocused, setComposerFocused] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    if (/iPhone/i.test(ua)) setDeviceType("iPhone");
    else if (/iPad/i.test(ua)) setDeviceType("iPad");
    else if (/Android/i.test(ua)) setDeviceType("Android");
    else setDeviceType("Web");

    detectLocation();

    if (!db) return;

    const oneDayAgo = Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);
    const q = query(
      collection(db as Firestore, "posts"),
      where("createdAt", ">", oneDayAgo),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const arr: any[] = [];
      snap.forEach((d) => {
        const data = d.data();
        if (!Array.isArray(data.likes)) data.likes = [];
        if (!data.uid) data.uid = "unknown";
        arr.push({ id: d.id, ...data });
      });
      setPosts(arr);
      loadFollows(arr);
      setInitialLoad(false);
    }, (err) => {
      console.error("Snapshot error:", err);
      setInitialLoad(false);
    });

    return () => unsubscribe();
  }, []);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
  };

  const loadFollows = async (arr: any[]) => {
    if (!user || !db) return;
    let map: any = {};
    for (const post of arr) {
      if (post.uid === user.uid) {
        map[post.uid] = true;
        continue;
      }
      const qF = query(
        collection(db as Firestore, "follows"),
        where("follower", "==", user.uid),
        where("followed", "==", post.uid)
      );
      const sF = await getDocs(qF);
      map[post.uid] = !sF.empty;
    }
    setFollowMap(map);
  };

  const createPost = async () => {
    if (!user || !db || !text.trim()) return;

    setLoading(true);
    try {
      const modRes = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, mode: "moderate" }),
      });
      const modData = await modRes.json();

      if (modData.output?.toUpperCase().includes("UNSAFE")) {
        showToast("Your post contains content that violates our community guidelines.", "error");
        setLoading(false);
        return;
      }

      const hashtags = extractHashtags(text);
      const device = getDeviceName();
      await addDoc(collection(db as Firestore, "posts"), {
        text,
        uid: user.uid,
        username: anonymous ? "Anonymous" : user.displayName,
        anonymous,
        likes: [],
        hashtags,
        location,
        latitude: coordinates ? Number(coordinates.latitude.toFixed(3)) : null,
        longitude: coordinates ? Number(coordinates.longitude.toFixed(3)) : null,
        device,
        createdAt: Timestamp.now()
      });

      await updateDoc(doc(db as Firestore, "users", user.uid), {
        lastDevice: device
      });

      setText("");
      setAnonymous(false);
      showToast("Confession released into the void ✨");
    } catch (error) {
      console.error("Post creation error:", error);
      showToast("Failed to post. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  const followUser = async (uid: string) => {
    if (!user || !db || uid === user.uid) return;

    await addDoc(collection(db as Firestore, "follows"), {
      follower: user.uid,
      followed: uid,
    });

    await addDoc(collection(db as Firestore, `users/${uid}/notifications`), {
      type: "follow",
      fromUid: user.uid,
      fromName: user.displayName || "User",
      createdAt: Timestamp.now(),
      read: false,
    });

    setFollowMap({ ...followMap, [uid]: true });
  };

  const unfollowUser = async (uid: string) => {
    if (!user || !db) return;
    const qF = query(
      collection(db as Firestore, "follows"),
      where("follower", "==", user.uid),
      where("followed", "==", uid)
    );
    const sF = await getDocs(qF);
    if (!sF.empty) {
      await deleteDoc(doc(db as Firestore, "follows", sF.docs[0].id));
    }
    setFollowMap({ ...followMap, [uid]: false });
  };

  const detectLocation = () => {
    setDetectingLocation(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            setCoordinates({ latitude, longitude });
            const placeName = await getPlaceName(latitude, longitude);
            setLocation(placeName || "Unknown Location");
          } catch (error) {
            setLocation("Location unavailable");
          }
          setDetectingLocation(false);
        },
        () => {
          setLocation("Location disabled");
          setDetectingLocation(false);
        }
      );
    } else {
      setLocation("Location not supported");
      setDetectingLocation(false);
    }
  };

  const filteredPosts = posts.filter((post) => {
    if (feedType === "local") {
      if (!coordinates || typeof post.latitude !== "number" || typeof post.longitude !== "number") return false;
      return distanceInKm(coordinates.latitude, coordinates.longitude, post.latitude, post.longitude) <= LOCAL_RADIUS_KM;
    }
    return true;
  });

  const hashtagCount = extractHashtags(text).length;
  const charCount = text.length;
  const charLimit = 500;

  if (!user) {
    return (
      <div className="h-screen bg-black text-(--gold-primary) flex flex-col items-center justify-center gap-3">
        <Ghost className="w-10 h-10 opacity-40" />
        <p className="text-sm tracking-widest uppercase text-zinc-500">Login Required</p>
      </div>
    );
  }

  return (
    <div className="feed-page relative min-h-screen bg-(--background) text-(--foreground) px-4 md:px-6 pt-[88px] md:pt-24 pb-10 overflow-hidden">

      {/* AMBIENT BACKGROUND */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-linear-to-b from-(--background) via-(--dark-elevated) to-(--background)" />
        <div className="absolute top-[-10%] left-[10%] w-[420px] h-[420px] rounded-full bg-(--gold-primary)/[0.06] blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[5%] w-[380px] h-[380px] rounded-full bg-(--gold-primary)/[0.04] blur-[120px]" />
        <div className="feed-dot-grid absolute inset-0 opacity-[0.025]" />
      </div>

      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-8">
        {/* LEFT COLUMN — FEED */}
        <div className="flex-1 space-y-6 min-w-0">

          <FadeIn direction="down">
            <StoryFeature />
          </FadeIn>

          {/* WELCOME */}
          <FadeIn delay={0.1}>
            <div className="text-center mb-6 relative">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-zinc-800 bg-zinc-950/60 mb-4">
                <Radio className="w-3 h-3 text-(--gold-primary) animate-pulse" />
                <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-bold">
                  Live · {posts.length} confessions today
                </span>
              </div>

              <h1 className="text-3xl md:text-4xl font-black tracking-tighter bg-linear-to-r from-(--gold-primary) via-(--gold-light) to-(--gold-primary) bg-clip-text text-transparent drop-shadow-lg">
                Welcome back, {user?.displayName?.split(" ")[0]}
              </h1>

              <p className="mt-3 text-sm text-zinc-400 max-w-lg mx-auto leading-relaxed font-light tracking-tight">
                A quiet place to release thoughts you don't usually say out loud —
                <span className="text-(--gold-primary) font-medium"> no judgement, just honesty.</span>
              </p>
              <span className="block mt-3 text-[10px] uppercase tracking-[0.25em] text-zinc-700 font-bold">
                Owned by SA Studios · Crafted in USA 🇺🇸
              </span>
            </div>
          </FadeIn>

          {/* COMPOSER */}
          <FadeIn delay={0.2}>
            <HoverScale>
              <div className="relative group">
                <div
                  className={`absolute -inset-px rounded-3xl blur-md transition-opacity duration-500 ${
                    composerFocused ? "opacity-30" : "opacity-0"
                  } bg-linear-to-r from-(--gold-primary)/40 via-(--gold-light)/30 to-(--gold-primary)/40`}
                />

                <div className="relative bg-(--dark-card) rounded-3xl border border-(--dark-border) group-hover:border-(--gold-primary) transition-colors duration-300 overflow-hidden">

                  <div className="px-6 py-4 border-b border-zinc-800/50 bg-linear-to-r from-zinc-900/40 to-transparent flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-(--gold-primary)/10 border border-(--gold-primary)/20 flex items-center justify-center">
                        <Sparkles className="w-3.5 h-3.5 text-(--gold-primary)" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-mono text-zinc-400 tracking-widest uppercase">New Confession</span>
                        <span className="text-[10px] text-zinc-600">Disappears in 24h</span>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-zinc-800" />
                      <div className="w-1.5 h-1.5 rounded-full bg-zinc-800" />
                      <div className="w-1.5 h-1.5 rounded-full bg-zinc-800" />
                    </div>
                  </div>

                  <div className="p-2">
                    <label htmlFor="post-textarea" className="sr-only">Post</label>
                    <textarea
                      id="post-textarea"
                      className="w-full bg-transparent text-lg text-zinc-200 placeholder:text-zinc-600 p-4 min-h-36 focus:outline-none resize-none font-medium leading-relaxed tracking-wide selection:bg-(--gold-primary) selection:text-black"
                      placeholder="What's on your mind?..."
                      value={text}
                      maxLength={charLimit}
                      onFocus={() => setComposerFocused(true)}
                      onBlur={() => setComposerFocused(false)}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value)}
                    />
                  </div>

                  <div className="px-4 py-3 bg-zinc-900/10 border-t border-zinc-800/50 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                      <button
                        onClick={() => setAnonymous(!anonymous)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 border whitespace-nowrap ${
                          anonymous
                            ? "bg-(--gold-primary)/10 text-(--gold-primary) border-(--gold-primary)/30"
                            : "bg-transparent text-zinc-500 border-transparent hover:bg-zinc-900"
                        }`}
                      >
                        <Ghost className="w-3.5 h-3.5" />
                        {anonymous ? "Anonymous" : "Public"}
                      </button>

                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-zinc-500 text-xs font-medium whitespace-nowrap hover:bg-zinc-900 transition-colors">
                        <MapPin className="w-3.5 h-3.5" />
                        <span className="truncate max-w-30" title={location}>
                          {detectingLocation ? "Locating..." : location}
                        </span>
                      </div>

                      {hashtagCount > 0 && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 text-(--gold-primary) text-xs font-medium whitespace-nowrap">
                          <Hash className="w-3 h-3" />
                          <span>{hashtagCount}</span>
                        </div>
                      )}

                      {charCount > 0 && (
                        <span
                          className={`text-[10px] font-mono whitespace-nowrap ${
                            charCount > charLimit * 0.9 ? "text-red-400" : "text-zinc-600"
                          }`}
                        >
                          {charCount}/{charLimit}
                        </span>
                      )}
                    </div>

                    <button
                      onClick={createPost}
                      disabled={!text.trim() || loading}
                      className="group/btn flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-(--gold-primary) text-black font-bold tracking-tight transition-all duration-300 hover:bg-(--gold-light) hover:shadow-[0_0_20px_rgba(245,194,107,0.35)] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none"
                    >
                      <span>{loading ? "Analyzing..." : "Post"}</span>
                      <Send className={`w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-0.5 ${loading ? "animate-pulse" : ""}`} />
                    </button>
                  </div>
                </div>
              </div>
            </HoverScale>
          </FadeIn>

          {/* FEED TOGGLE — sliding pill */}
          <FadeIn delay={0.3}>
            <div className="flex items-center justify-center">
              <div className="relative inline-flex p-1 rounded-full bg-zinc-950 border border-zinc-800">
                <div
                  className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full bg-(--gold-primary) shadow-[0_0_15px_rgba(245,194,107,0.3)] transition-transform duration-300 ease-out"
                  data-feed-type={feedType}
                />
                <button
                  onClick={() => setFeedType("local")}
                  className={`relative z-10 px-5 py-2 rounded-full text-sm font-bold transition-colors duration-300 ${
                    feedType === "local" ? "text-black" : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  📍 Local · 2 km
                </button>
                <button
                  onClick={() => setFeedType("global")}
                  className={`relative z-10 px-5 py-2 rounded-full text-sm font-bold transition-colors duration-300 ${
                    feedType === "global" ? "text-black" : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  🌍 Global
                </button>
              </div>
            </div>
          </FadeIn>

          {/* POSTS LIST */}
          <div className="space-y-6 pt-2">
            {initialLoad ? (
              <div className="space-y-4">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className={`feed-skeleton feed-skeleton-${i} h-32 rounded-2xl border border-zinc-800/60 bg-zinc-950 animate-pulse`}
                  />
                ))}
              </div>
            ) : detectingLocation && feedType === "local" ? (
              <div className="text-center py-20 text-zinc-500">
                <MapPin className="w-8 h-8 mx-auto mb-3 text-(--gold-primary) opacity-50 animate-pulse" />
                <p>Triangulating local signals...</p>
              </div>
            ) : filteredPosts.length === 0 ? (
              <div className="text-center py-20 text-zinc-600">
                <Ghost className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium text-zinc-500">
                  {feedType === "local"
                    ? (location && !location.includes("Unknown") && !location.includes("disabled")
                        ? `No confessions in ${location} yet.`
                        : "Location needed to see local confessions.")
                    : "The void is silent..."}
                </p>
                <p className="text-sm mt-2 opacity-50">Be the first to whisper into the ether.</p>
              </div>
            ) : (
              filteredPosts.map((post, index) => (
                <FadeIn key={post.id} delay={0.06 * (index % 6)}>
                  <PostCard
                    post={post}
                    user={user}
                    isFollowing={!!followMap[post.uid]}
                    onFollow={() => followUser(post.uid)}
                    onUnfollow={() => unfollowUser(post.uid)}
                    onRefresh={() => {}}
                  />
                </FadeIn>
              ))
            )}
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="hidden lg:block w-80 shrink-0">
          <div className="sticky top-24">
            <TrendingSidebar />
          </div>
        </div>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {showUpcoming && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-1000 animate-fadeIn px-4">
          <div className="relative w-full max-w-md rounded-3xl border border-(--gold-primary)/20 bg-[#0A0A0A] shadow-2xl overflow-hidden">
            <div className="feed-modal-glow absolute inset-0 pointer-events-none" />

            <button
              onClick={() => setShowUpcoming(false)}
              aria-label="Close upcoming features"
              className="absolute top-4 right-4 p-1.5 rounded-full text-zinc-500 hover:text-(--gold-primary) hover:bg-zinc-900 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="relative p-8">
              <h2 className="text-2xl font-black text-transparent bg-linear-to-r from-(--gold-primary) to-(--gold-light) bg-clip-text mb-6 text-center tracking-tight">
                Upcoming Features
              </h2>

              <ul className="space-y-2.5 text-sm leading-relaxed">
                {[
                  "TURN relay for reliable calls",
                  "Voice confessions",
                  "Smarter notification controls",
                  "Community spaces",
                  "Account export and deletion tools",
                  "More languages and accessibility options",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-zinc-300">
                    <span className="w-1 h-1 rounded-full bg-(--gold-primary)" />
                    {item}
                  </li>
                ))}
                <li className="pt-2 text-[10px] uppercase tracking-widest text-zinc-600 font-bold">V.3.1</li>
              </ul>

              <button
                onClick={() => setShowUpcoming(false)}
                className="mt-8 w-full py-3 rounded-xl bg-linear-to-r from-(--gold-primary) to-(--gold-light) text-black font-bold hover:scale-[1.02] active:scale-95 transition-all duration-300 shadow-lg shadow-(--gold-primary)/20"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}