"use client";

import { useAuth } from "../context/AuthContext";
import { db } from "../../firebase";
import {
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  where,
  arrayUnion,
  arrayRemove,
  getDoc,
  Firestore,
  onSnapshot,
  Unsubscribe,
  increment
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

export default function Comments({ postId, postAuthorId }: { postId: string, postAuthorId?: string }) {
  const { user } = useAuth();
  const [comments, setComments] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [sortMode, setSortMode] = useState<"top" | "new" | "old" | "controversial">("top");
  const [page, setPage] = useState(1);
  const pageSize = 100;
  const usedReplies = useMemo(
    () => comments.filter((c) => c.uid === user?.uid && c.parentId).length,
    [comments, user]
  );
  const remainingReplies = Math.max(0, 3 - usedReplies);

  const load = async () => {
    if (!db) return;
    const q = query(
      collection(db as Firestore, `posts/${postId}/comments`),
      orderBy("createdAt", "asc")
    );
    const snap = await getDocs(q);
    const arr: any[] = [];
    snap.forEach((d) =>
      arr.push({
        id: d.id,
        upvotes: d.data().upvotes || [],
        downvotes: d.data().downvotes || [],
        parentId: d.data().parentId || null,
        ...d.data(),
      })
    );
    setComments(arr);
  };

  const submit = async () => {
    if (!user || !text.trim() || !db) return;
    await addDoc(collection(db as Firestore, `posts/${postId}/comments`), {
      uid: user.uid,
      username: user.displayName || "User",
      text,
      createdAt: Timestamp.now(),
      upvotes: [],
      downvotes: [],
      parentId: null,
    });

    // Notify post author
    if (postAuthorId && postAuthorId !== user.uid) {
        await addDoc(collection(db as Firestore, `users/${postAuthorId}/notifications`), {
          type: "comment",
          fromUid: user.uid,
          fromName: user.displayName || "Someone",
          message: `commented on your post`,
          createdAt: Timestamp.now(),
          read: false,
          postId,
        });
    }

    setText("");
    await load();
    await notifyMentions(text);
  };

  const beginEdit = (c: any) => {
    setEditId(c.id);
    setEditText(c.text);
  };

  const saveEdit = async () => {
    if (!editId || !editText.trim() || !db) return;
    await updateDoc(doc(db as Firestore, `posts/${postId}/comments/${editId}`), {
      text: editText,
      editedAt: Timestamp.now(),
    });
    setEditId(null);
    setEditText("");
    await load();
  };

  const remove = async (id: string) => {
    if (!db) return;
    await deleteDoc(doc(db as Firestore, `posts/${postId}/comments/${id}`));
    await load();
  };

  const submitReply = async (parentId: string) => {
    if (!user || !(replyTexts[parentId] || "").trim() || remainingReplies <= 0 || !db) return;
    await addDoc(collection(db as Firestore, `posts/${postId}/comments`), {
      uid: user.uid,
      username: user.displayName || "User",
      text: replyTexts[parentId],
      createdAt: Timestamp.now(),
      upvotes: [],
      downvotes: [],
      parentId,
    });

    // Update comment count on post
    const postRef = doc(db as Firestore, "posts", postId);
    await updateDoc(postRef, {
      commentCount: increment(1)
    });

    setReplyTexts((r) => ({ ...r, [parentId]: "" }));
    await load();
    await notifyMentions(replyTexts[parentId] || "");
    
    // Notify post author about reply
    if (postAuthorId && postAuthorId !== user.uid) {
        await addDoc(collection(db as Firestore, `users/${postAuthorId}/notifications`), {
          type: "reply",
          fromUid: user.uid,
          fromName: user.displayName || "Someone",
          message: `replied to your post`,
          createdAt: Timestamp.now(),
          read: false,
          postId,
        });
    }

    // Also notify parent comment author if different from post author and requester
    const parent = comments.find((c) => c.id === parentId);
    if (parent && parent.uid && parent.uid !== user.uid && parent.uid !== postAuthorId) {
        await addDoc(collection(db as Firestore, `users/${parent.uid}/notifications`), {
          type: "reply",
          fromUid: user.uid,
          fromName: user.displayName || "Someone",
          message: `replied to your comment`,
          createdAt: Timestamp.now(),
          read: false,
          postId,
          commentId: parentId,
        });
    }
  };

  const notifyMentions = async (content: string) => {
    if (!db) return;
    const matches = content.match(/@([A-Za-z0-9_]+)/g) || [];
    const unique = Array.from(new Set(matches.map((m) => m.slice(1))));
    for (const uname of unique) {
      const q = query(collection(db as Firestore, "users"), where("username", "==", uname));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const target = snap.docs[0].data() as any;
        const toUid = target.uid || snap.docs[0].id;
        await addDoc(collection(db as Firestore, `users/${toUid}/notifications`), {
          type: "mention",
          fromUid: user?.uid,
          message: `You were mentioned in a comment`,
          createdAt: Timestamp.now(),
          read: false,
          postId,
        });
      }
    }
  };

  const vote = async (comment: any, dir: 1 | -1) => {
    if (!user || !db) return;
    const ref = doc(db as Firestore, `posts/${postId}/comments/${comment.id}`);
    const isUp = dir === 1;
    const hasUp = (comment.upvotes || []).includes(user.uid);
    const hasDown = (comment.downvotes || []).includes(user.uid);
    if (isUp) {
      if (hasUp) {
        await updateDoc(ref, { upvotes: arrayRemove(user.uid) });
      } else {
        await updateDoc(ref, {
          upvotes: arrayUnion(user.uid),
          downvotes: arrayRemove(user.uid),
        });
      }
    } else {
      if (hasDown) {
        await updateDoc(ref, { downvotes: arrayRemove(user.uid) });
      } else {
        await updateDoc(ref, {
          downvotes: arrayUnion(user.uid),
          upvotes: arrayRemove(user.uid),
        });
      }
    }
    await load();
  };

  const score = (c: any) => (c.upvotes?.length || 0) - (c.downvotes?.length || 0);
  const controversy = (c: any) => {
    const up = c.upvotes?.length || 0;
    const down = c.downvotes?.length || 0;
    return up + down - Math.abs(up - down);
  };

  const timeAgo = (t: any) => {
    try {
      const ms =
        t?.seconds != null ? t.seconds * 1000 : t?.toDate ? t.toDate().getTime() : Date.parse(t);
      const diff = Date.now() - ms;
      const s = Math.floor(diff / 1000);
      if (s < 60) return `${s}s ago`;
      const m = Math.floor(s / 60);
      if (m < 60) return `${m}m ago`;
      const h = Math.floor(m / 60);
      if (h < 24) return `${h}h ago`;
      const d = Math.floor(h / 24);
      return `${d}d ago`;
    } catch {
      return "";
    }
  };

  const renderMD = (content: string) => {
    const parts = content.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|https?:\/\/\S+)/g);
    return (
      <>
        {parts.map((p, i) => {
          if (p.startsWith("`") && p.endsWith("`")) return <code key={i} className="bg-black/40 px-1 rounded">{p.slice(1, -1)}</code>;
          if (p.startsWith("**") && p.endsWith("**")) return <strong key={i}>{p.slice(2, -2)}</strong>;
          if ((p.startsWith("*") && p.endsWith("*")) || (p.startsWith("_") && p.endsWith("_"))) return <em key={i}>{p.slice(1, -1)}</em>;
          if (p.startsWith("http")) return <Link key={i} href={p} className="underline text-(--gold-primary)" target="_blank">{p}</Link>;
          return <span key={i}>{p}</span>;
        })}
      </>
    );
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="mt-4 border-t border-(--gold-primary)/10 pt-3 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span>Sort</span>
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as any)}
            className="bg-zinc-900 border border-(--gold-primary)/20 rounded px-2 py-1 text-xs"
            aria-label="Comment sort"
          >
            <option value="top">Top</option>
            <option value="new">Newest</option>
            <option value="old">Oldest</option>
            <option value="controversial">Controversial</option>
          </select>
        </div>
        <div className="text-xs text-zinc-600">
          Reply credits: <span className="text-(--gold-primary) font-semibold">{remainingReplies}</span>/3
        </div>
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 bg-black/50 border border-(--gold-primary)/20 rounded-lg px-4 py-3 text-base sm:text-sm"
          placeholder="Add a comment (markdown supported)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Add a comment"
        />
        <button
          onClick={submit}
          type="button"
          className="bg-(--gold-primary) text-black px-5 py-3 rounded-lg text-sm font-bold hover:bg-(--gold-secondary) active:scale-95 transition-all shrink-0"
          aria-label="Post comment"
        >
          Send
        </button>
      </div>

      {(() => {
        const byParent: Record<string, any[]> = {};
        comments.forEach((c) => {
          const p = c.parentId || "__root__";
          byParent[p] = byParent[p] || [];
          byParent[p].push(c);
        });
        const root = (byParent["__root__"] || []).slice(0);
        root.sort((a, b) => {
          if (sortMode === "top") return score(b) - score(a);
          if (sortMode === "new") return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
          if (sortMode === "old") return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
          return controversy(b) - controversy(a);
        });
        const renderItem = (c: any, depth: number) => {
          const children = (byParent[c.id] || []).slice(0);
          children.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
          const canEdit =
            user?.uid === c.uid &&
            ((Date.now() - ((c.createdAt?.seconds || 0) * 1000)) < 10 * 60 * 1000);
          const isExpanded = expanded[c.id] ?? true;
          return (
            <div key={c.id} className="rounded-2xl border border-(--gold-primary)/15 bg-black/40 p-3 md:p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-linear-to-br from-(--gold-primary)/30 to-(--gold-light)/20 flex items-center justify-center text-black font-bold shrink-0">
                    {(c.username || "U")?.[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-(--gold-primary) font-semibold truncate">{c.username || "User"}</div>
                    <div className="text-[10px] text-zinc-600">{timeAgo(c.createdAt)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 bg-zinc-900/50 p-1 rounded-xl border border-white/5">
                  <button
                    type="button"
                    onClick={() => vote(c, 1)}
                    className={`min-w-8 h-8 rounded-lg flex items-center justify-center transition-all ${c.upvotes?.includes(user?.uid) ? 'bg-(--gold-primary) text-black shadow-lg shadow-(--gold-primary)/20' : 'text-zinc-500 hover:text-zinc-300'}`}
                    aria-label="Upvote"
                  >
                    ▲
                  </button>
                  <div className="text-xs font-bold w-6 text-center text-(--gold-primary)">{score(c)}</div>
                  <button
                    type="button"
                    onClick={() => vote(c, -1)}
                    className={`min-w-8 h-8 rounded-lg flex items-center justify-center transition-all ${c.downvotes?.includes(user?.uid) ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'text-zinc-500 hover:text-zinc-300'}`}
                    aria-label="Downvote"
                  >
                    ▼
                  </button>
                </div>
              </div>
              {editId === c.id ? (
                <div className="space-y-2">
                  <textarea
                    className="w-full bg-black/50 border border-(--gold-primary)/20 rounded-lg px-3 py-2 text-sm"
                    placeholder="Edit comment"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    aria-label="Edit comment text"
                  />
                  <div className="flex gap-3 text-xs">
                    <button
                      onClick={saveEdit}
                      type="button"
                      className="bg-(--gold-primary) text-black px-3 py-1 rounded-lg font-bold"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditId(null)}
                      type="button"
                      className="border border-zinc-600 px-3 py-1 rounded-lg"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-(--gold-primary) leading-relaxed whitespace-pre-wrap">
                  {renderMD(c.text || "")}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs mt-2">
                {remainingReplies > 0 && (
                  <button
                    type="button"
                    onClick={() => setReplyTexts((r) => ({ ...r, [c.id]: r[c.id] ?? "" }))}
                    className="px-3 py-1.5 rounded-lg bg-black/50 border border-(--gold-primary)/20 text-(--gold-primary) hover:bg-(--gold-primary)/10 active:scale-95 transition"
                    aria-label="Reply"
                  >
                    Reply
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setExpanded((e) => ({ ...e, [c.id]: !isExpanded }))}
                  className="px-3 py-1.5 rounded-lg bg-black/50 border border-(--gold-primary)/20 text-zinc-400 hover:bg-(--gold-primary)/10 active:scale-95 transition"
                  aria-label="Toggle thread"
                >
                  {isExpanded ? "Collapse" : "Expand"}
                </button>
                {canEdit && user?.uid === c.uid && (
                  <button
                    type="button"
                    onClick={() => beginEdit(c)}
                    className="px-2 py-1 text-(--gold-primary) hover:underline"
                    aria-label="Edit"
                  >
                    Edit
                  </button>
                )}
                {user?.uid === c.uid && (
                  <button
                    type="button"
                    onClick={() => remove(c.id)}
                    className="px-2 py-1 text-red-400 hover:underline"
                    aria-label="Delete"
                  >
                    Delete
                  </button>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    if (!db) return;
                    const reason = prompt("Report reason") || "inappropriate";
                    await addDoc(collection(db as Firestore, `posts/${postId}/comments/${c.id}/reports`), {
                      uid: user?.uid,
                      reason,
                      createdAt: Timestamp.now(),
                    });
                    alert("Reported");
                  }}
                  className="px-2 py-1 text-zinc-500 hover:text-zinc-400"
                  aria-label="Report"
                >
                  Report
                </button>
              </div>
              {replyTexts[c.id] !== undefined && remainingReplies > 0 && (
                <div className="mt-3 flex gap-2">
                  <input
                    className="flex-1 bg-black/50 border border-(--gold-primary)/20 rounded-lg px-4 py-3 text-base sm:text-sm"
                    placeholder="Write a reply"
                    value={replyTexts[c.id]}
                    onChange={(e) =>
                      setReplyTexts((r) => ({ ...r, [c.id]: e.target.value }))
                    }
                    aria-label="Reply text"
                  />
                  <button
                    type="button"
                    onClick={() => submitReply(c.id)}
                    className="bg-(--gold-primary) text-black px-4 py-2 rounded-lg text-sm font-bold hover:bg-(--gold-secondary) shrink-0"
                    aria-label="Submit reply"
                  >
                    Send
                  </button>
                </div>
              )}
              {isExpanded && children.length > 0 && (
                <div className="mt-2 pl-4 border-l-2 border-(--gold-primary)/10 space-y-2">
                  {children.slice(0, page * pageSize).map((child) => renderItem(child, depth + 1))}
                  {children.length > page * pageSize && (
                    <button
                      type="button"
                      onClick={() => setPage((p) => p + 1)}
                      className="text-xs text-zinc-500 hover:text-(--gold-primary)"
                      aria-label="Load more replies"
                    >
                      Load more
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        };
        return (
          <div className="space-y-3">
            {root.slice(0, page * pageSize).map((c) => renderItem(c, 0))}
            {root.length > page * pageSize && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => setPage((p) => p + 1)}
                  className="text-xs text-zinc-500 hover:text-(--gold-primary)"
                  aria-label="Load more comments"
                >
                  Load more comments
                </button>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
