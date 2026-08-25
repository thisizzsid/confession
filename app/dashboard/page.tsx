"use client";

import { useEffect, useState } from "react";
import { db } from "../../firebase";
import { useAuth } from "../context/AuthContext";
import {
  collection,
  query,
  where,
  getDocs,
  collectionGroup,
  Firestore,
} from "firebase/firestore";

const delayClassMap: Record<string, string> = {
  "0.1s": "animation-delay-[100ms]",
  "0.2s": "animation-delay-[200ms]",
  "0.3s": "animation-delay-[300ms]",
  "0.4s": "animation-delay-[400ms]",
  "0.5s": "animation-delay-[500ms]",
};

const widthClassMap: Record<number, string> = {
  0: "w-[0%]",
  5: "w-[5%]",
  10: "w-[10%]",
  15: "w-[15%]",
  20: "w-[20%]",
  25: "w-[25%]",
  30: "w-[30%]",
  35: "w-[35%]",
  40: "w-[40%]",
  45: "w-[45%]",
  50: "w-[50%]",
  55: "w-[55%]",
  60: "w-[60%]",
  65: "w-[65%]",
  70: "w-[70%]",
  75: "w-[75%]",
  80: "w-[80%]",
  85: "w-[85%]",
  90: "w-[90%]",
  95: "w-[95%]",
  100: "w-[100%]",
};

