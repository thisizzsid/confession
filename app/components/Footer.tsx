import Link from "next/link";

export default function Footer() {
  return (
    <footer className="w-full glass border-t border-(--gold-primary)/10 sticky bottom-0 z-40 backdrop-blur-2xl">
      <div className="md:hidden h-10 px-3 flex items-center justify-center">
        <Link href="/feed" className="text-transparent bg-linear-to-r from-(--gold-primary) to-(--gold-light) bg-clip-text font-extrabold tracking-wide text-xs">
          Confession
        </Link>
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

        <Link href="/upcoming" className="flex items-center gap-2 px-2 py-1 rounded-full border border-(--gold-primary)/40 bg-(--gold-primary)/5 hover:bg-(--gold-primary)/10 transition-colors duration-300 group" title="Upcoming Features">
          <span className="w-1.5 h-1.5 rounded-full bg-(--gold-primary) animate-pulse"></span>
          <span className="text-(--gold-primary) font-semibold tracking-tight whitespace-nowrap">Upcoming</span>
        </Link>
      </div>
    </footer>
  );
}
