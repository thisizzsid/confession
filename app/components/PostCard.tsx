"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { db } from "../../firebase";
import { doc, updateDoc, deleteDoc, arrayUnion, arrayRemove, Timestamp, getDoc, Firestore, addDoc, collection } from "firebase/firestore";
import Comments from "./Comments";
import { Heart, MessageCircle, Share2, Pencil, Trash2, Smartphone, Monitor, MapPin, Copy, Check } from "lucide-react";

import { extractHashtags } from "../lib/utils";

interface PostCardProps {
  post: any;
  user: any;
  isFollowing: boolean;
  onFollow: (uid: string) => Promise<void>;
  onUnfollow: (uid: string) => Promise<void>;
  onRefresh: () => void;
}

export default function PostCard({ post, user, isFollowing, onFollow, onUnfollow, onRefresh }: PostCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(post.text);
  const [showComments, setShowComments] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareProgress, setShareProgress] = useState(0);
  const shareBtnRef = useRef<HTMLButtonElement | null>(null);
  const shareMenuRef = useRef<HTMLDivElement | null>(null);

  const like = async () => {
    if (!user || !db) return;
    const ref = doc(db as Firestore, "posts", post.id);
    const hasLiked = Array.isArray(post.likes) && post.likes.includes(user.uid);
    
    await updateDoc(ref, {
      likes: hasLiked ? arrayRemove(user.uid) : arrayUnion(user.uid)
    });

    if (!hasLiked && post.uid !== user.uid) {
      await addDoc(collection(db as Firestore, `users/${post.uid}/notifications`), {
        type: "like",
        fromUid: user.uid,
        fromName: user.displayName || "Someone",
        message: `liked your post`,
        createdAt: Timestamp.now(),
        read: false,
        postId: post.id
      });
    }

    onRefresh();
  };

  const removePost = async () => {
    if (!confirm("Are you sure you want to delete this post?")) return;
    if (!db) return;
    setLoading(true);
    await deleteDoc(doc(db as Firestore, "posts", post.id));
    setLoading(false);
    onRefresh();
  };

  const reportPost = async () => {
    if (!confirm("Report this post for community guideline violations?")) return;
    if (!db || !user) return;
    await addDoc(collection(db as Firestore, `posts/${post.id}/reports`), {
      uid: user.uid,
      reason: "Inappropriate content",
      createdAt: Timestamp.now()
    });
    alert("Thank you. Our moderators will review this post.");
  };

  const saveEdit = async () => {
    if (!editText.trim() || !user || !db) return;
    setLoading(true);
    const ref = doc(db as Firestore, "posts", post.id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
        setLoading(false);
        return;
    }

    const old = snap.data();
    const newHashtags = extractHashtags(editText);
    
    await updateDoc(ref, {
      ...old,
      text: editText,
      hashtags: newHashtags,
      updatedAt: Timestamp.now()
    });

    setIsEditing(false);
    setLoading(false);
    onRefresh();
  };

  const renderTextWithHashtags = (text: string) => {
    const parts = text.split(/(#[\w\u0590-\u05ff]+)/gi);
    return parts.map((part, i) => {
      if (part.startsWith("#")) {
        return (
          <Link
          key={i}
          href={`/explore?tag=${part.replace('#', '')}`}
          className="text-(--gold-light) font-bold hover:text-(--gold-primary) hover:underline cursor-pointer transition-colors z-10 relative"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </Link>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!shareOpen) return;
      const target = e.target as Node;
      if (shareMenuRef.current && shareMenuRef.current.contains(target)) return;
      if (shareBtnRef.current && shareBtnRef.current.contains(target)) return;
      setShareOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (!shareOpen) return;
      if (e.key === "Escape") {
        setShareOpen(false);
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const items = shareMenuRef.current?.querySelectorAll<HTMLButtonElement>('[data-menuitem="true"]');
        if (!items || items.length === 0) return;
        const focusedIndex = Array.from(items).findIndex((el) => el === document.activeElement);
        let nextIndex = focusedIndex;
        if (e.key === "ArrowDown") nextIndex = Math.min(items.length - 1, focusedIndex + 1);
        else nextIndex = Math.max(0, focusedIndex - 1);
        items[nextIndex].focus();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [shareOpen]);

  useEffect(() => {
    if (shareOpen) {
      const first = shareMenuRef.current?.querySelector<HTMLButtonElement>('[data-menuitem="true"]');
      first?.focus();
    }
  }, [shareOpen]);

  const wrapText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
    const words = text.split(/\s+/);
    let line = "";
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + " ";
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, x, y);
        line = words[n] + " ";
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, y);
    return y;
  };

  const generateShareCard = async (platform: "instagramStory" | "whatsapp" | "generic") => {
    // Standardize output resolution to avoid memory issues on mobile
    // We don't need devicePixelRatio here because we are generating a static image file with fixed dimensions
    const size = platform === "instagramStory" ? { w: 1080, h: 1920 } : platform === "whatsapp" ? { w: 1024, h: 1024 } : { w: 1200, h: 1800 };
    const canvas = document.createElement("canvas");
    canvas.width = size.w;
    canvas.height = size.h;
    const ctx = canvas.getContext("2d")!;
    // No scaling needed since we work with direct pixel values corresponding to the target resolution

    // Get theme colors
    const style = getComputedStyle(document.documentElement);
    const goldPrimary = style.getPropertyValue('--gold-primary').trim() || "#F5C26B";
    const goldLight = style.getPropertyValue('--gold-light').trim() || "#FFD56A";
    const goldPrimaryRgb = style.getPropertyValue('--gold-primary-rgb').trim() || "245,194,107";

    const grd = ctx.createLinearGradient(0, 0, size.w, size.h);
    grd.addColorStop(0, "#0A0A0A");
    grd.addColorStop(0.5, "#121212");
    grd.addColorStop(1, "#1A1A1A");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, size.w, size.h);
    ctx.fillStyle = `rgba(${goldPrimaryRgb},0.08)`;
    ctx.beginPath();
    ctx.arc(size.w * 0.2, size.h * 0.25, size.w * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(0,240,255,0.06)";
    ctx.beginPath();
    ctx.arc(size.w * 0.85, size.h * 0.85, size.w * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(size.w * 0.08, size.h * 0.1, size.w * 0.84, size.h * 0.8);
    ctx.strokeStyle = `rgba(${goldPrimaryRgb},0.2)`;
    ctx.lineWidth = 3;
    ctx.strokeRect(size.w * 0.08, size.h * 0.1, size.w * 0.84, size.h * 0.8);
    ctx.font = `bold ${Math.floor(size.w * 0.06)}px Inter, -apple-system, BlinkMacSystemFont, sans-serif`;
    const titleGradient = ctx.createLinearGradient(0, 0, size.w, 0);
    titleGradient.addColorStop(0, goldPrimary);
    titleGradient.addColorStop(1, goldLight);
    ctx.fillStyle = titleGradient;
    ctx.fillText("CONFESSION", size.w * 0.1, size.h * 0.18);
    ctx.font = `normal ${Math.floor(size.w * 0.05)}px Inter, -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.fillStyle = goldLight;
    const maxTextWidth = size.w * 0.8;
    const startY = size.h * 0.25;
    const endY = wrapText(ctx, post.text, size.w * 0.1, startY, maxTextWidth, Math.floor(size.w * 0.07));
    ctx.font = `600 ${Math.floor(size.w * 0.04)}px Inter, -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.fillStyle = `rgba(${goldPrimaryRgb},0.9)`;
    ctx.fillText("Confession · SA Studios (USA)", size.w * 0.1, Math.min(size.h * 0.9, endY + size.w * 0.2));
    return await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/png", 0.95));
  };

  const nativeShare = async (blob: Blob, text: string) => {
    const file = new File([blob], "confession-share.png", { type: "image/png" });
    if (typeof navigator !== "undefined" && "share" in navigator) {
      const canFiles = (navigator as any).canShare ? (navigator as any).canShare({ files: [file] }) : true;
      if (canFiles) {
        await (navigator as any).share({ files: [file], text });
        return true;
      }
      await (navigator as any).share({ text });
      return true;
    }
    return false;
  };

  const openDeepLink = (platform: "whatsapp" | "instagram", text: string) => {
    if (platform === "whatsapp") {
      const t = encodeURIComponent(text);
      const link = `https://wa.me/?text=${t}`;
      window.location.href = link;
      return;
    }
    if (platform === "instagram") {
      window.location.href = "instagram://app";
    }
  };

  const downloadBlob = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "confession-share.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleShare = async (platform: "instagramStory" | "whatsapp" | "generic") => {
    try {
      setSharing(true);
      setShareProgress(0);
      const start = performance.now();
      const duration = 700;
      const step = (t: number) => {
        const elapsed = t - start;
        const pct = Math.min(100, Math.floor((elapsed / duration) * 100));
        setShareProgress(pct);
        if (elapsed < duration) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      const blob = await generateShareCard(platform);
      const text = post.text;
      const used = await nativeShare(blob, text);
      if (used) {
        setSharing(false);
        setShareOpen(false);
        return;
      }
      if (platform === "whatsapp") {
        openDeepLink("whatsapp", text);
      } else if (platform === "instagramStory") {
        downloadBlob(blob);
        // Instagram deep link might fail if app not installed or protocol not supported in browser context
        // Try-catch block around openDeepLink or just handle it gracefully
        try {
            openDeepLink("instagram", text);
        } catch (e) {
            console.warn("Could not open Instagram", e);
        }
      } else {
        downloadBlob(blob);
      }
      setSharing(false);
      setShareOpen(false);
    } catch {
      setSharing(false);
    }
  };

  useEffect(() => {
    try {
      document.documentElement.style.setProperty("--progress-width", `${shareProgress}%`);
    } catch {}
  }, [shareProgress]);

  return (
    <div className="group relative w-full rounded-3xl bg-[#0a0a0a] border border-white/5 shadow-2xl overflow-hidden transition-all duration-500 hover:shadow-[0_0_40px_-10px_color-mix(in_srgb,var(--gold-primary),transparent_85%)] hover:border-(--gold-primary)/20">
        {/* Subtle background gradient */}
        <div className="absolute inset-0 bg-linear-to-b from-white/2 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
        
        {/* Top highlight line */}
        <div className="absolute top-0 left-0 w-full h-px bg-linear-to-r from-transparent via-(--gold-primary)/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        <div className="relative p-6 sm:p-8">
            {/* Header Section */}
            <div className="flex items-start justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    {/* Avatar / User Icon */}
                    <div className="w-10 h-10 rounded-full bg-linear-to-br from-(--gold-primary)/10 to-transparent border border-(--gold-primary)/10 flex items-center justify-center shrink-0">
                        {post.anonymous ? (
                            <span className="text-lg">👻</span>
                        ) : (
                            <div className="w-full h-full rounded-full bg-zinc-800 flex items-center justify-center text-(--gold-primary) font-bold text-sm">
                                {post.username?.[0]?.toUpperCase() || "U"}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            {post.anonymous ? (
                                <span className="text-sm font-semibold text-zinc-300 tracking-wide">Anonymous</span>
                            ) : (
                                <Link href={`/profile?uid=${post.uid}`} className="text-sm font-semibold text-zinc-200 hover:text-(--gold-primary) transition-colors tracking-wide">
                                    @{post.username}
                                </Link>
                            )}
                            
                            {/* Time */}
                            {post.createdAt && (
                                <>
                                    <span className="text-zinc-700 text-[10px]">•</span>
                                    <span className="text-[11px] text-zinc-500 font-medium">
                                        {new Date(post.createdAt.seconds * 1000).toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                        })}
                                    </span>
                                </>
                            )}
                        </div>

                        {/* Location & Device Metadata */}
                        {(post.location || post.device) && (
                            <div className="flex items-center gap-3 text-[10px] text-zinc-500 mt-0.5">
                                {post.location && (
                                    <div className="flex items-center gap-1 group/loc">
                                        <MapPin className="w-3 h-3 text-zinc-600 group-hover/loc:text-(--gold-primary) transition-colors" />
                                        <span className="truncate max-w-30 group-hover/loc:text-zinc-400 transition-colors">{post.location}</span>
                                    </div>
                                )}
                                {post.device && (
                                    <div className="flex items-center gap-1 group/dev" title={`Posted from ${post.device}`}>
                                        {post.device === "iPhone" || post.device === "Android" ? (
                                            <Smartphone className="w-3 h-3 text-zinc-600 group-hover/dev:text-(--gold-primary) transition-colors" />
                                        ) : (
                                            <Monitor className="w-3 h-3 text-zinc-600 group-hover/dev:text-(--gold-primary) transition-colors" />
                                        )}
                                        <span className="group-hover/dev:text-zinc-400 transition-colors">{post.device}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Options Menu */}
                <div className="relative z-20">
                    <button 
                        type="button"
                        onClick={() => setMenuOpen(!menuOpen)}
                        className="p-2 -mr-2 text-zinc-500 hover:text-(--gold-primary) hover:bg-(--gold-primary)/5 rounded-full transition-all"
                    >
                        <span className="text-lg leading-none">⋮</span>
                    </button>
                    
                    {menuOpen && (
                        <div className="absolute right-0 top-full mt-2 bg-[#0F0F0F] border border-white/10 rounded-xl shadow-2xl overflow-hidden w-40 z-30 animate-fadeIn">
                            {user?.uid !== post.uid && (
                                <button 
                                    type="button"
                                    onClick={() => { reportPost(); setMenuOpen(false); }} 
                                    className="w-full px-4 py-2.5 text-left text-xs font-medium text-zinc-300 hover:text-red-400 hover:bg-white/5 transition-colors flex items-center gap-2"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    Report
                                </button>
                            )}
                            {user?.uid === post.uid && (
                                <>
                                    <button 
                                        type="button"
                                        onClick={() => { setEditText(post.text); setIsEditing(true); setMenuOpen(false); }} 
                                        className="w-full px-4 py-2.5 text-left text-xs font-medium text-zinc-300 hover:text-(--gold-primary) hover:bg-white/5 transition-colors flex items-center gap-2 border-b border-white/5"
                                    >
                                        <Pencil className="w-3.5 h-3.5" />
                                        Edit
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => { removePost(); setMenuOpen(false); }} 
                                        className="w-full px-4 py-2.5 text-left text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors flex items-center gap-2"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        Delete
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Content Section */}
            {isEditing ? (
                <div className="animate-fadeIn relative z-10">
                    <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="w-full bg-zinc-900/50 p-4 rounded-xl border border-(--gold-primary)/20 text-(--gold-secondary) text-[15px] leading-relaxed focus:outline-none focus:ring-1 focus:ring-(--gold-primary) transition-all min-h-30 resize-none"
                        placeholder="Edit your confession..."
                    />
                    <div className="mt-3 flex gap-2 justify-end">
                        <button 
                            type="button"
                            onClick={() => setIsEditing(false)} 
                            className="px-4 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            type="button"
                            onClick={saveEdit} 
                            disabled={loading}
                            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-(--gold-primary) text-black hover:bg-(--gold-light) transition-colors disabled:opacity-50"
                        >
                            {loading ? "Saving..." : "Save"}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="relative z-10 mb-6">
                    <p className="text-(--gold-secondary) text-[15px] sm:text-[16px] leading-relaxed font-light whitespace-pre-wrap tracking-wide">
                        {renderTextWithHashtags(post.text)}
                    </p>
                </div>
            )}

            {/* Action Bar */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-5 border-t border-white/5">
                {post.uid !== user?.uid && (
                    isFollowing ? (
                        <button 
                            type="button"
                            onClick={() => onUnfollow(post.uid)} 
                            className="flex-1 sm:flex-none h-11 px-4 rounded-lg bg-(--gold-primary)/5 text-(--gold-primary) border border-(--gold-primary)/10 text-xs font-semibold hover:bg-(--gold-primary)/10 transition-all"
                        >
                            Following
                        </button>
                    ) : (
                        <button 
                            type="button"
                            onClick={() => onFollow(post.uid)} 
                            className="flex-1 sm:flex-none h-11 px-4 rounded-lg bg-(--gold-primary) text-black text-xs font-bold hover:bg-(--gold-light) hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-(--gold-primary)/10"
                        >
                            Follow
                        </button>
                    )
                )}

                <button 
                    type="button"
                    onClick={like} 
                    className={`flex-1 sm:flex-none h-11 px-4 rounded-lg flex items-center justify-center gap-2 text-xs font-medium transition-all ${
                        post.likes?.includes(user?.uid) 
                        ? "bg-red-500/10 text-red-400 border border-red-500/20" 
                        : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200 border border-transparent"
                    }`}
                >
                    <Heart className={`w-4 h-4 ${post.likes?.includes(user?.uid) ? "fill-current" : ""}`} />
                    <span>{post.likes?.length || 0}</span>
                </button>

                <button 
                    type="button"
                    onClick={() => setShowComments(!showComments)} 
                    className="flex-1 sm:flex-none h-11 px-4 rounded-lg bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200 transition-all flex items-center justify-center gap-2 text-xs font-medium"
                >
                    <MessageCircle className="w-4 h-4" />
                    <span>{post.commentCount > 0 ? post.commentCount : "Comment"}</span>
                </button>

                <div className="relative flex-1 sm:flex-none">
                    <button
                        type="button"
                        onClick={() => setShareOpen((v) => !v)}
                        className="w-full sm:w-auto h-11 px-4 rounded-lg bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-(--gold-primary) transition-all flex items-center justify-center gap-2 text-xs font-medium group/share"
                        ref={shareBtnRef}
                    >
                        <Share2 className="w-4 h-4 group-hover/share:scale-110 transition-transform" />
                        <span>Share</span>
                    </button>
                    
                    {shareOpen && (
                        <div
                            ref={shareMenuRef}
                            className="absolute bottom-full right-0 mb-2 w-48 bg-[#0F0F0F] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-30 animate-fadeIn"
                        >
                            <button onClick={() => handleShare("instagramStory")} className="w-full px-4 py-3 text-left text-xs text-zinc-300 hover:bg-white/5 hover:text-white transition-colors border-b border-white/5 flex items-center gap-2">
                              <Image src="/instagram.svg" width={14} height={14} alt="IG" className="opacity-70" />
                              Instagram Story
                            </button>
                            <button onClick={() => handleShare("whatsapp")} className="w-full px-4 py-3 text-left text-xs text-zinc-300 hover:bg-white/5 hover:text-white transition-colors border-b border-white/5 flex items-center gap-2">
                              <Image src="/whatsapp.svg" width={14} height={14} alt="WA" className="opacity-70" />
                              WhatsApp
                            </button>
                            <button 
                              onClick={() => {
                                navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`);
                                setShareOpen(false);
                                alert("Link copied to clipboard!");
                              }} 
                              className="w-full px-4 py-3 text-left text-xs text-zinc-300 hover:bg-white/5 hover:text-white transition-colors border-b border-white/5 flex items-center gap-2"
                            >
                              <Copy className="w-3.5 h-3.5 opacity-70" />
                              Copy Link
                            </button>
                            <button onClick={() => handleShare("generic")} className="w-full px-4 py-3 text-left text-xs text-zinc-300 hover:bg-white/5 hover:text-white transition-colors flex items-center gap-2">
                              <Share2 className="w-3.5 h-3.5 opacity-70" />
                              Download Image
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {showComments && (
                <div className="mt-4 pt-4 border-t border-(--gold-primary)/10 animate-fadeIn">
                    <Comments postId={post.id} postAuthorId={post.uid} />
                </div>
            )}

            {sharing && (
              <div className="mt-4 glass rounded-xl p-4 animate-fadeIn">
                <div className="font-semibold text-sm mb-2">Preparing share card...</div>
                <div className="progress-bar">
                  <div className="progress-bar-fill" />
                </div>
              </div>
            )}
        </div>
    </div>
  );
}
