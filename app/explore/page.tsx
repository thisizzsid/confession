"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { db } from "../../firebase";
import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  setDoc,
  deleteDoc,
  addDoc,
  Timestamp,
  where,
  limit,
  Firestore
} from "firebase/firestore";
import Link from "next/link";
import PostCard from "../components/PostCard";

export default function ExplorePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-gold-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      }
    >
      <ExploreContent />
    </Suspense>
  );
}

function ExploreContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const initialTag = searchParams.get("tag");

  const [viewMode, setViewMode] = useState<"users" | "posts">(initialTag ? "posts" : "users");
  const [usersList, setUsersList] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [search, setSearch] = useState(initialTag || "");
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [trendingTags, setTrendingTags] = useState<{ tag: string; count: number }[]>([]);
  const [followingList, setFollowingList] = useState<string[]>([]);
  const [followersList, setFollowersList] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  
  const uid = user?.uid;

  const notifyFollow = async (toUid: string) => {
    if (!uid || toUid === uid || !db) return;
    await addDoc(collection(db as Firestore, `users/${toUid}/notifications`), {
      type: "follow",
      fromUid: uid,
      fromName: user?.displayName ?? "Unknown",
      createdAt: Timestamp.now(),
      read: false,
    });
  };

  const loadUsers = async () => {
    if (!uid || !db) return;
    setLoading(true);

    // USERS
    const arr: any[] = [];
    const usersSnap = await getDocs(query(collection(db as Firestore, "users"), orderBy("username")));
    usersSnap.forEach((d) => {
      if (d.id !== uid) {
        arr.push({ id: d.id, ...d.data() });
      }
    });
    setUsersList(arr);
    
    // Filter immediately if search is active
    if (search && viewMode === "users") {
        const keyword = search.toLowerCase();
        setFilteredUsers(arr.filter(u => 
            u.username?.toLowerCase().includes(keyword) || 
            u.displayName?.toLowerCase().includes(keyword)
        ));
    } else {
        setFilteredUsers([]);
    }

    // FOLLOWING from root follows
    const followingQ = query(
      collection(db as Firestore, "follows"),
      where("follower", "==", uid)
    );
    const followingSnap = await getDocs(followingQ);
    setFollowingList(followingSnap.docs.map((d) => d.data().followed));

    // FOLLOWERS from root follows
    const followersQ = query(
      collection(db as Firestore, "follows"),
      where("followed", "==", uid)
    );
    const followersSnap = await getDocs(followersQ);
    setFollowersList(followersSnap.docs.map((d) => d.data().follower));
    
    setLoading(false);
  };

  const loadPosts = async () => {
    if (!uid || !db) return;
    setLoading(true);
    const oneDayAgo = Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);

    try {
        // Fetch all posts (24h filter)
        // Note: Ideally use a composite index for where(createdAt > oneDayAgo) + orderBy(createdAt)
        // For robustness without index, we'll fetch recent and filter client-side if needed, 
        // or try the query first.
        
        let q = query(
            collection(db as Firestore, "posts"),
            where("createdAt", ">", oneDayAgo),
            orderBy("createdAt", "desc"),
            limit(50)
        );

        // Try executing the query
        let snap;
        try {
            snap = await getDocs(q);
        } catch (err) {
            // Fallback if index missing
            console.warn("Index missing for explore, falling back to client-side filter");
            const qFallback = query(
                collection(db as Firestore, "posts"),
                orderBy("createdAt", "desc"),
                limit(100)
            );
            snap = await getDocs(qFallback);
        }

        const arr: any[] = [];
        const tagCounts: Record<string, number> = {};

        snap.forEach((d) => {
            const data = d.data();
            const createdAtMillis = data.createdAt?.toMillis ? data.createdAt.toMillis() : (data.createdAt?.seconds ? data.createdAt.seconds * 1000 : 0);
            if (createdAtMillis > oneDayAgo.toMillis()) {
                arr.push({ id: d.id, ...data });
                if (data.hashtags && Array.isArray(data.hashtags)) {
                    data.hashtags.forEach((tag: string) => {
                        const normalized = tag.toLowerCase();
                        tagCounts[normalized] = (tagCounts[normalized] || 0) + 1;
                    });
                }
            }
        });

        // Filter by search keyword/tag if present
        let filteredArr = arr;
        if (search && search.trim()) {
          const keyword = search.toLowerCase().trim().replace("#", "");
          filteredArr = arr.filter(p => {
             const textMatch = p.text?.toLowerCase().includes(keyword);
             const hashtagMatch = p.hashtags?.some((t: string) => t.toLowerCase().includes(keyword));
             return textMatch || hashtagMatch;
          });
        }

        setPosts(filteredArr);
        setTrendingTags(
            Object.entries(tagCounts)
                .map(([tag, count]) => ({ tag, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10)
        );

        // Also load following list to update UI state for PostCard
        const followingQ = query(
          collection(db as Firestore, "follows"),
          where("follower", "==", uid)
        );
        const followingSnap = await getDocs(followingQ);
        setFollowingList(followingSnap.docs.map((d) => d.data().followed));

      } catch (error) {
          console.error("Error loading posts:", error);
      } finally {
          setLoading(false);
      }
  };

  const runSearch = () => {
    if (viewMode === "users") {
        if (!search.trim()) {
            setFilteredUsers([]);
            return;
        }
        const keyword = search.toLowerCase();
        const f = usersList.filter(
          (u) =>
            (u.username &&
            typeof u.username === "string" &&
            u.username.toLowerCase().includes(keyword)) ||
            (u.displayName &&
            typeof u.displayName === "string" &&
            u.displayName.toLowerCase().includes(keyword))
        );
        setFilteredUsers(f);
    } else {
        loadPosts();
    }
  };

  const clearSearch = () => {
    setSearch("");
    if (viewMode === "users") {
        setFilteredUsers([]);
    } else {
        // Reload all posts? or just clear?
        // Let's reload all posts (latest)
        // Need to trigger loadPosts with empty search, but state update is async.
        // We can just call loadPosts() and it will use empty string if we pass it or wait for effect?
        // Better to just set search empty and let user hit search or auto-trigger?
        // Let's auto-trigger by calling a helper or effect.
    }
  };

  // Effect to handle mode switch or initial load
  useEffect(() => {
    if (viewMode === "users") {
        loadUsers();
    } else {
        loadPosts();
    }
  }, [viewMode, uid]); 
  
  // Effect to handle clearSearch properly
  useEffect(() => {
      if (search === "" && viewMode === "posts") {
          loadPosts();
      }
  }, [search]);


  const follow = async (targetUid: string) => {
    if (!uid || !db || targetUid === uid) return;

    // Check if already following to prevent duplicate
    const qF = query(
      collection(db as Firestore, "follows"),
      where("follower", "==", uid),
      where("followed", "==", targetUid)
    );
    const fSnap = await getDocs(qF);
    if (!fSnap.empty) {
      setFollowingList(prev => [...prev, targetUid]);
      return;
    }

    await addDoc(collection(db as Firestore, "follows"), {
      follower: uid,
      followed: targetUid,
    });
    await notifyFollow(targetUid);
    
    // Update local state immediately
    setFollowingList(prev => [...prev, targetUid]);
  };

  const unfollow = async (targetUid: string) => {
    if (!uid || !db) return;
    const qF = query(
      collection(db as Firestore, "follows"),
      where("follower", "==", uid),
      where("followed", "==", targetUid)
    );
    const sF = await getDocs(qF);
    if (!sF.empty) {
      await deleteDoc(doc(db as Firestore, "follows", sF.docs[0].id));
    }
    
    // Update local state immediately
    setFollowingList(prev => prev.filter(id => id !== targetUid));
  };

  if (!uid)
    return (
      <div className="h-screen bg-dark-base text-foreground flex items-center justify-center">
        Login Required
      </div>
    );

  return (
    <div className="min-h-screen bg-linear-to-br from-dark-base via-black to-dark-base text-(--foreground) px-8 py-24">
      <div className="text-center mb-10">
        <h1 className="text-5xl font-extrabold tracking-wider drop-shadow-lg">
          Explore
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Discover users, hashtags & hidden whispers
        </p>
      </div>

      <div className="flex justify-center gap-6 mb-12">
        <button 
            type="button"
            onClick={() => setViewMode("users")}
            className={`px-6 py-2 rounded-full font-bold transition-all ${viewMode === "users" ? "bg-(--gold-primary) text-black shadow-lg shadow-(--gold-primary)/20" : "bg-zinc-900 text-zinc-500 hover:text-(--gold-primary)"}`}
        >
            Users
        </button>
        <button 
            type="button"
            onClick={() => setViewMode("posts")}
            className={`px-6 py-2 rounded-full font-bold transition-all ${viewMode === "posts" ? "bg-(--gold-primary) text-black shadow-lg shadow-(--gold-primary)/20" : "bg-zinc-900 text-zinc-500 hover:text-(--gold-primary)"}`}
        >
            Posts / Tags
        </button>
      </div>

      <div className="max-w-xl mx-auto flex gap-3 mb-12">
        <input
          className="flex-1 bg-black/40 border border-(--gold-primary)/20 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-(--gold-light) text-(--gold-primary) placeholder-zinc-500"
          placeholder={viewMode === "users" ? "Search username..." : "Search hashtags (e.g. #love)..."}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runSearch()}
        />
        <button
          type="button"
          onClick={runSearch}
          className="bg-(--gold-primary) text-black px-5 rounded-xl font-semibold hover:bg-(--gold-light) transition"
        >
          Search
        </button>
        {search.length > 0 && (
          <button
            type="button"
            onClick={clearSearch}
            className="bg-red-500 text-black px-4 rounded-xl text-sm font-bold"
          >
            X
          </button>
        )}
      </div>

      {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-2 border-(--gold-primary) border-t-transparent rounded-full animate-spin"></div>
          </div>
      ) : (
          <>
            {/* SUGGESTIONS & TRENDING (only if no search) */}
            {!search && (
              <div className="max-w-6xl mx-auto mb-16 grid grid-cols-1 lg:grid-cols-2 gap-12">
                {/* Trending Tags */}
                <div className="glass p-8 rounded-3xl border border-(--gold-primary)/10 shadow-2xl">
                  <h2 className="text-2xl font-black text-(--gold-primary) mb-6 flex items-center gap-3">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    Trending Topics
                  </h2>
                  <div className="flex flex-wrap gap-3">
                    {trendingTags.length === 0 && <p className="text-zinc-600 text-sm italic">The void is currently silent...</p>}
                    {trendingTags.map(({ tag, count }) => (
                      <button
                        key={tag}
                        onClick={() => { setSearch(tag); setViewMode("posts"); }}
                        className="group flex items-center gap-2 bg-zinc-900/50 hover:bg-(--gold-primary) border border-(--gold-primary)/20 px-4 py-2 rounded-2xl transition-all duration-300 hover:-translate-y-1"
                      >
                        <span className="text-zinc-400 group-hover:text-black font-bold">#{tag}</span>
                        <span className="text-[10px] bg-(--gold-primary)/10 group-hover:bg-black/20 text-(--gold-primary) group-hover:text-black px-2 py-0.5 rounded-full font-black">
                          {count}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Suggested Users */}
                <div className="glass p-8 rounded-3xl border border-(--gold-primary)/10 shadow-2xl">
                  <h2 className="text-2xl font-black text-(--gold-primary) mb-6 flex items-center gap-3">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    People to Follow
                  </h2>
                  <div className="space-y-4">
                    {usersList.filter(u => !followingList.includes(u.id)).slice(0, 4).length === 0 && (
                       <p className="text-zinc-600 text-sm italic">You're already following everyone!</p>
                    )}
                    {usersList
                      .filter(u => !followingList.includes(u.id))
                      .slice(0, 4)
                      .map(u => (
                        <div key={u.id} className="flex items-center justify-between group">
                          <Link href={`/profile?uid=${u.id}`} className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-(--gold-primary) font-black border border-zinc-700 group-hover:border-(--gold-primary) transition-colors">
                              {(u.username || "U")[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-zinc-200 group-hover:text-(--gold-primary) transition-colors">{u.username}</p>
                              <p className="text-[10px] text-zinc-500 truncate max-w-30">{u.bio || "No bio yet"}</p>
                            </div>
                          </Link>
                          <button
                            onClick={() => follow(u.id)}
                            className="bg-(--gold-primary)/10 hover:bg-(--gold-primary) text-(--gold-primary) hover:text-black border border-(--gold-primary)/30 px-4 py-1.5 rounded-xl text-xs font-black transition-all active:scale-95"
                          >
                            Follow
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {viewMode === "users" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
                    {filteredUsers.length === 0 && (
                    <p className="text-center opacity-50 col-span-full">
                        {search ? "No users found matching your search." : "Search above to find users."}
                    </p>
                    )}

                    {filteredUsers.map((u) => {
                      const isFollowing = followingList.includes(u.id);
                      const followsYou = followersList.includes(u.id);
                      const isMutual = isFollowing && followsYou;

                      return (
                        <div
                        key={u.id}
                        className="
                            bg-black/50 border border-(--gold-primary)/20 p-5 rounded-2xl shadow-lg
                            hover:shadow-(--gold-primary)/20 hover:scale-[1.02]
                            transition-all duration-300 backdrop-blur-xl
                            flex flex-col h-full relative overflow-hidden group
                        "
                        >
                        <div className="flex items-start justify-between mb-3 relative z-10">
                            <div className="flex-1 min-w-0 pr-2">
                                <p className="text-lg font-bold tracking-wide text-(--gold-primary) truncate">
                                    {u.username ?? "Unknown User"}
                                </p>
                                <div className="flex flex-wrap gap-2 mt-1.5">
                                    {isMutual && (
                                        <span className="inline-flex items-center gap-1 bg-green-500/10 text-green-400 text-[10px] font-medium px-2 py-0.5 rounded-full border border-green-500/20">
                                            ✔ Mutual
                                        </span>
                                    )}
                                    {!isMutual && followsYou && (
                                        <span className="inline-flex items-center gap-1 bg-(--gold-primary)/10 text-(--gold-primary) text-[10px] font-medium px-2 py-0.5 rounded-full border border-(--gold-primary)/20">
                                            Follows You
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_2px_rgba(0,255,0,0.6)] shrink-0 mt-1.5 animate-pulse" />
                        </div>

                        <p className="text-xs text-zinc-400 line-clamp-2 mb-6 grow leading-relaxed">
                            {u.bio || "No bio written yet..."}
                        </p>

                        <div className="grid grid-cols-2 gap-3 mt-auto relative z-10">
                            {isFollowing ? (
                            <button
                                type="button"
                                onClick={() => unfollow(u.id)}
                                className="w-full h-12 flex items-center justify-center bg-red-500/10 text-red-500 border border-red-500/30 rounded-xl text-xs font-bold hover:bg-red-500 hover:text-white transition-all active:scale-95"
                            >
                                Unfollow
                            </button>
                            ) : followsYou ? (
                            <button
                                type="button"
                                onClick={() => follow(u.id)}
                                className="w-full h-12 flex items-center justify-center bg-(--gold-primary) text-black rounded-xl text-xs font-bold hover:bg-(--gold-light) hover:shadow-lg hover:shadow-(--gold-primary)/20 transition-all active:scale-95"
                            >
                                Follow Back
                            </button>
                            ) : (
                            <button
                                type="button"
                                onClick={() => follow(u.id)}
                                className="w-full h-12 flex items-center justify-center bg-(--gold-primary) text-black rounded-xl text-xs font-bold hover:bg-(--gold-light) hover:shadow-lg hover:shadow-(--gold-primary)/20 transition-all active:scale-95"
                            >
                                Follow
                            </button>
                            )}

                            {isMutual ? (
                            <Link
                                href={`/chat?uid=${u.id}`}
                                className="w-full h-12 flex items-center justify-center gap-2 bg-linear-to-r from-green-500 to-emerald-600 text-white rounded-xl text-xs font-bold hover:shadow-lg hover:shadow-green-500/30 transition-all active:scale-95"
                            >
                                <span>Chat</span>
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                            </Link>
                            ) : (
                            <Link
                                href={`/anonymous?uid=${u.id}`}
                                className="w-full h-12 flex items-center justify-center bg-zinc-800 text-(--gold-primary) rounded-xl text-xs font-bold border border-zinc-700 hover:border-(--gold-primary) transition-all active:scale-95"
                            >
                                Anon Msg
                            </Link>
                            )}
                        </div>

                        <Link
                            href={`/profile?uid=${u.id}`}
                            className="block text-center mt-3 text-[10px] text-zinc-600 uppercase tracking-widest hover:text-(--gold-primary) transition-colors py-2"
                        >
                            View Profile
                        </Link>
                        </div>
                    );
                    })}
                </div>
            ) : (
                <div className="max-w-2xl mx-auto space-y-6">
                    {posts.length === 0 && (
                        <p className="text-center opacity-50">No posts found with this tag.</p>
                    )}
                    {posts.map(p => (
                        <PostCard
                            key={p.id}
                            post={p}
                            user={user}
                            isFollowing={followingList.includes(p.uid)}
                            onFollow={follow}
                            onUnfollow={unfollow}
                            onRefresh={loadPosts}
                        />
                    ))}
                </div>
            )}
          </>
      )}
    </div>
  );
}
