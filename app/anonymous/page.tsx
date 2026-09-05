"use client";

import { useState, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { db } from "../../firebase";
import { collection, addDoc, Timestamp, Firestore } from "firebase/firestore";

function AnonymousPageContent() {
  const { user } = useAuth();
  const params = useSearchParams();
  const router = useRouter();

  const targetUid = params.get("uid") || null;
  const [msg, setMsg] = useState("");
  const [sent, setSent] = useState(false);
  const [isSending, setIsSending] = useState(false);

  if (!user)
    return (
      <div className="flex h-screen items-center justify-center bg-black text-yellow-300">
        Login required.
      </div>
    );

  if (!targetUid)
    return (
      <div className="flex h-screen items-center justify-center bg-black text-yellow-300">
        No target user specified.
      </div>
    );

  const sendAnon = async () => {
    if (!msg.trim() || isSending || !db) return;

    setIsSending(true);

    try {
      await addDoc(collection(db as Firestore, `anonymous/${targetUid}/inbox`), {
        text: msg,
        createdAt: Timestamp.now(),
        hidden: true,
      });

      setMsg("");
      setSent(true);
      setTimeout(() => router.push("/inbox"), 1100);
    } catch (error) {
      console.error("Failed to send anonymous message:", error);
      setIsSending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050505] px-4 py-10 text-yellow-300">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.21, 0.47, 0.32, 0.98] }}
        className="w-full max-w-xl rounded-2xl border border-yellow-500/20 bg-zinc-950/90 p-5 shadow-[0_0_40px_rgba(250,204,21,0.08)] backdrop-blur-sm sm:p-6"
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-yellow-400/70">
              Anonymous
            </p>
            <h1 className="mt-2 text-2xl font-bold text-yellow-200">Send a secret note</h1>
          </div>
        </div>

        <div className="space-y-4">
          <textarea
            className="h-52 w-full rounded-xl border border-yellow-500/20 bg-zinc-900/80 p-4 text-base text-yellow-100 outline-none transition-all duration-200 placeholder:text-yellow-300/45 focus:border-yellow-400 focus:ring-3 focus:ring-yellow-400/20"
            maxLength={1000}
            placeholder="Write your anonymous confession..."
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
          />

          <div className="flex items-center justify-between text-xs text-yellow-300/70">
            <span>Keep it respectful and kind.</span>
            <span>{msg.length}/1000</span>
          </div>

          <AnimatePresence mode="wait">
            {!sent ? (
              <motion.button
                key="send"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 350, damping: 22 }}
                onClick={sendAnon}
                disabled={!msg.trim() || isSending}
                className="w-full rounded-xl bg-yellow-400 px-4 py-3 text-base font-semibold text-black shadow-[0_0_20px_rgba(250,204,21,0.25)] transition-all duration-200 hover:bg-yellow-300 disabled:cursor-not-allowed disabled:bg-yellow-500/60 disabled:text-black/70"
              >
                {isSending ? "Sending..." : "Send anonymously"}
              </motion.button>
            ) : (
              <motion.div
                key="sent"
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12 }}
                className="flex items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300"
                aria-live="polite"
              >
                Message sent successfully ✓
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 350, damping: 22 }}
            onClick={() => router.back()}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-base font-medium text-yellow-300 transition-colors duration-200 hover:border-zinc-500 hover:bg-zinc-800"
          >
            Cancel
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

export default function AnonymousPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-black text-yellow-300">Loading...</div>}>
      <AnonymousPageContent />
    </Suspense>
  );
}
