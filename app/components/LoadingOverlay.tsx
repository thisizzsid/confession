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
        <div className="w-20 h-20 relative animate-pulse">
          <Image
            src="/logoemesis.png"
            alt="Confession Loading..."
            fill
            className="object-contain drop-shadow-[0_0_15px_var(--gold-primary)]"
          />
        </div>
        <div className="mt-4 flex gap-2">
          <div className="w-2 h-2 rounded-full bg-(--gold-primary) animate-bounce [animation-delay:-0.3s]"></div>
          <div className="w-2 h-2 rounded-full bg-(--gold-primary) animate-bounce [animation-delay:-0.15s]"></div>
          <div className="w-2 h-2 rounded-full bg-(--gold-primary) animate-bounce"></div>
        </div>
      </div>
    </div>
  );
}
