"use client";

import { useRouter } from "next/navigation";
import { Reveal, TiltCard, ShimmerButton, GlowBackground } from "../components/PageEffects";

export default function PrivacyPage() {
  const router = useRouter();

  return (
    <div className="info-page relative min-h-screen bg-(--background) text-white flex flex-col font-sans">
      <GlowBackground />
      
      {/* Header */}
      <div className="relative pt-6 pb-12 px-4 md:px-6">
        <div className="absolute inset-0 bg-linear-to-b from-(--gold-primary)/5 to-transparent"></div>

        <div className="relative max-w-4xl mx-auto text-center">
          <Reveal>
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 text-(--gold-primary) hover:text-(--gold-light) mb-8 transition-colors px-4 py-2 rounded-full border border-(--gold-primary)/20 hover:border-(--gold-primary)/40 bg-white/5 hover:bg-white/10 backdrop-blur-xl"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span>Back</span>
            </button>
          </Reveal>

          <Reveal className="opacity-0">
            <h1 className="text-4xl md:text-6xl font-black mb-6 bg-linear-to-r from-(--gold-primary) via-white to-(--gold-light) bg-clip-text text-transparent drop-shadow-[0_0_15px_rgba(245,194,107,0.3)]">
              Privacy Policy
            </h1>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
              Your data is secured with state-of-the-art encryption.
            </p>
          </Reveal>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 md:px-6 pb-16">
        <div className="max-w-4xl mx-auto space-y-8">
          
          {/* Introduction */}
          <Reveal>
            <TiltCard className="glass border border-(--gold-primary)/30 rounded-2xl p-6 md:p-8 bg-white/4 backdrop-blur-xl">
              <h2 className="text-2xl font-bold text-(--gold-primary) mb-4 font-mono">1.0 // Data_Transmission</h2>
              <p className="text-zinc-400 leading-relaxed mb-4">
                Confession operates on a strict <span className="text-white font-mono">need-to-know</span> basis. 
                Your identity is hashed and salted unless you explicitly choose to broadcast it.
                We do not sell, trade, or leak your personal variables to third-party endpoints.
                Operated by SA Studios · Crafted in USA.
              </p>
              <div className="bg-black/40 p-4 rounded-lg font-mono text-xs text-(--gold-light)">
                if (user.isAnonymous) {'{'}
                <br />
                &nbsp;&nbsp;return "Encrypted_Void";
                <br />
                {'}'} else {'{'}
                <br />
                &nbsp;&nbsp;return user.displayName;
                <br />
                {'}'}
              </div>
            </TiltCard>
          </Reveal>

          {/* Data Collection */}
          <Reveal>
            <TiltCard className="glass border border-(--gold-primary)/30 rounded-2xl p-6 md:p-8 bg-white/4 backdrop-blur-xl">
              <h2 className="text-2xl font-bold text-(--gold-primary) mb-4 font-mono">2.0 // Storage_Logs</h2>
              <ul className="space-y-4 text-zinc-400">
                <li className="flex gap-3">
                  <span className="text-(--gold-primary)">01.</span>
                  <span>
                    <strong className="text-white">Cookies:</strong> Minimal session tokens only. We use local storage for theme preferences and auth state.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-(--gold-primary)">02.</span>
                  <span>
                    <strong className="text-white">Analytics:</strong> Anonymized telemetry to optimize system performance and fix runtime errors.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-(--gold-primary)">03.</span>
                  <span>
                    <strong className="text-white">Confessions:</strong> Stored in our encrypted Firestore database. Deleted posts are purged from the main index immediately.
                  </span>
                </li>
              </ul>
            </TiltCard>
          </Reveal>

          {/* User Rights */}
          <Reveal>
            <TiltCard className="glass border border-(--gold-primary)/30 rounded-2xl p-6 md:p-8 bg-white/4 backdrop-blur-xl">
              <h2 className="text-2xl font-bold text-(--gold-primary) mb-4 font-mono">3.0 // sudo privileges</h2>
              <p className="text-zinc-400 leading-relaxed mb-4">
                You have root access to your own data. You can request:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-sm">
                <div className="p-3 border border-zinc-800 rounded bg-zinc-900/50">
                  <span className="text-(--gold-primary)">$</span> export_data --json
                </div>
                <div className="p-3 border border-zinc-800 rounded bg-zinc-900/50">
                  <span className="text-(--gold-primary)">$</span> delete_account --force
                </div>
                <div className="p-3 border border-zinc-800 rounded bg-zinc-900/50">
                  <span className="text-(--gold-primary)">$</span> update_profile --patch
                </div>
                <div className="p-3 border border-zinc-800 rounded bg-zinc-900/50">
                  <span className="text-(--gold-primary)">$</span> contact_admin
                </div>
              </div>
            </TiltCard>
          </Reveal>

          {/* Footer */}
          <Reveal>
             <p className="text-center text-zinc-600 text-sm font-mono mt-8">
               Last Commit: 2025-01-28 | SHA: 7f8a9d
             </p>
          </Reveal>

        </div>
      </div>
    </div>
  );
}
