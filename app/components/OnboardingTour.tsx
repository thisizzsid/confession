"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { doc, updateDoc, Firestore } from "firebase/firestore";
import { db } from "../../firebase";
import { X, ChevronRight, Home, PenSquare, MessageCircle, Bot, CheckCircle } from "lucide-react";

export default function OnboardingTour() {
  const { user } = useAuth();
  const [isVisible, setIsVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    // Check if user is logged in and hasn't seen the tour
    if (user && user.profile && user.profile.tourCompleted === undefined) {
      // Small delay to ensure smooth entrance after page load
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [user]);

  const completeTour = async () => {
    if (!user || !db) return;
    
    // Hide immediately for responsiveness
    setIsVisible(false);

    try {
      const ref = doc(db as Firestore, "users", user.uid);
      await updateDoc(ref, {
        tourCompleted: true
      });
    } catch (error) {
      console.error("Error updating tour status:", error);
    }
  };

  if (!isVisible) return null;

  const steps = [
    {
      title: "Welcome to Confession",
      description: "Your safe space for authentic, anonymous expression. Owned by SA Studios, crafted in USA. Let's show you around quickly.",
      icon: <div className="text-4xl">👋</div>,
      color: "from-blue-500 to-cyan-500"
    },
    {
      title: "Explore the Feed",
      description: "Read confessions from others. Support them with comments or connect if you resonate.",
      icon: <Home className="w-12 h-12 text-white" />,
      color: "from-purple-500 to-pink-500"
    },
    {
      title: "Share Your Story",
      description: "Post your own thoughts anonymously. No judgment, just pure expression.",
      icon: <PenSquare className="w-12 h-12 text-white" />,
      color: "from-amber-500 to-orange-500"
    },
    {
      title: "Private Chats",
      description: "Connect deeply. Chats unlock only when you and another user follow each other.",
      icon: <MessageCircle className="w-12 h-12 text-white" />,
      color: "from-green-500 to-emerald-500"
    },
    {
      title: "AI Companion",
      description: "Feeling lonely? Chat with Confession AI anytime for support or just a fun conversation.",
      icon: <Bot className="w-12 h-12 text-white" />,
      color: "from-indigo-500 to-blue-500"
    },
    {
      title: "You're All Set!",
      description: "Enjoy your journey on Confession by SA Studios. Remember to be kind and supportive — crafted in USA 🇺🇸.",
      icon: <CheckCircle className="w-12 h-12 text-white" />,
      color: "from-(--gold-primary) to-(--gold-light)"
    }
  ];

  const currentStepData = steps[step];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-[#121212] border border-(--gold-primary)/30 rounded-3xl shadow-2xl overflow-hidden relative flex flex-col">
        
        {/* Progress Bar */}
        <div className="h-1 bg-zinc-800 w-full">
          <div 
            className="h-full bg-(--gold-primary) transition-all duration-500 ease-out"
            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </div>

        {/* Close Button */}
        <button 
          onClick={completeTour}
          className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-white transition-colors z-20"
          aria-label="Close Tour"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="p-8 flex flex-col items-center text-center flex-1">
          
          {/* Animated Icon Container */}
          <div className={`
            w-24 h-24 rounded-full mb-6 flex items-center justify-center
            bg-linear-to-br ${currentStepData.color}
            shadow-lg shadow-[rgba(0,0,0,0.5)]
            animate-float
          `}>
            {currentStepData.icon}
          </div>

          <h3 className="text-2xl font-bold text-white mb-3 animate-slideInUp">
            {currentStepData.title}
          </h3>
          
          <p className="text-zinc-400 leading-relaxed mb-8 min-h-[80px] animate-slideInUp delay-100">
            {currentStepData.description}
          </p>

          {/* Controls */}
          <div className="flex items-center gap-4 w-full mt-auto">
            {step < steps.length - 1 ? (
              <>
                <button 
                  onClick={completeTour}
                  className="px-6 py-3 rounded-xl text-zinc-400 font-medium hover:text-white transition-colors"
                >
                  Skip
                </button>
                <button 
                  onClick={() => setStep(s => s + 1)}
                  className="flex-1 bg-(--gold-primary) text-black font-bold py-3 rounded-xl hover:bg-(--gold-light) transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button 
                onClick={completeTour}
                className="w-full bg-linear-to-r from-(--gold-primary) to-(--gold-light) text-black font-bold py-3 rounded-xl shadow-lg hover:shadow-(--gold-primary)/30 transition-all active:scale-95"
              >
                Get Started
              </button>
            )}
          </div>
        </div>

        {/* Dots Indicator */}
        <div className="pb-6 flex justify-center gap-2">
          {steps.map((_, i) => (
            <div 
              key={i}
              className={`
                w-2 h-2 rounded-full transition-all duration-300
                ${i === step ? "w-6 bg-(--gold-primary)" : "bg-zinc-700"}
              `}
            />
          ))}
        </div>

      </div>
    </div>
  );
}
