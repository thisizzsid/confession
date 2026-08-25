"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../../firebase";
import {
  collection,
  getDocs,
  orderBy,
  query,
  doc,
  updateDoc,
  setDoc,
  deleteDoc,
  Firestore,
  where,
  addDoc,
  Timestamp,
} from "firebase/firestore";
import Link from "next/link";
import { useNotifications } from "../components/NotificationSetup";

export default function NotificationsPage() {
  const { user } = useAuth();
  const ctx = useNotifications() as any;
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    if (Array.isArray(ctx.items)) setItems(ctx.items);
  }, [ctx.items]);

  const load = async () => {
    if (!user || !db) return;
    const q = query(
      collection(db as Firestore, `users/${user.uid}/notifications`),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  const markRead = async (id: string) => {
    if (ctx.markRead) {
      await ctx.markRead(id);
      return;
    }
    if (!user || !db) return;
    await updateDoc(doc(db as Firestore, `users/${user.uid}/notifications/${id}`), {
      read: true,
    });
    load();
  };

  const followBack = async (fromUid: string) => {
    if (ctx.followBack) {
      await ctx.followBack(fromUid);
      return;
    }
    if (!user || !db) return;
    
    // Check if already following
    const q = query(
      collection(db as Firestore, "follows"),
      where("follower", "==", user.uid),
      where("followed", "==", fromUid)
    );
    const snap = await getDocs(q);
    
    if (!snap.empty) {
      alert("You are already following this user.");
      return;
    }

    // Create follow relationship (using same collection as FeedPage)
    await addDoc(collection(db as Firestore, "follows"), {
      follower: user.uid,
      followed: fromUid,
    });

    // Send notification to the user we are following back
    await addDoc(collection(db as Firestore, `users/${fromUid}/notifications`), {
      type: "follow",
      fromUid: user.uid,
      fromName: user.displayName || "User",
      createdAt: Timestamp.now(),
      read: false,
    });

    load();
    alert("Followed back!");
  };

  useEffect(() => {
    load();
  }, [user]);

  if (!user) return <div className="p-6">Login Required</div>;

  return (
    <div className="p-6 space-y-6 text-yellow-300">
      <h1 className="text-3xl font-bold">Notifications</h1>

      {items.length === 0 && <p>No notifications</p>}

      {items.map((n) => {
        let label = "";
        let icon = "";
        if (n.type === "like") icon = "❤️";
        if (n.type === "comment") icon = "💬";
        if (n.type === "reply") icon = "🔁";
        if (n.type === "follow") icon = "➕";
        if (n.type === "mention") icon = "💠";
        if (n.type === "theme") icon = "🎨";
        if (n.type === "campaign" || n.type === "system") icon = "📢";

        if (n.type === "like") label = "liked your post";
        if (n.type === "comment") label = "commented on your post";
        if (n.type === "reply") label = "replied to your comment";
        if (n.type === "follow") label = "followed you";
        if (n.type === "mention") label = "mentioned you";
        if (n.type === "theme") label = "updated their accent color";
        if (n.type === "campaign" || n.type === "system") label = n.message || "new update";

        return (
          <div
            key={n.id}
            className={`p-4 rounded bg-zinc-900 space-y-2 ${
              n.read ? "opacity-50" : "opacity-100"
            }`}
          >
            <p>
              {icon} <b>{n.fromName}</b> {label}
            </p>
            <p className="text-xs opacity-70">
              {n.createdAt?.toDate().toLocaleString()}
            </p>

            {/* Follow Back Button */}
            {n.type === "follow" && (
              <button
                onClick={() => followBack(n.fromUid)}
                className="bg-yellow-400 text-black px-3 py-1 rounded"
              >
                Follow Back
              </button>
            )}

            {!n.read && (
              <button
                onClick={() => markRead(n.id)}
                className="bg-yellow-500 text-black px-2 py-1 rounded text-xs"
              >
                Mark Read
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
