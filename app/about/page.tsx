"use client";

import { useRouter } from "next/navigation";
import { Reveal, TiltCard, ShimmerButton, GlowBackground } from "../components/PageEffects";

export default function AboutPage() {
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
              About Confession
            </h1>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
              The next generation of social connection — Owned by SA Studios, Crafted in USA 🇺🇸
            </p>
          </Reveal>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 md:px-6 pb-16">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Mission Section */}
          <Reveal>
            <TiltCard className="glass border border-(--gold-primary)/30 rounded-2xl p-6 md:p-8 bg-white/4 backdrop-blur-xl">
              <div className="flex items-start gap-4 mb-2 md:mb-6">
                <div className="text-4xl">🎯</div>
                <div>
                  <h2 className="text-2xl font-bold text-(--gold-primary) mb-3">Our Mission</h2>
                  <p className="text-zinc-400 leading-relaxed">
                    Confession is designed to redefine social connection. We are changing the way humans connect,
                    moving away from superficial interactions to foster deep, authentic relationships.
                    Our platform is built for safety, inclusivity, and meaningful conversations.
                    Owned by SA Studios · Crafted in USA.
                  </p>
                </div>
              </div>
            </TiltCard>
          </Reveal>

          {/* Founder Section */}
          <Reveal>
            <TiltCard className="glass border border-(--gold-primary)/30 rounded-2xl p-6 md:p-8 bg-white/4 backdrop-blur-xl">
              <h2 className="text-2xl font-bold text-(--gold-primary) mb-8 flex items-center gap-3">
                <span className="text-3xl">👨‍💻</span>
                The Visionary
              </h2>

              <div className="space-y-6">
                {/* Founder Card */}
                <div className="flex flex-col md:flex-row gap-6 items-start">
                  {/* Avatar */}
                  <div className="shrink-0 w-24 h-24 md:w-32 md:h-32 rounded-2xl bg-linear-to-br from-(--gold-primary)/30 to-(--gold-light)/30 flex items-center justify-center border border-(--gold-primary)/20">
                    <span className="text-4xl md:text-6xl">⚡</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-white mb-1">Mr X</h3>
                    <p className="text-(--gold-primary) text-sm mb-4">Lead Architect & CEO</p>
                    <p className="text-zinc-400 leading-relaxed mb-4">
                      Sid is a full-stack visionary with a passion for digital transformation.
                      Combining years of development experience into a single vision, he built Confession
                      to solve the problems of modern social connectivity — now proudly owned by SA Studios.
                    </p>
                    <div className="space-y-2 text-sm text-zinc-400">
                      <p><span className="text-(--gold-primary) font-semibold">Focus:</span> Social Innovation, UX/UI, Scalable Architecture</p>
                      <p><span className="text-(--gold-primary) font-semibold">Vision:</span> Connecting people to create meaningful bonds</p>
                      <p><span className="text-(--gold-primary) font-semibold">Motto:</span> "Tech should empower, not divide"</p>
                    </div>
                  </div>
                </div>
              </div>
            </TiltCard>
          </Reveal>

          {/* Values Section */}
          <Reveal>
            <TiltCard className="glass border border-(--gold-primary)/30 rounded-2xl p-6 md:p-8 bg-white/4 backdrop-blur-xl">
              <h2 className="text-2xl font-bold text-(--gold-primary) mb-8 flex items-center gap-3">
                <span className="text-3xl">💎</span>
                Our Values
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  { icon: "🔒", title: "Privacy", desc: "Your data is secure. Privacy is our priority." },
                  { icon: "🤝", title: "Connection", desc: "Building secure and meaningful relationships." },
                  { icon: "🚀", title: "Innovation", desc: "Continuously improving your experience." },
                  { icon: "✨", title: "Authenticity", desc: "Real people, real stories." },
                  { icon: "🌍", title: "Global Reach", desc: "Accessible to everyone, everywhere." },
                  { icon: "⚡", title: "Excellence", desc: "Optimized for the best quality." },
                ].map((value, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-linear-to-br from-(--gold-primary)/10 to-(--gold-light)/10 border border-(--gold-primary)/20 hover:border-(--gold-primary)/50 transition-all duration-300 group"
                  >
                    <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">{value.icon}</div>
                    <h3 className="font-bold text-white mb-2">{value.title}</h3>
                    <p className="text-sm text-zinc-400">{value.desc}</p>
                  </div>
                ))}
              </div>
            </TiltCard>
          </Reveal>

          {/* Technology Section */}
          <Reveal>
            <TiltCard className="glass border border-(--gold-primary)/30 rounded-2xl p-6 md:p-8 bg-white/4 backdrop-blur-xl">
              <h2 className="text-2xl font-bold text-(--gold-primary) mb-6 flex items-center gap-3">
                <span className="text-3xl">⚙️</span>
                Powered By Modern Tech
              </h2>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs md:text-sm">
                {["Next.js 14", "React Server Components", "TypeScript 5", "Firebase v10", "Tailwind CSS v4", "Gemini AI API"].map((tech, idx) => (
                  <div
                    key={idx}
                    className="p-4 text-center rounded-lg bg-linear-to-br from-(--gold-primary)/5 to-(--gold-light)/5 border border-(--gold-primary)/20 hover:border-(--gold-primary)/50 transition-all cursor-default"
                  >
                    <p className="text-zinc-300 font-semibold">{tech}</p>
                  </div>
                ))}
              </div>
            </TiltCard>
          </Reveal>

          {/* Join Us CTA */}
          <Reveal>
            <TiltCard className="glass border border-(--gold-primary)/20 rounded-2xl p-8 md:p-12 text-center bg-white/4 backdrop-blur-xl">
              <h3 className="text-2xl md:text-3xl font-bold text-(--gold-primary) mb-4">
                Start Your Journey
              </h3>
              <p className="text-zinc-400 mb-8 max-w-lg mx-auto">
                Join the community. Connect with people worldwide.
              </p>
              <ShimmerButton onClick={() => router.push('/feed')}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Get Started</span>
              </ShimmerButton>
            </TiltCard>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
