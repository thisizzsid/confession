"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { useRef, useState, useEffect } from "react";
import { useAuth } from "@/app/context/AuthContext";
import { useNotifications } from "./NotificationSetup";
import { Bell, Home, Compass, LayoutDashboard, User, MessageCircle, LogOut, Sun, Moon, Handshake, Globe } from "lucide-react";
import { collection, onSnapshot, Firestore } from "firebase/firestore";
import { db } from "@/firebase";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { notificationEnabled } = useNotifications();
  const [notificationCount, setNotificationCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showCollabToast, setShowCollabToast] = useState(false);
  const [totalPostsCount, setTotalPostsCount] = useState(0);
  const sidebarTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(collection(db as Firestore, "posts"), (snap) => {
      setTotalPostsCount(snap.size);
    });
    return () => unsub();
  }, []);

  // Check for notifications on mount and interval
  useEffect(() => {
    const checkNotifications = () => {
      try {
        const stored = localStorage.getItem("notificationCount");
        if (stored) {
          const count = parseInt(stored);
          setNotificationCount(isNaN(count) ? 0 : count);
        }
      } catch (e) {
        console.error("Notification error:", e);
      }
    };

    checkNotifications();
    const interval = setInterval(checkNotifications, 5000);
    return () => clearInterval(interval);
  }, []);

  // Check for unread messages
  useEffect(() => {
    const checkMessages = () => {
      try {
        const stored = localStorage.getItem("unreadMessages");
        if (stored) {
          const count = parseInt(stored);
          setUnreadMessages(isNaN(count) ? 0 : count);
        }
      } catch (e) {
        console.error("Messages error:", e);
      }
    };

    checkMessages();
    const interval = setInterval(checkMessages, 5000);
    return () => clearInterval(interval);
  }, []);

  // Auto-hide sidebar after 3 seconds
  useEffect(() => {
    if (sidebarOpen) {
      sidebarTimeoutRef.current = setTimeout(() => {
        setSidebarOpen(false);
      }, 3000);
    }
    return () => {
      if (sidebarTimeoutRef.current) clearTimeout(sidebarTimeoutRef.current);
    };
  }, [sidebarOpen]);

  const isActive = (path: string) => {
    if (path === "/feed" && pathname === "/") return true;
    if (path !== "/" && pathname.startsWith(path)) return true;
    return pathname === path;
  };

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const handleNavClick = () => {
    setSidebarOpen(false);
  };

  const handleCollaborate = () => {
    // Show toast feedback
    setShowCollabToast(true);
    
    // Close sidebar on mobile
    setSidebarOpen(false);

    // Auto-hide toast after a few seconds
    setTimeout(() => {
      setShowCollabToast(false);
    }, 4000);
  };

  const handleSidebarInteraction = () => {
    if (sidebarTimeoutRef.current) clearTimeout(sidebarTimeoutRef.current);
  };

  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [showThemeNotice, setShowThemeNotice] = useState(false);
  const [targetTheme, setTargetTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("theme");
      const initial = stored === "light" ? "light" : "dark";
      setTheme(initial);
      document.documentElement.setAttribute("data-theme", initial);
    } catch {}
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTargetTheme(next);
    setShowThemeNotice(true);
    // Removed progress bar logic for a cleaner, faster transition
    
    setTimeout(() => {
      setTheme(next);
      try {
        localStorage.setItem("theme", next);
      } catch {}
      document.documentElement.setAttribute("data-theme", next);
    }, 800); // Switch halfway through

    setTimeout(() => {
      setShowThemeNotice(false);
    }, 1600);
  };


  if (!user) return null;

  return (
    <>
      <header className="fixed top-0 w-full h-16 glass border-b border-(--gold-primary)/20 z-50 flex items-center px-4 md:px-6">
        {/* Left: Menu Button (Mobile Only) */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="md:hidden flex items-center justify-center w-12 h-12 rounded-lg hover:bg-(--gold-primary)/10 transition-colors"
          aria-label="Toggle sidebar"
          type="button"
        >
          <svg
            className="w-6 h-6 text-(--gold-primary)"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>

        {/* Center: Logo */}
        <button
          onClick={() => router.push("/feed")}
          className="flex items-center gap-2 md:gap-3 text-xl md:text-3xl font-bold tracking-tight text-white hover:opacity-90 transition-all duration-500 group relative shrink-0"
          aria-label="Go to feed"
          type="button"
        >
          <div className="relative w-9 h-10 md:w-11 md:h-14 flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
            <div className="absolute inset-0 bg-linear-to-r from-(--gold-primary) to-(--gold-light) opacity-30 blur-xl group-hover:opacity-60 transition-opacity duration-500"></div>
            <Image
              src="/logoemesis.png"
              alt="Confession Logo"
              fill
              className="object-contain drop-shadow-[0_0_15px_rgba(var(--gold-primary-rgb),0.8)] relative z-10"
              sizes="40px"
            />
          </div>
          <span className="inline bg-linear-to-r from-(--gold-primary) via-(--gold-light) to-(--gold-primary) bg-clip-text text-transparent font-black tracking-tighter">
            Confession
          </span>
          <div className="absolute -bottom-1 left-0 w-0 h-0.75 bg-linear-to-r from-(--gold-primary) to-(--gold-light) group-hover:w-full transition-all duration-500"></div>
        </button>

        {/* Minimalist Live Counter */}
        <div className="flex items-center gap-2 ml-4 md:ml-8 px-2 md:px-3 py-1 md:py-1.5 rounded-full bg-white/5 border border-white/5 backdrop-blur-md">
          <div className="relative">
            <Globe className="w-3 md:w-3.5 h-3 md:h-3.5 text-(--gold-primary) animate-pulse" />
            <div className="absolute inset-0 bg-(--gold-primary)/20 blur-sm rounded-full animate-ping"></div>
          </div>
          <div className="flex flex-col leading-none">
            <span className="hidden sm:block text-[8px] md:text-[10px] font-black text-zinc-500 uppercase tracking-widest">Whispers</span>
            <span className="text-[10px] md:text-xs font-black text-white tabular-nums">{totalPostsCount.toLocaleString()}</span>
          </div>
        </div>

        {/* Right: Logout Button (Center-aligned on desktop, right-aligned on mobile) */}
        <div className="flex-1 flex items-center justify-end md:justify-center">
          <button
            onClick={toggleTheme}
            className={`relative mr-3 min-w-11 min-h-11 flex items-center justify-center p-2 rounded-xl transition-all duration-300 active:scale-95 group overflow-hidden ${
              theme === "light"
                ? "bg-zinc-900 text-white hover:bg-black hover:shadow-[0_0_20px_rgba(0,0,0,0.3)]"
                : "bg-(--gold-primary)/10 text-(--gold-primary) hover:bg-(--gold-primary)/20 hover:shadow-[0_0_20px] hover:shadow-(--gold-primary)/40 border border-(--gold-primary)/30"
            }`}
            aria-live="polite"
            type="button"
          >
            <div className="flex items-center gap-2 relative z-10">
              <svg
                className={`w-5 h-5 md:w-6 md:h-6 transition-transform duration-500 ${
                  theme === "dark" ? "group-hover:rotate-90" : "group-hover:-rotate-12"
                }`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                {theme === "light" ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                  />
                ) : (
                  <>
                    <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2" />
                    <path
                      d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </>
                )}
              </svg>
              <span className="hidden md:inline font-bold tracking-tight">
                {theme === "light" ? "Pitch Black" : "Light Mode"}
              </span>
            </div>
          </button>
          <button
            onClick={handleLogout}
            className="logout-btn relative min-w-11 min-h-11 flex items-center justify-center p-2 rounded-xl transition-all duration-200 active:scale-95 text-[#ff0033] hover:bg-[#ff0033]/10 hover:shadow-[0_0_20px_rgba(255,0,51,0.6)] group"
            type="button"
          >
            <svg
              className="w-5 h-5 md:w-6 md:h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            <span className="hidden md:inline ml-2">Logout</span>
          </button>
        </div>

        {/* Right: Notifications (Desktop Only) */}
        <div className="hidden md:flex items-center gap-2 ml-6">
          <div className="relative">
            <button className="alert-btn relative p-2" aria-label="Notifications" type="button">
              <Bell className="w-5 h-5" />
            </button>
            {notificationCount > 0 && (
              <span className="notification-badge absolute -top-2 -right-2">
                {notificationCount > 99 ? "99+" : notificationCount}
              </span>
            )}
          </div>
        </div>
        {showThemeNotice && (
          <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/80 backdrop-blur-2xl animate-fadeIn">
            {/* Ambient Background Glow */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-(--gold-primary)/15 via-transparent to-transparent opacity-50 animate-pulse"></div>
            
            <div className="relative z-10 flex flex-col items-center">
                {/* Sun / Moon Icon Container */}
                <div className="mb-12 relative z-10 transition-all duration-1000 transform">
                    <div className="absolute inset-0 bg-(--gold-primary) blur-[60px] opacity-20 animate-pulse"></div>
                    <div className="flex items-center justify-center">
                        {targetTheme === "light" ? (
                          <div className="animate-spin-slow text-(--gold-primary) drop-shadow-[0_0_50px_rgba(245,194,107,0.8)]">
                            <Sun className="w-24 h-24 md:w-32 md:h-32" strokeWidth={1} />
                          </div>
                        ) : (
                          <div className="animate-pulse text-zinc-300 drop-shadow-[0_0_50px_rgba(255,255,255,0.5)]">
                            <Moon className="w-24 h-24 md:w-32 md:h-32" strokeWidth={1} />
                          </div>
                        )}
                    </div>
                </div>
                
                {/* Minimalist Text */}
                <h2 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-linear-to-r from-(--gold-primary) via-white to-(--gold-primary) tracking-[0.3em] text-center uppercase animate-pulse mt-8">
                    {targetTheme === "light" ? "Light Mode" : "Dark Mode"}
                </h2>
                
                <div className="mt-4 h-[1px] w-24 bg-linear-to-r from-transparent via-(--gold-primary) to-transparent opacity-50"></div>
            </div>
          </div>
        )}
      </header>

      {/* SIDEBAR - Responsive (Mobile Slide-out, Desktop Fixed) */}
      <aside
        className={`fixed left-0 top-16 w-64 h-[calc(100vh-64px)] bg-black/40 backdrop-blur-xl border-r border-(--gold-primary)/15 transition-transform duration-300 z-40 flex flex-col overflow-y-auto ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0`}
        onMouseEnter={handleSidebarInteraction}
        onTouchStart={handleSidebarInteraction}
        onMouseLeave={() => {
          // Only auto-close on mobile
          if (window.innerWidth < 768) {
            sidebarTimeoutRef.current = setTimeout(() => {
              setSidebarOpen(false);
            }, 3000);
          }
        }}
      >
        {/* Navigation Items */}
        <div className="flex-1 px-3 py-6 space-y-2">
          <SidebarNavButton
            href="/feed"
            label="Feed"
            icon={Home}
            isActive={isActive("/feed")}
            onClick={handleNavClick}
          />

          <SidebarNavButton
            href="/explore"
            label="Explore"
            icon={Compass}
            isActive={isActive("/explore")}
            onClick={handleNavClick}
          />

          <SidebarNavButton
            href="/dashboard"
            label="Dashboard"
            icon={LayoutDashboard}
            isActive={isActive("/dashboard")}
            onClick={handleNavClick}
          />

          <SidebarNavButton
            href="/profile"
            label="Profile"
            icon={User}
            isActive={isActive("/profile")}
            onClick={handleNavClick}
          />

          <div className="relative">
            <SidebarNavButton
              href="/chat"
              label="Chat"
              icon={MessageCircle}
              isActive={isActive("/chat")}
              onClick={handleNavClick}
            />
            {unreadMessages > 0 && (
              <span className="absolute right-4 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-lg animate-pulse">
                {unreadMessages > 9 ? "9+" : unreadMessages}
              </span>
            )}
          </div>

          <div className="my-4 border-t border-(--gold-primary)/10 mx-2"></div>

          <SidebarNavButton
            href="https://wa.me/6205339833"
            label="Collaborate"
            icon={Handshake}
            isActive={false}
            onClick={handleCollaborate}
            target="_blank"
          />
        </div>

        {/* Notifications Section in Sidebar (Mobile Only mainly, but nice to have) */}
        <div className="border-t border-(--gold-primary)/15 p-4 bg-linear-to-t from-(--gold-primary)/5 to-transparent">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-(--gold-primary) uppercase tracking-wider flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${notificationCount > 0 ? "bg-red-500 animate-pulse" : "bg-zinc-700"}`}></span>
              Notifications
            </h3>
            {notificationCount > 0 && (
              <span className="text-[10px] bg-(--gold-primary)/20 text-(--gold-primary) px-2 py-0.5 rounded-full">
                {notificationCount} New
              </span>
            )}
          </div>
          {notificationCount === 0 ? (
            <p className="text-xs text-zinc-500 font-light italic">All caught up!</p>
          ) : (
            <p className="text-xs text-zinc-400">
              You have <span className="text-white font-bold">{notificationCount}</span> unread notifications.
            </p>
          )}
        </div>
      </aside>


      {/* Sidebar Backdrop - Mobile Only */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Collaboration Toast */}
      {showCollabToast && (
        <div className="fixed top-24 right-6 z-50 bg-black/80 backdrop-blur-xl border border-[#25D366]/50 text-white px-6 py-4 rounded-2xl shadow-[0_0_30px_rgba(37,211,102,0.3)] animate-fadeIn flex items-center gap-4">
          <div className="p-2 bg-[#25D366]/20 rounded-full">
            <svg className="w-6 h-6 text-[#25D366]" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          </div>
          <div>
            <h4 className="font-bold text-[#25D366]">Opening WhatsApp...</h4>
            <p className="text-xs text-zinc-400">Connecting you to our team.</p>
          </div>
        </div>
      )}
    </>
  );
}

// Modern Sidebar NavButton Component
function SidebarNavButton({
  href,
  label,
  icon: Icon,
  isActive,
  onClick,
  target,
}: {
  href: string;
  label: string;
  icon: any;
  isActive: boolean;
  onClick: () => void;
  target?: string;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      target={target}
      className={`group relative flex items-center gap-4 px-4 py-4 md:py-3.5 min-h-[56px] md:min-h-0 rounded-2xl transition-all duration-300 overflow-hidden ${
        isActive
          ? "text-(--gold-primary) shadow-[0_0_20px_color-mix(in_srgb,var(--gold-primary),transparent_85%)]"
          : "text-zinc-400 hover:text-(--gold-light)"
      }`}
    >
      {/* Active Background Gradient */}
      {isActive && (
        <div className="absolute inset-0 bg-linear-to-r from-(--gold-primary)/15 to-transparent opacity-100 transition-opacity duration-300"></div>
      )}
      
      {/* Hover Background */}
      <div className={`absolute inset-0 bg-(--gold-primary)/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${isActive ? 'hidden' : ''}`}></div>

      {/* Active Indicator Bar */}
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-(--gold-primary) rounded-r-full shadow-[0_0_10px_var(--gold-primary)]"></div>
      )}

      {/* Icon */}
      <Icon className={`w-5 h-5 shrink-0 transition-all duration-500 ${isActive ? 'drop-shadow-[0_0_8px_color-mix(in_srgb,var(--gold-primary),transparent_40%)] scale-110' : 'group-hover:scale-110 group-hover:drop-shadow-[0_0_5px_color-mix(in_srgb,var(--gold-primary),transparent_60%)]'}`} />

      {/* Label */}
      <span className={`font-medium tracking-wide transition-all duration-300 ${isActive ? 'translate-x-1' : 'group-hover:translate-x-1'}`}>
        {label}
      </span>
      
      {/* Subtle Glow on Hover */}
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-linear-to-l from-(--gold-primary)/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
    </Link>
  );
}