const progressWidthClass = (value: number) => {
  const percent = Math.min(100, Math.max(0, value));
  const step = Math.round(percent / 5) * 5;
  return widthClassMap[step] || "w-[0%]";
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    posts: 0,
    comments: 0,
    likes: 0,
    followers: 0,
    following: 0,
    views: 0,
  });
  const [loading, setLoading] = useState(true);
  const [animatedStats, setAnimatedStats] = useState({
    posts: 0,
    comments: 0,
    likes: 0,
    followers: 0,
    following: 0,
    views: 0,
  });

  const load = async () => {
    if (!user || !db) return;
    setLoading(true);

    try {
      // USER POSTS
      const postsQ = query(collection(db as Firestore, "posts"), where("uid", "==", user.uid));
      const postsSnap = await getDocs(postsQ);

      let totalLikes = 0;
      postsSnap.forEach((d) => {
        const data: any = d.data();
        if (Array.isArray(data.likes)) totalLikes += data.likes.length;
      });

      // COMMENTS by user
      let commentsCount = 0;
      try {
        const commentsQ = query(
          collectionGroup(db as Firestore, "comments"),
          where("uid", "==", user.uid)
        );
        const commentsSnap = await getDocs(commentsQ);
        commentsCount = commentsSnap.size;
      } catch (e) {
        commentsCount = 0;
      }

      // FOLLOWERS count
      let followersCount = 0;
      try {
        const followersQ = query(
          collection(db as Firestore, "follows"),
          where("followed", "==", user.uid)
        );
        const followersSnap = await getDocs(followersQ);
        followersCount = followersSnap.size;
      } catch (e) {
        followersCount = 0;
      }

      // FOLLOWING count
      let followingCount = 0;
      try {
        const followingQ = query(
          collection(db as Firestore, "follows"),
          where("follower", "==", user.uid)
        );
        const followingSnap = await getDocs(followingQ);
        followingCount = followingSnap.size;
      } catch (e) {
        followingCount = 0;
      }

      // PROFILE VIEWS
      let viewsCount = 0;
      try {
        const viewsQ = query(
          collection(db as Firestore, "profileViews"),
          where("uid", "==", user.uid)
        );
        const viewsSnap = await getDocs(viewsQ);
        viewsCount = viewsSnap.size;
      } catch (e) {
        viewsCount = 0;
      }

      const newStats = {
        posts: postsSnap.size,
        comments: commentsCount,
        likes: totalLikes,
        followers: followersCount,
        following: followingCount,
        views: viewsCount,
      };

      setStats(newStats);
      setLoading(false);

      // Animate counters
      Object.keys(newStats).forEach((key) => {
        animateCounter(key as keyof typeof stats, newStats[key as keyof typeof stats]);
      });
    } catch (error) {
      console.error("Error loading dashboard stats:", error);
      setLoading(false);
    }
  };

  // Animated counter function
  const animateCounter = (key: keyof typeof stats, target: number) => {
    const duration = 2000;
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        current = target;
        clearInterval(timer);
      }
      setAnimatedStats((prev) => ({
        ...prev,
        [key]: Math.floor(current),
      }));
    }, duration / steps);
  };

  useEffect(() => {
    load();
  }, [user]);

  if (!user) {
    return (
      <div className="h-screen bg-linear-to-br from-[#0A0A0A] via-black to-[#0A0A0A] text-(--gold-primary) flex items-center justify-center">
        <div className="glass rounded-3xl p-12 animate-bounceIn">
          <p className="text-2xl font-bold">Login Required</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-[#0A0A0A] via-black to-[#0A0A0A] text-(--gold-secondary) px-8 py-24 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute top-40 left-20 w-96 h-96 bg-(--gold-primary)/10 rounded-full blur-3xl animate-float"></div>
      <div className="absolute bottom-40 right-20 w-96 h-96 bg-[#00F0FF]/5 rounded-full blur-3xl animate-float animation-delay-2000"></div>
      
      {/* Header Section */}
      <div className="text-center mb-20 animate-fadeIn relative z-10">
        <div className="inline-block mb-4">
          <div className="w-20 h-20 rounded-2xl bg-linear-to-br from-(--gold-primary) to-(--gold-light) flex items-center justify-center shadow-2xl shadow-(--gold-primary)/50 animate-pulse-glow mx-auto">
            <span className="text-4xl">📊</span>
          </div>
        </div>
        
        <h1 className="text-7xl font-black tracking-tighter bg-linear-to-r from-(--gold-primary) via-(--gold-light) to-(--gold-primary) bg-clip-text text-transparent drop-shadow-lg mb-4 font-[Orbitron] bg-size-[200%_auto] animate-textShine">
          Your Dashboard
        </h1>
        
        <p className="mt-4 text-lg text-zinc-500 font-light tracking-tight max-w-2xl mx-auto">
          Real-time insights into your Confession journey. Track your impact, connections, and growth.
        </p>

        {/* Activity Ring */}
        <div className="mt-8 flex items-center justify-center gap-3">
          <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse shadow-lg shadow-green-500/50"></div>
          <span className="text-sm text-zinc-600 font-medium">Live Activity Monitor</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto relative z-10">
        {loading ? (
          // Loading Skeletons
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass rounded-3xl p-8 shadow-xl border border-(--gold-primary)/20 animate-pulse">
              <div className="skeleton h-6 w-32 mb-4 rounded"></div>
              <div className="skeleton h-16 w-24 mb-3 rounded"></div>
              <div className="skeleton h-4 w-40 rounded"></div>
            </div>
          ))
        ) : (
          <>
            <StatCard
              title="Confessions Posted"
              count={animatedStats.posts}
              subtitle="Your shared thoughts"
              icon="📝"
              color="from-(--gold-primary) to-(--gold-light)"
              delay="0s"
            />

            <StatCard
              title="Comments Given"
              count={animatedStats.comments}
              subtitle="Discussions you joined"
              icon="💬"
              color="from-[#00F0FF] to-[#0088FF]"
              delay="0.1s"
            />

            <StatCard
              title="Total Likes Earned"
              count={animatedStats.likes}
              subtitle="Love received across posts"
              icon="❤️"
              color="from-[#FF006E] to-[#FF4D94]"
              delay="0.2s"
            />

            <StatCard
              title="Followers"
              count={animatedStats.followers}
              subtitle="People watching you"
              icon="👥"
              color="from-[#B24BF3] to-[#D94BF3]"
              delay="0.3s"
            />

            <StatCard
              title="Following"
              count={animatedStats.following}
              subtitle="People you follow"
              icon="🌟"
              color="from-[#39FF14] to-[#00CC11]"
              delay="0.4s"
            />

            <StatCard
              title="Profile Views"
              count={animatedStats.views}
              subtitle="Curious eyes on you"
              icon="👁️"
              color="from-(--gold-light) to-(--gold-primary)"
              delay="0.5s"
            />
          </>
        )}
      </div>

      {/* Engagement Insights */}
      <div className="max-w-7xl mx-auto mt-16 relative z-10">
        <div className="glass rounded-3xl p-10 shadow-2xl border border-(--gold-primary)/30 hover:border-(--gold-primary)/50 transition-all duration-500 group">
          <h2 className="text-3xl font-bold text-(--gold-primary) mb-6 flex items-center gap-3">
            <span className="text-3xl">🎯</span>
            Engagement Score
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <EngagementMetric
              label="Activity Level"
              value={Math.min(100, (stats.posts + stats.comments) * 5)}
              color="from-(--gold-primary) to-(--gold-light)"
            />
            <EngagementMetric
              label="Social Impact"
              value={Math.min(100, (stats.likes + stats.followers) * 3)}
              color="from-[#00F0FF] to-[#0088FF]"
            />
            <EngagementMetric
              label="Reach Score"
              value={Math.min(100, (stats.views + stats.following) * 2)}
              color="from-[#FF006E] to-[#FF4D94]"
            />
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="text-center mt-16 text-zinc-600 text-sm tracking-wide relative z-10 flex items-center justify-center gap-3">
        <div className="w-2 h-2 rounded-full bg-(--gold-primary) animate-pulse"></div>
        <span>Updated in real-time • Last refresh: Just now</span>
        <div className="w-2 h-2 rounded-full bg-(--gold-primary) animate-pulse"></div>
      </div>

      <style jsx>{`
        .animation-delay-2000 {
          animation-delay: 2s;
        }
      `}</style>
    </div>
  );
}

