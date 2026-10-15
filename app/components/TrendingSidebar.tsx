"use client";

import { useEffect, useState } from "react";
import { db } from "../../firebase";
import { collection, query, orderBy, limit, getDocs, Firestore } from "firebase/firestore";
import Link from "next/link";
import { Hash, TrendingUp } from "lucide-react";

export default function TrendingSidebar() {
  const [trendingTags, setTrendingTags] = useState<{ tag: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrending = async () => {
      if (!db) return;
      try {
        // Fetch last 50 posts to calculate "trending"
        const q = query(collection(db as Firestore, "posts"), orderBy("createdAt", "desc"), limit(50));
        const snap = await getDocs(q);
        
        const tagCounts: { [key: string]: number } = {};
        
        snap.forEach((doc) => {
          const data = doc.data();
          if (data.hashtags && Array.isArray(data.hashtags)) {
            data.hashtags.forEach((tag: string) => {
              const normalizedTag = tag.toLowerCase(); // Case insensitive
              tagCounts[normalizedTag] = (tagCounts[normalizedTag] || 0) + 1;
            });
          }
        });

        const sortedTags = Object.entries(tagCounts)
          .map(([tag, count]) => ({ tag, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5); // Top 5

        setTrendingTags(sortedTags);
      } catch (error) {
        console.error("Error fetching trending tags:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrending();
  }, []);

  if (loading) {
    return (
      <div className="hidden lg:block w-80 p-6">
        <div className="glass rounded-2xl p-6 border border-(--gold-primary)/20 animate-pulse">
          <div className="h-6 w-32 bg-(--gold-primary)/20 rounded mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-4 w-full bg-(--gold-primary)/10 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (trendingTags.length === 0) return null;

  return (
    <div className="hidden lg:block w-80 pl-6 sticky top-24 self-start">
      <div className="trending-panel glass rounded-2xl p-6 border border-(--gold-primary)/20 shadow-xl shadow-(--gold-primary)/5">
        <h3 className="text-xl font-bold text-(--gold-primary) mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" /> Trending
        </h3>
        <div className="space-y-2">
          {trendingTags.map(({ tag, count }) => (
            <Link
              key={tag}
              href={`/explore?tag=${tag.replace('#', '')}`}
              aria-label={`Open trending tag ${tag} with ${count} posts`}
              className="group flex items-center justify-between rounded-xl px-3 py-2 transition-all hover:bg-(--gold-primary)/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--gold-primary)"
            >
              <span className="flex items-center gap-2 text-zinc-400 group-hover:text-(--gold-light) transition-colors font-medium">
                <Hash className="w-4 h-4" />
                {tag}
              </span>
              <span className="text-[10px] bg-(--gold-primary)/10 text-(--gold-primary) px-2 py-1 rounded-full group-hover:bg-(--gold-primary) group-hover:text-black transition-all">
                {count} posts
              </span>
            </Link>
          ))}
        </div>
        
        <div className="mt-6 pt-6 border-t border-(--gold-primary)/10">
          <p className="text-xs text-zinc-400 text-center">
            Topics people are whispering about right now.
          </p>
        </div>
      </div>
    </div>
  );
}
