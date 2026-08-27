"use client";

import { useRouter } from "next/navigation";
import { Reveal, TiltCard, ShimmerButton, GlowBackground } from "../components/PageEffects";

export default function TermsPage() {
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
              Terms of Service
            </h1>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
              Rules of engagement for a fair and safe community.
            </p>
          </Reveal>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 md:px-6 pb-16">
        <div className="max-w-4xl mx-auto space-y-8">
          
          {/* Agreement */}
          <Reveal>
            <TiltCard className="glass border border-(--gold-primary)/30 rounded-2xl p-6 md:p-8 bg-white/4 backdrop-blur-xl">
              <h2 className="text-2xl font-bold text-(--gold-primary) mb-4 font-mono">1.0 // Initialization</h2>
              <p className="text-zinc-400 leading-relaxed mb-4">
                By accessing <span className="text-white font-mono">Confession</span> (a service of SA Studios, USA), you agree to bind your session to these protocols. 
                Failure to comply will result in an immediate <span className="text-red-400 font-mono">SIGKILL</span> of your account privileges.
              </p>
            </TiltCard>
          </Reveal>

          {/* Conduct */}
          <Reveal>
            <TiltCard className="glass border border-(--gold-primary)/30 rounded-2xl p-6 md:p-8 bg-white/4 backdrop-blur-xl">
              <h2 className="text-2xl font-bold text-(--gold-primary) mb-4 font-mono">2.0 // Syntax_Rules</h2>
              <div className="space-y-4 font-mono text-sm">
                <div className="p-4 bg-zinc-900/50 rounded border border-zinc-800">
                  <span className="text-red-400">Error 403:</span> Hate speech, harassment, or illegal payloads are strictly forbidden.
                </div>
                <div className="p-4 bg-zinc-900/50 rounded border border-zinc-800">
                  <span className="text-red-400">Error 401:</span> Impersonation of admin or other users is not authorized.
                </div>
                <div className="p-4 bg-zinc-900/50 rounded border border-zinc-800">
                  <span className="text-green-400">Success 200:</span> Respectful debate, authentic confessions, and constructive feedback are encouraged.
                </div>
              </div>
            </TiltCard>
          </Reveal>

          {/* Liability */}
          <Reveal>
            <TiltCard className="glass border border-(--gold-primary)/30 rounded-2xl p-6 md:p-8 bg-white/4 backdrop-blur-xl">
              <h2 className="text-2xl font-bold text-(--gold-primary) mb-4 font-mono">3.0 // Exception_Handling</h2>
              <p className="text-zinc-400 leading-relaxed mb-4">
                Confession is provided "as is" by SA Studios, USA. We are not responsible for any data loss, downtime, or emotional overflow caused by user-generated content.
                While we implement robust garbage collection for toxic content, some edge cases may persist.
              </p>
              <div className="mt-4 p-4 bg-black/40 rounded border border-(--gold-primary)/10 text-xs font-mono text-zinc-500">
                try {'{'}
                <br />
                &nbsp;&nbsp;use(Confession);
                <br />
                {'}'} catch (liability) {'{'}
                <br />
                &nbsp;&nbsp;void(0); // SA Studios takes no responsibility
                <br />
                {'}'}
              </div>
            </TiltCard>
          </Reveal>

          {/* Footer */}
          <Reveal>
             <p className="text-center text-zinc-600 text-sm font-mono mt-8">
               build_v2.4.0-stable
             </p>
          </Reveal>

        </div>
      </div>
    </div>
  );
}