// Stat Card Component
function StatCard({
  title,
  count,
  subtitle,
  icon,
  color,
  delay,
}: {
  title: string;
  count: number;
  subtitle: string;
  icon: string;
  color: string;
  delay: string;
}) {
  return (
    <div
      className={`glass glass-hover rounded-3xl p-8 shadow-2xl border-2 border-(--gold-primary)/25 group cursor-default relative overflow-hidden hover-card ${delayClassMap[delay] ?? ""}`}
    >
      {/* Gradient Background */}
      <div className={`absolute inset-0 bg-linear-to-br ${color} opacity-0 group-hover:opacity-10 transition-opacity duration-500`}></div>
      
      {/* Icon Badge */}
      <div className="absolute top-6 right-6 w-14 h-14 rounded-xl bg-linear-to-br from-black/40 to-black/20 flex items-center justify-center border border-(--gold-primary)/20 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
        <span className="text-2xl">{icon}</span>
      </div>

      <div className="relative z-10">
        <h2 className="text-base font-semibold text-(--gold-primary) mb-4 tracking-tight group-hover:text-(--gold-light) transition-colors duration-300">
          {title}
        </h2>
        
        <p className={`text-6xl font-black bg-linear-to-br ${color} bg-clip-text text-transparent mb-3 tracking-tighter`}>
          {count.toLocaleString()}
        </p>
        
        <p className="text-sm text-zinc-600 font-medium flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-(--gold-primary)"></span>
          {subtitle}
        </p>

        {/* Progress Bar */}
        <div className="mt-4 progress-bar">
          <div 
            className={`progress-bar-fill ${progressWidthClass(Math.min(100, count * 10))}`}
          ></div>
        </div>
      </div>
    </div>
  );
}

// Engagement Metric Component
function EngagementMetric({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="relative">
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm font-semibold text-(--gold-primary)">{label}</span>
        <span className={`text-2xl font-black bg-linear-to-r ${color} bg-clip-text text-transparent`}>
          {value}%
        </span>
      </div>
      
      {/* Circular Progress */}
      <div className="relative w-full h-3 bg-black/40 rounded-full overflow-hidden">
        <div
          className={`h-full bg-linear-to-r ${color} rounded-full transition-all duration-1000 ease-out relative overflow-hidden ${progressWidthClass(value)}`}
        >
          <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
        </div>
      </div>
      
      {/* Status Label */}
      <div className="mt-2 text-xs text-zinc-600 font-medium">
        {value >= 80 ? "🔥 Excellent" : value >= 50 ? "✨ Great" : value >= 30 ? "👍 Good" : "💪 Keep Going"}
      </div>
    </div>
  );
}
