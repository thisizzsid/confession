"use client";

import Link from "next/link";
import { Check, Palette } from "lucide-react";
import { AppTheme, useTheme } from "../context/ThemeContext";

const themeOptions: { id: AppTheme; label: string; detail: string }[] = [
  { id: "default", label: "Default", detail: "Charcoal & sage" },
  { id: "doodle", label: "Doodle", detail: "Warm and playful" },
  { id: "minimalist", label: "Minimalist", detail: "Quiet monochrome" },
  { id: "plain", label: "Plain", detail: "Clean and bright" },
];

export default function Footer() {
  const { theme, setTheme } = useTheme();

  return (
    <footer className="w-full glass border-t border-(--gold-primary)/10 sticky bottom-0 z-40 backdrop-blur-2xl">
      <div className="h-12 md:hidden px-3 flex items-center justify-between">
        <Link href="/feed" className="text-transparent bg-linear-to-r from-(--gold-primary) to-(--gold-light) bg-clip-text font-extrabold tracking-wide text-xs">
          Confession
        </Link>
        <ThemePicker theme={theme} setTheme={setTheme} />
      </div>

      <div className="hidden md:flex max-w-6xl mx-auto items-center justify-between text-zinc-400 text-xs font-medium gap-4 py-2 px-6">
        <p className="text-transparent bg-linear-to-r from-(--gold-primary) to-(--gold-light) bg-clip-text font-bold tracking-wide text-xs whitespace-nowrap">
          Confession © {new Date().getFullYear()} · Owned by SA Studios · Crafted in USA 🇺🇸
        </p>

        <div className="flex gap-6 flex-wrap justify-center">
          <Link href="/privacy" className="hover:text-(--gold-primary) transition-colors duration-300 tracking-tight whitespace-nowrap">
            Privacy
          </Link>

          <Link href="/terms" className="hover:text-(--gold-primary) transition-colors duration-300 tracking-tight whitespace-nowrap">
            Terms
          </Link>
          
          <Link href="/contact" className="hover:text-(--gold-primary) transition-colors duration-300 tracking-tight whitespace-nowrap">
            Contact
          </Link>
          
          <Link href="/about" className="hover:text-(--gold-primary) transition-colors duration-300 tracking-tight whitespace-nowrap">
            About
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/upcoming" className="flex items-center gap-2 px-2 py-1 rounded-full border border-(--gold-primary)/40 bg-(--gold-primary)/5 hover:bg-(--gold-primary)/10 transition-colors duration-300 group" title="Upcoming Features">
            <span className="w-1.5 h-1.5 rounded-full bg-(--gold-primary) animate-pulse"></span>
            <span className="text-(--gold-primary) font-semibold tracking-tight whitespace-nowrap">Upcoming</span>
          </Link>
          <ThemePicker theme={theme} setTheme={setTheme} />
        </div>
      </div>
    </footer>
  );
}

function ThemePicker({ theme, setTheme }: { theme: AppTheme; setTheme: (theme: AppTheme) => void }) {
  return (
    <details className="theme-picker relative">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-md border border-(--gold-primary)/25 bg-(--gold-primary)/5 px-2 py-1 text-[11px] font-semibold text-(--gold-primary) transition-colors hover:bg-(--gold-primary)/10" title="Choose app theme">
        <Palette size={13} aria-hidden="true" />
        <span>Theme</span>
      </summary>
      <div className="absolute bottom-[calc(100%+0.6rem)] right-0 w-52 rounded-xl border border-(--gold-primary)/25 bg-(--dark-card) p-1.5 shadow-2xl backdrop-blur-xl">
        <p className="px-2.5 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">App theme</p>
        {themeOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setTheme(option.id)}
            className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-(--gold-primary)/10"
          >
            <span>
              <span className="block text-xs font-semibold text-(--text-main)">{option.label}</span>
              <span className="block text-[10px] text-zinc-500">{option.detail}</span>
            </span>
            {theme === option.id && <Check size={15} className="text-(--gold-primary)" aria-hidden="true" />}
          </button>
        ))}
      </div>
    </details>
  );
}
