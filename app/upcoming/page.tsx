"use client";

import { useRouter } from "next/navigation";

export default function UpcomingPage() {
  const router = useRouter();

  const features = [
    {
      version: "v2.0.1",
      date: "Q1 2026",
      features: [
        "Advanced user analytics dashboard",
        "Real-time activity feeds",
        "Enhanced notification preferences",
        "Custom profile themes",
        "Story/Reel functionality",
        "Improved search algorithm",
      ],
    },
    {
      version: "v2.0.2",
      date: "Q2 2026",
      features: [
        "AI-powered content recommendations",
        "Video calling integration",
        "Live streaming capabilities",
        "Advanced privacy controls",
        "Hashtag trending system",
        "User verification badges",
      ],
    },
    {
      version: "v2.0.3",
      date: "Q3 2026",
      features: [
        "NFT/Digital collectibles support",
        "Community groups & forums",
        "Event scheduling system",
        "Marketplace for digital goods",
        "Advanced content moderation AI",
        "Multi-language support",
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-linear-to-br from-[#0A0A0A] via-black to-[#0A0A0A] text-(--gold-primary) flex flex-col">
      {/* Header */}
      <div className="relative pt-6 pb-12 px-4 md:px-6">
        <div className="absolute inset-0 bg-linear-to-b from-(--gold-primary)/5 to-transparent"></div>
        
        <div className="relative max-w-4xl mx-auto text-center">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-(--gold-primary) hover:text-(--gold-light) mb-6 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>

          <h1 className="text-4xl md:text-5xl font-black mb-4 bg-linear-to-r from-(--gold-primary) to-(--gold-light) bg-clip-text text-transparent">
            🚀 Confession Roadmap
          </h1>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
            Discover what's coming to Confession by SA Studios. We're constantly innovating to bring you the best social experience — crafted in USA.
          </p>
        </div>
      </div>

      {/* Features Timeline */}
      <div className="flex-1 px-4 md:px-6 pb-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {features.map((release, index) => (
            <div
              key={index}
              className="group glass border border-(--gold-primary)/30 rounded-2xl p-6 md:p-8 hover:border-(--gold-primary)/60 transition-all duration-300 hover:shadow-2xl hover:shadow-(--gold-primary)/20"
            >
              {/* Version Header */}
              <div className="flex items-center justify-between mb-6 pb-6 border-b border-(--gold-primary)/20">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-(--gold-primary) mb-1">
                    {release.version}
                  </h2>
                  <p className="text-sm text-zinc-400 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-(--gold-primary)"></span>
                    Coming {release.date}
                  </p>
                </div>
                <div className="text-4xl">✨</div>
              </div>

              {/* Features List */}
              <div className="space-y-3">
                {release.features.map((feature, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 group/item"
                  >
                    <div className="shrink-0 w-6 h-6 rounded-full bg-linear-to-br from-(--gold-primary) to-(--gold-light) flex items-center justify-center mt-0.5 group-hover/item:scale-110 transition-transform">
                      <svg className="w-4 h-4 text-black" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="text-zinc-300 group-hover/item:text-(--gold-primary) transition-colors">
                      {feature}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Call to Action */}
        <div className="max-w-4xl mx-auto mt-12 text-center">
          <div className="glass border border-(--gold-primary)/20 rounded-2xl p-8 md:p-12 text-center">
            <h3 className="text-2xl md:text-3xl font-bold text-(--gold-primary) mb-4">
              Stay Updated! 🔔
            </h3>
            <p className="text-zinc-400 mb-6">
              Enable notifications to get alerts when new features are released.
            </p>
            <button
              type="button"
              onClick={() => window.location.href = '/feed'}
              className="inline-flex items-center gap-2 px-6 py-3 bg-linear-to-r from-(--gold-primary) to-(--gold-light) text-black font-bold rounded-xl hover:shadow-2xl hover:shadow-(--gold-primary)/50 transition-all duration-300 hover:scale-105 active:scale-95"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.5 1.5H2.75A1.25 1.25 0 001.5 2.75v14.5A1.25 1.25 0 002.75 18.5h14.5a1.25 1.25 0 001.25-1.25V9.5M18.5 1.5v9m0 0l-3-3m3 3l3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
              Back to Feed
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
