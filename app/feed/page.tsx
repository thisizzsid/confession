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
  arrayUnion,
  arrayRemove,
  getDoc,
  Firestore,
  onSnapshot,
  Unsubscribe
} from "firebase/firestore";
import { useEffect, useState, useRef } from "react";
import { MapPin, Send, Ghost, Hash } from "lucide-react";
import Link from "next/link";
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

  useEffect(() => {
    const ua = navigator.userAgent;
    if (/iPhone/i.test(ua)) setDeviceType("iPhone");
    else if (/iPad/i.test(ua)) setDeviceType("iPad");
    else if (/Android/i.test(ua)) setDeviceType("Android");
    else setDeviceType("Web");

    detectLocation();

    if (!db) return;

    // Real-time listener
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
    }, (err) => {
      console.error("Snapshot error:", err);
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
      // AI Moderation
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

      // Update user's last used device
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

  const like = async (p: any) => {
    // Moved to PostCard
  };

  const followUser = async (uid: string) => {
    if (!user || !db || uid === user.uid) return;
    
    // Create follow relationship
    await addDoc(collection(db as Firestore, "follows"), {
      follower: user.uid,
      followed: uid,
    });

    // Send notification
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

  const [showUpcoming, setShowUpcoming] = useState(false);

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
    return true; // Global feed shows everything
  });

  if (!user) {
    return (
      <div className="h-screen bg-black text-yellow-300 flex items-center justify-center">
        Login Required
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-[#0A0A0A] via-black to-[#0A0A0A] text-(--gold-primary) px-4 md:px-6 pt-[88px] md:pt-24 pb-10">
      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-8">
        {/* LEFT COLUMN - FEED */}
        <div className="flex-1 space-y-6 min-w-0">
        
        {/* STORIES */}
        <FadeIn direction="down">
          <StoryFeature />
        </FadeIn>

        {/* WELCOME SECTION */}
        <FadeIn delay={0.1}>
          <div className="text-center mb-8 relative">
            <h1 className="text-4xl font-black tracking-tighter bg-linear-to-r from-(--gold-primary) via-(--gold-light) to-(--gold-primary) bg-clip-text text-transparent drop-shadow-lg">
              Welcome back, {user?.displayName?.split(" ")[0]}!
            </h1>

            <p className="mt-4 text-sm text-zinc-400 max-w-lg mx-auto leading-relaxed font-light tracking-tight">
              Confession is a quiet place to release thoughts you don't usually say out loud —
              <span className="text-(--gold-primary) font-medium"> no judgement, just honesty.</span>
              <span className="block mt-2 text-[10px] uppercase tracking-[0.2em] text-zinc-600 font-bold">Owned by SA Studios · Crafted in USA 🇺🇸</span>
            </p>
          </div>
        </FadeIn>

        {/* CREATE POST */}
        <FadeIn delay={0.2}>
          <HoverScale>
            <div className="relative group">
              {/* Subtle Monochrome Glow */}
              <div className="absolute -inset-0.5 bg-(--gold-primary) rounded-3xl blur-sm opacity-5 group-hover:opacity-10 transition duration-1000"></div>
              
              <div className="relative bg-[#0A0A0A] rounded-3xl border border-zinc-800 overflow-hidden">
                {/* Minimal Header */}
                <div className="px-6 py-4 border-b border-zinc-800/50 bg-zinc-900/20 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs font-mono text-zinc-500 tracking-widest uppercase">New Confession</span>
                    <span className="text-[10px] text-zinc-600 mt-0.5">Disappears in 24h</span>
                  </div>
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-zinc-800"></div>
                    <div className="w-2 h-2 rounded-full bg-zinc-800"></div>
                  </div>
                </div>

                {/* Text Area */}
                <div className="p-2">
                  <label htmlFor="post-textarea" className="sr-only">Post</label>
                  <textarea
                    id="post-textarea"
                    className="w-full bg-transparent text-lg text-zinc-200 placeholder:text-zinc-600 p-4 min-h-40 focus:outline-none resize-none font-medium leading-relaxed tracking-wide selection:bg-(--gold-primary) selection:text-black"
                    placeholder="What's on your mind?..."
                    value={text}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value)}
                  />
                </div>

                {/* Toolbar */}
                <div className="px-4 py-3 bg-zinc-900/10 border-t border-zinc-800/50 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                  {/* Tools */}
                  <div className="flex items-center gap-2 md:gap-4 overflow-x-auto no-scrollbar py-1">
                    {/* Anonymous Toggle */}
                    <button
                      onClick={() => setAnonymous(!anonymous)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 border ${
                        anonymous 
                          ? "bg-zinc-800 text-(--gold-primary) border-zinc-700" 
                          : "bg-transparent text-zinc-500 border-transparent hover:bg-zinc-900"
                      }`}
                    >
                      <Ghost className="w-3.5 h-3.5" />
                      {anonymous ? "Anonymous" : "Public"}
                    </button>

                    {/* Location Badge */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-zinc-500 text-xs font-medium whitespace-nowrap hover:bg-zinc-900 transition-colors">
                      <MapPin className="w-3.5 h-3.5" />
                      <span className="truncate max-w-30" title={location}>
                        {detectingLocation ? "Locating..." : location}
                      </span>
                    </div>

                    {/* Hashtag Counter */}
                    {extractHashtags(text).length > 0 && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 text-zinc-400 text-xs font-medium">
                        <Hash className="w-3 h-3" />
                        <span>{extractHashtags(text).length}</span>
                      </div>
                    )}
                  </div>

                  {/* Submit Button */}
                  <button
                    onClick={createPost}
                    disabled={!text.trim() || loading}
                    className="group flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-(--gold-primary) text-black font-bold tracking-tight transition-all duration-300 hover:bg-(--gold-light) active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span>{loading ? "Analyzing..." : "Post"}</span>
                    <Send className={`w-3.5 h-3.5 ${loading ? "animate-pulse" : ""}`} />
                  </button>
                </div>
              </div>
            </div>
          </HoverScale>
        </FadeIn>

        {/* FEED TOGGLE & CONTENT */}
        <FadeIn delay={0.3}>
          <div className="flex items-center justify-center gap-4 mb-6">
          <button
            onClick={() => setFeedType("local")}
            className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
              feedType === "local"
                ? "bg-(--gold-primary) text-black shadow-[0_0_15px_rgba(245,194,107,0.3)]"
                : "bg-zinc-900 text-zinc-500 hover:text-zinc-300"
            }`}
          >
            📍 Local · 2 km
          </button>
          <button
            onClick={() => setFeedType("global")}
            className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
              feedType === "global"
                ? "bg-(--gold-primary) text-black shadow-[0_0_15px_rgba(245,194,107,0.3)]"
                : "bg-zinc-900 text-zinc-500 hover:text-zinc-300"
            }`}
          >
            🌍 Global
          </button>
        </div>
        </FadeIn>

        {/* POSTS LIST */}
        <div className="space-y-6">
          {detectingLocation && feedType === "local" ? (
             <div className="text-center py-20 text-zinc-500 animate-pulse">
               <MapPin className="w-8 h-8 mx-auto mb-3 text-(--gold-primary) opacity-50" />
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
              <FadeIn key={post.id} delay={0.1 * (index % 5)}>
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

        {/* RIGHT COLUMN - TRENDING SIDEBAR */}
        <div className="hidden lg:block w-80 shrink-0">
            <TrendingSidebar />
        </div>
      </div>

      {/* TOAST NOTIFICATION */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* === MODAL === */}
      {showUpcoming && (
        <div className="fixed inset-0 bg-(--dark-base)/90 backdrop-blur-xl flex items-center justify-center z-1000 animate-fadeIn">
          <div className="glass rounded-3xl p-10 w-[90%] max-w-md text-(--gold-secondary) shadow-2xl border border-(--gold-primary)/20 animate-fadeIn">
            <h2 className="text-3xl font-black text-transparent bg-linear-to-r from-(--gold-primary) to-(--gold-light) bg-clip-text mb-6 text-center tracking-tight">
              Upcoming Features
            </h2>

            <ul className="space-y-3 text-sm leading-relaxed">
              <li>Private Chat 2.0 (Voice)</li>
              <li>Anonymous Stories</li>
              <li>Voice Confessions</li>
              <li>AI Soulmate Mode</li>
              <li>Location-based Connections</li>
              <li>Trending Feed Engine</li>
              <li>UI Upgrade</li>
              
              <li>V.3.1</li>
            </ul>

            <button
              onClick={() => setShowUpcoming(false)}
              className="modern-btn mt-8 w-full py-3 rounded-xl bg-linear-to-r from-(--gold-primary) to-(--gold-secondary) text-black font-bold hover:scale-105 active:scale-95 transition-all duration-300 shadow-lg shadow-(--gold-primary)/30"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

