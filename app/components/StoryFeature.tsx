"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/app/context/AuthContext";
import { db } from "@/firebase";
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  Timestamp, 
  Firestore 
} from "firebase/firestore";
import { Plus, X, ChevronLeft, ChevronRight, Image as ImageIcon, Type, Send, Loader2 } from "lucide-react";
import Image from "next/image";
import { cn } from "@/app/lib/utils";

interface Story {
  id: string;
  uid: string;
  username: string;
  type: "text" | "image";
  content: string;
  background?: string;
  font?: string;
  createdAt: any;
  expiresAt: any;
}

const FONTS = ["font-sans", "font-serif", "font-mono", "italic"];
const BACKGROUNDS = [
  "bg-linear-to-br from-purple-600 to-blue-500",
  "bg-linear-to-br from-pink-500 to-rose-500",
  "bg-linear-to-br from-amber-500 to-orange-600",
  "bg-linear-to-br from-emerald-500 to-teal-700",
  "bg-linear-to-br from-slate-800 to-slate-900",
];

const timeAgo = (t: any) => {
  if (!t) return "";
  const ms = t.toMillis ? t.toMillis() : t;
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
};

export default function StoryFeature() {
  const { user } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [storyType, setStoryType] = useState<"text" | "image">("text");
  const [textContent, setTextContent] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedBg, setSelectedBg] = useState(BACKGROUNDS[0]);
  const [selectedFont, setSelectedFont] = useState(FONTS[0]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rafRef = useRef<number | null>(null);
  const pressRef = useRef<boolean>(false);
  const touchStartRef = useRef<{ x: number; y: number; t: number } | null>(null);

  useEffect(() => {
    if (!db) return;

    const now = Timestamp.now();
    const q = query(
      collection(db as Firestore, "stories"),
      where("expiresAt", ">", now),
      orderBy("expiresAt", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedStories = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Story[];
      
      // Sort: My stories first (optional), then by time
      setStories(fetchedStories);
    });

    return () => unsubscribe();
  }, []);

  const durations = useMemo(() => {
    return stories.map((s) => (s.type === "image" ? 7 : 5));
  }, [stories]);

  const closeViewer = useCallback(() => {
    setActiveStoryIndex(null);
    setPaused(false);
    setIsLoading(false);
    setError(null);
    setElapsed(0);
  }, []);

  const openViewer = useCallback((index: number) => {
    setActiveStoryIndex(index);
    setPaused(false);
    setElapsed(0);
    setError(null);
    if (stories[index]?.type === "image") setIsLoading(true);
  }, [stories]);

  useEffect(() => {
    if (activeStoryIndex !== null) {
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
    } else {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    };
  }, [activeStoryIndex]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        setStoryType("image");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateStory = async () => {
    if (!user || !db) return;
    if (storyType === "text" && !textContent.trim()) return;
    if (storyType === "image" && !imagePreview) return;

    setIsUploading(true);
    try {
      const storyData = {
        uid: user.uid,
        username: user.displayName || "Anonymous",
        type: storyType,
        content: storyType === "text" ? textContent : imagePreview,
        background: selectedBg,
        font: selectedFont,
        createdAt: Timestamp.now(),
        expiresAt: new Timestamp(Timestamp.now().seconds + 24 * 60 * 60, 0),
      };

      await addDoc(collection(db as Firestore, "stories"), storyData);
      setIsCreating(false);
      setTextContent("");
      setImageFile(null);
      setImagePreview(null);
      setStoryType("text");
    } catch (error) {
      console.error("Error creating story:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const nextStory = useCallback(() => {
    if (activeStoryIndex === null) return;
    if (activeStoryIndex < stories.length - 1) {
      setActiveStoryIndex(activeStoryIndex + 1);
    } else {
      closeViewer();
    }
  }, [activeStoryIndex, stories.length, closeViewer]);

  const prevStory = useCallback(() => {
    if (activeStoryIndex === null) return;
    if (activeStoryIndex > 0) {
      setActiveStoryIndex(activeStoryIndex - 1);
    } else {
      closeViewer();
    }
  }, [activeStoryIndex, closeViewer]);

  useEffect(() => {
    if (activeStoryIndex === null) return;
    const duration = durations[activeStoryIndex] ?? 5;
    let last = performance.now();
    const tick = (now: number) => {
      if (paused || pressRef.current) {
        last = now;
      } else {
        const delta = (now - last) / 1000;
        last = now;
        setElapsed((e) => {
          const v = e + delta;
          if (v >= duration) {
            requestAnimationFrame(() => nextStory());
            return duration;
          }
          return v;
        });
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [activeStoryIndex, durations, nextStory, paused]);

  return (
    <div className="story-strip w-full py-4 px-2 overflow-x-auto no-scrollbar scroll-smooth">
      <div className="story-strip__items flex items-center gap-4 px-2">
        {/* Create Story Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setIsCreating(true)}
          className="flex flex-col items-center gap-1.5 shrink-0"
        >
          <div className="relative w-16 h-16 rounded-full p-0.75 bg-linear-to-br from-(--gold-primary) to-(--gold-light)">
            <div className="w-full h-full rounded-full bg-zinc-900 flex items-center justify-center border-2 border-zinc-950">
              <Plus className="w-7 h-7 text-(--gold-primary)" />
            </div>
            <div className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-(--gold-primary) border-2 border-zinc-950 flex items-center justify-center">
              <Plus className="w-4 h-4 text-black" strokeWidth={3} />
            </div>
          </div>
          <span className="text-[11px] font-semibold text-zinc-400">Add Story</span>
        </motion.button>

        {/* Story List */}
        {stories.map((story, index) => (
          <motion.button
            key={story.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => openViewer(index)}
            className="flex flex-col items-center gap-1.5 shrink-0"
          >
            <div className="w-16 h-16 rounded-full p-0.75 bg-linear-to-tr from-fuchsia-600 to-orange-500">
              <div className="w-full h-full rounded-full bg-zinc-900 border-2 border-zinc-950 overflow-hidden relative">
                {story.type === "image" ? (
                  <Image 
                    src={story.content} 
                    alt={story.username} 
                    fill 
                    sizes="64px"
                    className="object-cover" 
                  />
                ) : (
                  <div className={cn("w-full h-full flex items-center justify-center text-[9px] p-2 text-white font-bold text-center line-clamp-3 leading-tight", story.background, story.font)}>
                    {story.content}
                  </div>
                )}
              </div>
            </div>
            <span className="text-[11px] font-medium text-zinc-400 truncate w-16 text-center">
              {story.username}
            </span>
          </motion.button>
        ))}
      </div>

      {/* Story Viewer Modal */}
      <AnimatePresence>
        {activeStoryIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-200 bg-black flex items-center justify-center"
          >
            <div
              className="relative w-full h-full md:max-w-md md:h-[85vh] md:rounded-2xl overflow-hidden shadow-2xl bg-zinc-950 flex flex-col"
              onPointerDown={() => { pressRef.current = true; setPaused(true); }}
              onPointerUp={() => { pressRef.current = false; setPaused(false); }}
              onPointerCancel={() => { pressRef.current = false; setPaused(false); }}
            >
              {/* Progress Bars */}
              <div className="absolute top-4 left-4 right-4 z-50 flex gap-1.5">
                {stories.map((_, idx) => {
                  const done = activeStoryIndex > idx;
                  const active = activeStoryIndex === idx;
                  const duration = durations[idx] ?? 5;
                  return (
                    <div key={idx} className="h-0.5 flex-1 bg-white/20 rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full bg-white"
                        initial={false}
                        animate={{ width: done ? '100%' : active ? `${(elapsed / duration) * 100}%` : '0%' }}
                        transition={{ type: "tween", ease: "linear", duration: 0.1 }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Header */}
              <div className="absolute top-8 left-4 right-4 z-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-linear-to-br from-(--gold-primary) to-(--gold-light) p-0.5">
                    <div className="w-full h-full rounded-full bg-zinc-800 flex items-center justify-center text-black font-black text-sm">
                      {stories[activeStoryIndex]?.username?.[0].toUpperCase()}
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-white text-sm font-bold drop-shadow-md">{stories[activeStoryIndex]?.username}</span>
                    <span className="text-white/60 text-[10px] drop-shadow-md">{timeAgo(stories[activeStoryIndex]?.createdAt)}</span>
                  </div>
                </div>
                <button
                  onClick={closeViewer}
                  className="text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
                  aria-label="Close story"
                  title="Close story"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 relative flex items-center justify-center">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeStoryIndex}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.05 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="w-full h-full flex items-center justify-center"
                  >
                    {isLoading && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                        <Loader2 className="w-8 h-8 text-white animate-spin" />
                      </div>
                    )}
                    
                    {error ? (
                      <div className="p-8 text-center text-white/60 text-sm">{error}</div>
                    ) : stories[activeStoryIndex]?.type === "image" ? (
                      <div className="relative w-full h-full">
                        {/* Blurred background for pro feel */}
                        <div className="absolute inset-0 scale-110 blur-2xl opacity-40">
                          <Image 
                            src={stories[activeStoryIndex].content} 
                            alt="" 
                            fill 
                            sizes="100vw"
                            className="object-cover" 
                          />
                        </div>
                        <Image
                          src={stories[activeStoryIndex].content}
                          alt="Story"
                          fill
                          className="object-contain relative z-10"
                          sizes="(max-width: 768px) 100vw, 450px"
                          priority
                        />
                      </div>
                    ) : (
                      <div className={cn(
                        "w-full h-full flex flex-col items-center justify-center px-10 text-center text-white",
                        stories[activeStoryIndex]?.background,
                        stories[activeStoryIndex]?.font
                      )}>
                        <p className="text-3xl md:text-4xl font-black leading-tight drop-shadow-xl max-w-full overflow-hidden wrap-break-word">
                          {stories[activeStoryIndex]?.content}
                        </p>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>

                {/* Nav Zones */}
                <div className="absolute inset-0 flex z-30">
                  <div 
                    className="w-1/4 h-full cursor-pointer" 
                    onClick={(e) => { e.stopPropagation(); prevStory(); }}
                    aria-label="Previous story"
                    role="button"
                  />
                  <div 
                    className="flex-1 h-full cursor-pointer" 
                    onClick={(e) => { e.stopPropagation(); nextStory(); }}
                    aria-label="Next story"
                    role="button"
                  />
                </div>

                {/* Pause Indicator */}
                <AnimatePresence>
                  {paused && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 z-40 bg-black/20 backdrop-blur-[2px] pointer-events-none flex items-center justify-center"
                    >
                      <div className="bg-white/10 px-4 py-2 rounded-full border border-white/20 text-white text-[10px] font-bold tracking-widest uppercase">Paused</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Bottom Actions */}
              <div className="absolute bottom-8 left-4 right-4 z-50 flex items-center gap-3">
                <input 
                  type="text" 
                  id="story-reply"
                  placeholder="Send a reply..." 
                  aria-label="Send a reply"
                  className="flex-1 h-12 bg-white/10 border border-white/20 rounded-full px-6 text-sm text-white placeholder:text-white/60 focus:outline-none focus:border-white/40 backdrop-blur-md"
                  onClick={(e) => { e.stopPropagation(); setPaused(true); }}
                  onBlur={() => setPaused(false)}
                />
                <button 
                  className="w-12 h-12 bg-white/10 border border-white/20 rounded-full flex items-center justify-center text-white backdrop-blur-md hover:bg-white/20"
                  aria-label="Send reply"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Story Creator Modal */}
      <AnimatePresence>
        {isCreating && (
          <motion.div
            initial={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
            className="fixed inset-0 z-200 bg-zinc-950 flex flex-col"
          >
            {/* Creator Header */}
            <div className="px-4 py-6 flex justify-between items-center z-10">
              <button 
                onClick={() => { setIsCreating(false); setImagePreview(null); setImageFile(null); }} 
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white"
                aria-label="Close creator"
                title="Close creator"
              >
                <X className="w-6 h-6" />
              </button>
              <div className="flex gap-2">
                {storyType === "text" && (
                  <button 
                    onClick={() => {
                      const idx = FONTS.indexOf(selectedFont);
                      setSelectedFont(FONTS[(idx + 1) % FONTS.length]);
                    }}
                    className="px-4 h-10 rounded-full bg-white/10 text-white text-xs font-bold border border-white/10"
                  >
                    Font
                  </button>
                )}
                <button 
                  onClick={handleCreateStory}
                  disabled={isUploading || (storyType === "text" && !textContent.trim()) || (storyType === "image" && !imagePreview)}
                  className="px-6 h-10 rounded-full bg-(--gold-primary) text-black font-black text-sm shadow-lg shadow-(--gold-primary)/20 disabled:opacity-50 flex items-center gap-2"
                >
                  {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Share"}
                </button>
              </div>
            </div>

            {/* Creator Workspace */}
            <div className={cn("flex-1 flex flex-col items-center justify-center p-8 transition-colors duration-500", storyType === "text" ? selectedBg : "bg-black relative")}>
              {storyType === "text" ? (
                <textarea
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="Release your thoughts..."
                  aria-label="Story text content"
                  title="Story content"
                  className={cn("w-full bg-transparent border-none text-center text-4xl md:text-5xl font-black text-white placeholder:text-white/30 focus:ring-0 resize-none leading-tight", selectedFont)}
                  autoFocus
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center">
                  {imagePreview ? (
                    <div className="relative w-full h-full flex items-center justify-center">
                      <Image 
                        src={imagePreview} 
                        alt="Preview" 
                        fill 
                        sizes="(max-width: 768px) 100vw, 450px"
                        className="object-contain" 
                      />
                      <button 
                        onClick={() => { setImagePreview(null); setImageFile(null); setStoryType("text"); }}
                        className="absolute top-0 right-0 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg"
                        aria-label="Remove image"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-6">
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-24 h-24 rounded-3xl bg-white/5 border-2 border-dashed border-white/20 flex flex-col items-center justify-center gap-2 text-white/40 hover:text-white hover:border-white/40 transition-all cursor-pointer group"
                      >
                        <ImageIcon className="w-10 h-10 group-hover:scale-110 transition-transform" />
                      </div>
                      <div className="text-center">
                        <p className="text-white font-bold text-lg">Pick an Image</p>
                        <p className="text-white/40 text-sm mt-1">Capture a moment</p>
                      </div>
                    </div>
                  )}
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleImageSelect} 
                    aria-label="Upload image"
                    title="Select story image"
                  />
                </div>
              )}
            </div>

            {/* Creator Tools */}
            <div className="p-6 bg-zinc-900/80 backdrop-blur-xl border-t border-white/5 space-y-8">
              {storyType === "text" && (
                <div className="flex gap-3 overflow-x-auto no-scrollbar py-2">
                  {BACKGROUNDS.map((bg) => (
                    <button
                      key={bg}
                      onClick={() => setSelectedBg(bg)}
                      className={cn("w-10 h-10 rounded-full shrink-0 border-2 transition-transform", bg, selectedBg === bg ? "border-white scale-110" : "border-transparent hover:scale-105")}
                      aria-label="Select theme"
                    />
                  ))}
                </div>
              )}

              <div className="flex justify-center gap-12">
                <button 
                  onClick={() => setStoryType("text")}
                  className={cn("flex flex-col items-center gap-2 transition-all", storyType === "text" ? "text-(--gold-primary) scale-110" : "text-zinc-500 hover:text-zinc-300")}
                >
                  <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", storyType === "text" ? "bg-(--gold-primary)/20" : "bg-white/5")}>
                    <Type className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest">Text</span>
                </button>
                <button 
                  onClick={() => {
                    if (imagePreview) setStoryType("image");
                    else fileInputRef.current?.click();
                  }}
                  className={cn("flex flex-col items-center gap-2 transition-all", storyType === "image" ? "text-(--gold-primary) scale-110" : "text-zinc-500 hover:text-zinc-300")}
                >
                  <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", storyType === "image" ? "bg-(--gold-primary)/20" : "bg-white/5")}>
                    <ImageIcon className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest">Image</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
