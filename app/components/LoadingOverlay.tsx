"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

interface LoadingOverlayProps {
  isLoading: boolean;
}

export default function LoadingOverlay({ isLoading }: LoadingOverlayProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isLoading) {
      setShow(true);
    } else {
      // Small delay to allow exit animation
      const timer = setTimeout(() => setShow(false), 500);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  if (!show) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md transition-opacity duration-500 ${
        isLoading ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="relative flex flex-col items-center">
        <div className="relative w-32 h-32 md:w-40 md:h-40 animate-pulse">
          <div className="absolute inset-0 bg-linear-to-r from-(--gold-primary)/40 to-(--gold-light)/30 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute inset-2 rounded-2xl bg-black/60 backdrop-blur-md border border-(--gold-primary)/30"></div>
          <Image
            src="/logo.png"
            alt="Confession Loading..."
            fill
            className="object-contain drop-shadow-[0_0_30px_rgba(var(--gold-primary-rgb),0.9)] relative z-10 p-4"
          />
        </div>
        <div className="mt-8 flex gap-3">
          <div className="w-3 h-3 rounded-full bg-(--gold-primary) animate-bounce [animation-delay:-0.3s] shadow-[0_0_15px_var(--gold-primary)]"></div>
          <div className="w-3 h-3 rounded-full bg-(--gold-primary) animate-bounce [animation-delay:-0.15s] shadow-[0_0_15px_var(--gold-primary)]"></div>
          <div className="w-3 h-3 rounded-full bg-(--gold-primary) animate-bounce shadow-[0_0_15px_var(--gold-primary)]"></div>
        </div>
      </div>
    </div>
  );
}
