"use client";

import { usePathname } from "next/navigation";
import Image from "next/image";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import OnboardingTour from "./components/OnboardingTour";
import { PageTransition } from "./components/Motion";
import { useAuth } from "./context/AuthContext";
import { useState, useEffect } from "react";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user } = useAuth();

  const [showSplash, setShowSplash] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    let shouldShowSplash = false;
    try {
      shouldShowSplash = window.localStorage.getItem("confession-splash-seen") !== "true";
      if (shouldShowSplash) window.localStorage.setItem("confession-splash-seen", "true");
    } catch {
      shouldShowSplash = false;
    }

    if (!shouldShowSplash) return;
    setShowSplash(true);
    // Start fading out after 2 seconds
    const timer1 = setTimeout(() => {
      setIsFadingOut(true);
    }, 2000);

    // Unmount after fade out completes (0.5s)
    const timer2 = setTimeout(() => {
      setShowSplash(false);
    }, 2500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  const isLoginPage = pathname === "/login" || pathname === "/signup" || pathname === "/onboarding";
  const isChatRoom = pathname.startsWith("/chat/");

  return (
    <>
      {showSplash && (
        <div 
          className={`fixed inset-0 z-100 flex flex-col items-center justify-center bg-(--dark-base) text-(--text-main) transition-opacity duration-500 ${isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        >
            <div className="text-center px-4">
              <h1 className="text-4xl md:text-6xl font-bold mb-4 text-(--gold-primary) animate-fadeIn">Welcome to Confession</h1>
              <p className="text-lg md:text-xl text-(--text-main) opacity-80 animate-slideInUp [animation-delay:300ms]">
                A safe space for everyone — Owned by SA Studios, Crafted in USA 🇺🇸
              </p>

              {/* Secured By Badge */}
              <div className="mt-16 flex flex-col items-center gap-3 animate-fadeIn [animation-delay:600ms]">
                <p className="text-xs text-zinc-500 uppercase tracking-[0.2em] font-mono">Powered & Secured By</p>
                <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-6 py-3 rounded-full backdrop-blur-md shadow-[0_0_20px_rgba(0,0,0,0.3)] hover:border-(--gold-primary)/40 transition-colors duration-500">
                   <div className="relative w-6 h-6">
                      <Image 
                        src="/google.png" 
                        alt="Google" 
                        fill 
                        sizes="24px"
                        className="object-contain opacity-90" 
                      />
                   </div>
                   <span className="text-sm font-semibold text-zinc-200 tracking-wide">Google Firebase</span>
                </div>
              </div>
            </div>
        </div>
      )}

      {!isChatRoom && <Navbar />}
      {!isChatRoom && <OnboardingTour />}
      <main
        className={`flex-1 overflow-y-auto overflow-x-hidden ios-smooth-scroll ${
          isLoginPage || isChatRoom ? "" : "pb-24 md:pb-20 pt-18 md:pt-20 md:ml-64 safe-area-bottom"
        }`}
      >
        <PageTransition>{children}</PageTransition>
      </main>
      {!isLoginPage && !isChatRoom && <Footer />}
    </>
  );
}
