"use client";

import { useAuth } from "../../context/AuthContext";
import { db } from "../../../firebase";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
  getDocs,
  where,
  updateDoc,
  doc,
  setDoc,
  Firestore,
} from "firebase/firestore";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { FadeIn, HoverScale } from "../../components/Motion";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Paperclip, 
  Smile, 
  Check, 
  CheckCheck, 
  Clock, 
  Camera, 
  Mic, 
  MoreVertical,
  Info
} from "lucide-react";
import Toast from "../../components/Toast";
import { cn } from "@/app/lib/utils";

import { TypingIndicator, MessageStatusIcon } from "../../components/ChatUI";
import CallControls from "../../components/CallControls";

export default function ChatRoom({ params }: { params: any }) {
  const { user, logout } = useAuth();
  const [id, setId] = useState<string>("");
  const router = useRouter();

  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [otherUser, setOtherUser] = useState<any>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [partnerIsTyping, setPartnerIsTyping] = useState(false);
  const [showReactions, setShowReactions] = useState<string | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const bottomRef = useRef<any>(null);
  const typingTimeoutRef = useRef<any>(null);
  const lastMessageIdRef = useRef<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Initialize/resume audio context after user interaction (autoplay policy)
  useEffect(() => {
    const unlock = () => {
      try {
        const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!Ctx) return;
        if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
        if (audioCtxRef.current?.state === "suspended") audioCtxRef.current.resume();
      } catch {}
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const playPing = () => {
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      const ctx = audioCtxRef.current || new Ctx();
      audioCtxRef.current = ctx;
      if (ctx.state === "suspended") {
        // Will resume on next user interaction
        return;
      }
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(880, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.15);
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.25);
    } catch {}
  };

  useEffect(() => {
    if (params && typeof params.then === "function") {
      params.then((p: any) => setId(p?.id ?? ""));
    } else {
      setId(params?.id ?? "");
    }
  }, [params]);

  const isUserOnline = (lastSeen: any) => {
    if (!lastSeen) return false;
    const date = lastSeen.toDate ? lastSeen.toDate() : new Date(lastSeen);
    const now = new Date();
    const diff = (now.getTime() - date.getTime()) / 1000 / 60; // minutes
    return diff < 5;
  };

  const partnerUid =
    user && id
      ? id.startsWith(user.uid + "_")
        ? id.substring(user.uid.length + 1)
        : id.endsWith("_" + user.uid)
        ? id.substring(0, id.length - user.uid.length - 1)
        : null
      : null;

  // Load chat partner profile
  const loadPartner = async () => {
    if (!partnerUid || !db) return;
    const q = query(collection(db as Firestore, "users"), where("uid", "==", partnerUid));
    const snap = await getDocs(q);
    if (!snap.empty) setOtherUser(snap.docs[0].data());
  };

  const send = async () => {
    if (!user || !text.trim() || !id || !db) return;
    setSending(true);
    const messageText = text; // Capture text for AI
    try {
      await addDoc(collection(db as Firestore, `chats/${id}/messages`), {
        uid: user.uid,
        text,
        createdAt: Timestamp.now(),
        reactions: [],
      });
      setText("");

      // AI Response Logic
      if (partnerUid === "ai") {
        setIsTyping(true);
        try {
          const res = await fetch("/api/gemini", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: messageText, mode: "chat" }),
          });
          const data = await res.json();
          if (data.output) {
            await addDoc(collection(db as Firestore, `chats/${id}/messages`), {
              uid: "ai",
              text: data.output,
              createdAt: Timestamp.now(),
              reactions: [],
            });
          }
        } catch (err) {
          console.error("AI Chat Error:", err);
          setToast({ message: "AI failed to respond. Please try again.", type: "error" });
        } finally {
          setIsTyping(false);
        }
      }

    } catch (error) {
      console.error("Error sending message:", error);
      setToast({ message: "Failed to send message. Please check your connection.", type: "error" });
    } finally {
      setSending(false);
    }
  };

  // Add reaction to message
  const addReaction = async (messageId: string, emoji: string) => {
    if (!user || !id || !db) return;
    const messageRef = doc(db as Firestore, `chats/${id}/messages`, messageId);
    const message = messages.find(m => m.id === messageId);
    
    if (message) {
      const reactions = message.reactions || [];
      const existingReaction = reactions.find((r: any) => r.uid === user.uid);
      
      if (existingReaction) {
        // Update existing reaction
        const updatedReactions = reactions.map((r: any) => 
          r.uid === user.uid ? { ...r, emoji } : r
        );
        await updateDoc(messageRef, { reactions: updatedReactions });
      } else {
        // Add new reaction
        await updateDoc(messageRef, { 
          reactions: [...reactions, { uid: user.uid, emoji }] 
        });
      }
    }
    
    setShowReactions(null);
  };

  // Handle typing indicator
  const handleTyping = () => {
    setIsTyping(true);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 1500); // 1.5 seconds timeout
  };

  // Sync our typing status to Firestore
  useEffect(() => {
    if (!id || !user || !db) return;

    const myTypingRef = doc(db as Firestore, `chats/${id}/typing`, user.uid);
    setDoc(myTypingRef, {
      isTyping: isTyping,
      lastUpdate: Timestamp.now()
    }).catch((err) => {
      console.error("Error setting typing status:", err);
    });
  }, [isTyping, id, user]);

  // Listen for partner's typing status
  useEffect(() => {
    if (!id || !partnerUid || !db) return;

    const typingDocRef = doc(db as Firestore, `chats/${id}/typing`, partnerUid);
    const unsub = onSnapshot(typingDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const isCurrentlyTyping = data.isTyping;
        const lastUpdate = data.lastUpdate;
        if (isCurrentlyTyping && lastUpdate) {
          const updateTime = lastUpdate.toMillis ? lastUpdate.toMillis() : (lastUpdate.seconds ? lastUpdate.seconds * 1000 : 0);
          if (Date.now() - updateTime < 10000) { // 10 seconds validity
            setPartnerIsTyping(true);
            return;
          }
        }
      }
      setPartnerIsTyping(false);
    }, (error) => {
      console.error("Error listening to partner typing:", error);
    });

    return () => unsub();
  }, [id, partnerUid]);

  // Clean up typing status on unmount
  useEffect(() => {
    return () => {
      if (id && user && db) {
        const myTypingRef = doc(db as Firestore, `chats/${id}/typing`, user.uid);
        setDoc(myTypingRef, {
          isTyping: false,
          lastUpdate: Timestamp.now()
        }).catch(() => {});
      }
    };
  }, [id, user]);

  // Listen for messages
  useEffect(() => {
    if (!id || !user || !db) return;
    
    const q = query(
      collection(db as Firestore, `chats/${id}/messages`),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const arr: any[] = [];
      snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
      setMessages(arr);

      // Play a subtle ping for new incoming messages (not from me)
      const latest = arr[arr.length - 1];
      if (!latest) return;
      const prevId = lastMessageIdRef.current;
      lastMessageIdRef.current = latest.id;
      if (!prevId) return; // first load: don't play
      if (latest.id !== prevId && latest.uid !== user.uid && !document.hidden) {
        playPing();
      }
    }, (error) => {
       console.error("Chat snapshot error:", error);
       if (error.code === 'permission-denied') {
          setToast({ message: "Access denied. Check your permissions.", type: "error" });
       } else if (error.code === 'failed-precondition') {
          setToast({ message: "System configuration error. Check console.", type: "error" });
       } else {
          setToast({ message: "Connection lost. Reconnecting...", type: "error" });
       }
     });
    return () => unsub();
  }, [id, user]);

  useEffect(() => {
    loadPartner();
  }, [partnerUid]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!user)
    return (
      <div className="h-screen bg-linear-to-br from-(--dark-base) via-(--dark-base) to-(--dark-base) text-(--gold-primary) flex items-center justify-center">
        <div className="glass rounded-3xl p-12 animate-bounceIn">
          <p className="text-2xl font-bold">Login Required</p>
        </div>
      </div>
    );

  return (
    <div data-theme={theme} className="relative flex h-dvh max-h-dvh flex-col overflow-hidden bg-(--background) text-white">
      {/* Background Elements */}
      <div className="pointer-events-none absolute -right-48 top-20 h-96 w-96 rounded-full bg-(--gold-primary)/5 blur-3xl"></div>
      <div className="pointer-events-none absolute bottom-20 -left-48 h-96 w-96 rounded-full bg-white/2 blur-3xl"></div>

      {/* Header */}
      <div className="glass relative z-20 flex shrink-0 items-center gap-3 border-b border-white/10 px-3 py-3 shadow-lg shadow-black/10 backdrop-blur-xl sm:gap-4 sm:px-5">
        <button
          type="button"
          onClick={() => router.push("/chat")}
          className="p-2 rounded-full hover:bg-zinc-800/50 text-zinc-400 hover:text-white transition-colors"
          aria-label="Back"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* User Info */}
        <div className="flex items-center gap-3 flex-1 overflow-hidden">
          <div className="relative shrink-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-(--gold-primary)/25 bg-(--gold-primary)/10 shadow-inner">
              <span className="text-zinc-300 font-bold text-lg">
                {otherUser?.username?.[0]?.toUpperCase() || "?"}
              </span>
            </div>
            {/* Online Indicator */}
            {isUserOnline(otherUser?.lastSeen) && (
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-black"></div>
            )}
          </div>
          
          <div className="flex flex-col min-w-0">
            <h2 className="font-bold text-zinc-100 truncate text-base leading-tight">
              {otherUser?.username || "Loading..."}
            </h2>
            {isUserOnline(otherUser?.lastSeen) ? (
              <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-(--gold-primary)">
                <span className="h-1 w-1 animate-pulse rounded-full bg-(--gold-primary)"></span>
                Active Now
              </p>
            ) : (
              <p className="text-[10px] text-zinc-500 font-medium tracking-wide uppercase">
                Offline
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <CallControls
            chatId={id}
            localUid={user.uid}
            remoteUid={partnerUid}
            remoteName={otherUser?.username || "User"}
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden relative z-10 flex">
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col relative min-w-0">
          
          {/* Messages List */}
          <div className="flex-1 space-y-5 overflow-y-auto p-3 scroll-smooth overscroll-contain sm:space-y-6 sm:p-5">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-4 opacity-50">
                <div className="w-16 h-16 rounded-2xl bg-zinc-900 flex items-center justify-center rotate-3">
                   <Info className="w-8 h-8 opacity-50" />
                </div>
                <p className="text-sm font-medium">No messages yet. Start the conversation!</p>
              </div>
            )}
            
            {messages.map((m, i) => {
              const isMe = m.uid === user.uid;
              const isFirst = i === 0 || messages[i - 1].uid !== m.uid;
              const isLast = i === messages.length - 1 || messages[i + 1].uid !== m.uid;
              const status = m.read ? "read" : m.delivered ? "delivered" : "sent";
              
              return (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  key={m.id}
                  className={cn("flex w-full group", isMe ? "justify-end" : "justify-start")}
                >
                  <div className={cn("flex max-w-[85%] md:max-w-[70%] gap-2", isMe ? "flex-row-reverse" : "flex-row")}>
                    
                    {/* Avatar (only for them, and only on last message of group) */}
                    {!isMe && (
                      <div className={cn("w-8 h-8 shrink-0 flex flex-col justify-end", !isLast && "invisible")}>
                         <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs text-zinc-400 border border-zinc-700">
                            {otherUser?.username?.[0]?.toUpperCase()}
                         </div>
                      </div>
                    )}

                    <div className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                      {/* Name (only first message of group, not me) */}
                      {!isMe && isFirst && (
                         <span className="text-[10px] text-zinc-500 ml-1 mb-1">{otherUser?.username}</span>
                      )}

                      {/* Bubble */}
                      <HoverScale>
                        <div
                          className={cn(
                            "relative px-4 py-2.5 text-sm leading-relaxed wrap-break-word shadow-sm transition-all sm:px-5 sm:text-base",
                            isMe 
                              ? "bg-(--gold-primary) text-black rounded-2xl rounded-tr-sm"
                              : "bg-(--dark-card) text-zinc-100 rounded-2xl rounded-tl-sm border border-white/10",
                            isLast ? "mb-1" : "mb-0.5"
                          )}
                        >
                          {m.text}
                          
                          {/* Reactions */}
                          <AnimatePresence>
                            {m.reactions?.length > 0 && (
                              <motion.div 
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className={cn("absolute -bottom-3 flex -space-x-1", isMe ? "-left-2" : "-right-2")}
                              >
                                {m.reactions.map((r: any, idx: number) => (
                                  <span key={idx} className="bg-zinc-900 border border-zinc-700 rounded-full w-5 h-5 flex items-center justify-center text-[10px] shadow-xs">
                                    {r.emoji}
                                  </span>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </HoverScale>

                      {/* Timestamp & Status */}
                      {isLast && (
                        <div className={cn("flex items-center gap-1 mt-1 text-[10px] text-zinc-600", isMe ? "mr-1" : "ml-1")}>
                          <span>
                            {m.createdAt?.toMillis
                              ? new Date(m.createdAt.toMillis()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : "Just now"}
                          </span>
                          {isMe && <MessageStatusIcon status={status} />}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
            
            {/* Typing Indicator */}
            <AnimatePresence>
              {partnerIsTyping && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="flex justify-start w-full pl-10"
                >
                  <TypingIndicator />
                </motion.div>
              )}
            </AnimatePresence>
            
            <div ref={bottomRef} />
          </div>

          {/* Input Area */}
          <div className="z-20 shrink-0 border-t border-white/10 bg-(--background)/90 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-xl sm:p-4">
             <form 
               onSubmit={(e) => { e.preventDefault(); send(); }}
               className="flex items-end gap-2 max-w-4xl mx-auto"
             >
                <div className="flex-1 relative group">
                  <div className="absolute -inset-0.5 rounded-2xl bg-(--gold-primary)/10 opacity-50 blur transition duration-500 group-focus-within:opacity-100"></div>
                  <input
                    type="text"
                    value={text}
                    onChange={(e) => { setText(e.target.value); handleTyping(); }}
                    placeholder="Message..."
                    className="relative w-full rounded-2xl border border-white/10 bg-(--dark-card) px-5 py-3.5 text-zinc-100 outline-none transition-all placeholder:text-zinc-500 focus:border-(--gold-primary)/50 focus:ring-2 focus:ring-(--gold-primary)/10"
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={!text.trim() || sending}
                  className="h-13 w-13 flex items-center justify-center rounded-2xl bg-(--gold-primary) text-black hover:bg-(--gold-light) disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shadow-lg shadow-(--gold-primary)/20 shrink-0"
                >
                   {sending ? (
                     <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                     </svg>
                   ) : (
                     <svg className="w-5 h-5 translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                     </svg>
                   )}
                </button>
             </form>
          </div>
        </div>

        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div className={`
            fixed inset-y-0 right-0 z-40 w-72 bg-black/95 backdrop-blur-xl border-l border-zinc-800/50 transition-transform duration-300
            md:relative md:translate-x-0 md:bg-black/50 md:z-0
            ${sidebarOpen ? "translate-x-0" : "translate-x-full md:hidden"}
        `}>
           <div className="h-full flex flex-col p-4 overflow-y-auto">
              <div className="flex items-center justify-between mb-6 md:hidden">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Chat Details</h3>
                <button onClick={() => setSidebarOpen(false)} className="p-1 text-zinc-400" aria-label="Close sidebar">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="hidden md:block mb-4">
                 <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Chat Details</h3>
              </div>

              <div className="flex flex-col items-center p-6 border border-zinc-800 rounded-2xl bg-zinc-900/30 mb-6">
                 <div className="w-20 h-20 rounded-full bg-linear-to-br from-zinc-700 to-zinc-800 flex items-center justify-center mb-3 shadow-xl">
                    <span className="text-3xl font-bold text-zinc-400">{otherUser?.username?.[0]?.toUpperCase()}</span>
                 </div>
                 <h4 className="font-bold text-lg text-white">{otherUser?.username}</h4>
                 <p className="text-xs text-zinc-500">Joined recently</p>
              </div>
              
              <div className="space-y-2 mt-auto md:mt-0">
                 <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-zinc-800/50 text-zinc-400 hover:text-red-400 transition-colors text-sm font-medium">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                    <span>Block User</span>
                 </button>
              </div>
           </div>
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
    </div>
  );
}

