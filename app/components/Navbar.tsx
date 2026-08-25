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

const LOCAL_RADIUS_KM = 2;

const distanceInKm = (latitudeA: number, longitudeA: number, latitudeB: number, longitudeB: number) => {
  const earthRadiusKm = 6371;
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(latitudeB - latitudeA);
  const longitudeDelta = radians(longitudeB - longitudeA);
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(latitudeA)) * Math.cos(radians(latitudeB)) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const notifications = useNotifications() as any;
  const notificationEnabled = notifications.notificationEnabled || notifications.enabled;
  const unreadCount: number = (notifications.unreadCount ?? 0) as number;
  const setOpenDrawer = notifications.setOpenDrawer;
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showCollabToast, setShowCollabToast] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [totalPostsCount, setTotalPostsCount] = useState(0);
  const [nearbyPostsCount, setNearbyPostsCount] = useState<number | null>(null);
  const sidebarTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(collection(db as Firestore, "posts"), (snap) => {
      const posts = snap.docs.map((post) => post.data());
      setTotalPostsCount(posts.length);

      const updateNearbyCount = (position: GeolocationPosition) => {
        const { latitude, longitude } = position.coords;
        const nearby = posts.filter((post) =>
          typeof post.latitude === "number" &&
          typeof post.longitude === "number" &&
          distanceInKm(latitude, longitude, post.latitude, post.longitude) <= LOCAL_RADIUS_KM
        );
        setNearbyPostsCount(nearby.length);
      };

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(updateNearbyCount, () => setNearbyPostsCount(null), {
          maximumAge: 300000,
          timeout: 5000,
        });
      }
    });
    return () => unsub();
  }, []);

  // Check for notifications on mount and interval
  const notificationCount = unreadCount;

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
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
      router.replace("/login");
    } catch (error) {
      console.error("Logout error:", error);
      setLoggingOut(false);
    }
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
      <header className="fixed top-0 w-full z-50">
        <div className="absolute inset-0 h-[200%] bg-[radial-gradient(ellipse_at_top,_color-mix(in_srgb,var(--gold-primary),transparent_88%),_transparent_60%)] pointer-events-none"></div>
        <div className="relative h-[72px] md:h-20 glass border-b border-white/5 flex items-center px-3 md:px-8">
          <div className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-linear-to-r from-transparent via-(--gold-primary)/40 to-transparent"></div>

          {/* Left Section: Menu (mobile) + Branding */}
          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden flex items-center justify-center w-11 h-11 rounded-xl hover:bg-white/5 border border-white/5 hover:border-(--gold-primary)/30 transition-all active:scale-95"
              aria-label="Toggle sidebar"
              type="button"
            >
              <svg
                className="w-5 h-5 text-(--gold-primary)"
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

            {/* Branding: Title Only */}
            <button
              onClick={() => router.push("/feed")}
              className="flex items-center group relative shrink-0"
              aria-label="Go to feed"
              type="button"
            >
              <div className="flex flex-col items-start leading-none">
                <span className="text-2xl md:text-[32px] font-black tracking-tighter bg-linear-to-r from-(--gold-primary) via-white via-55% to-(--gold-light) bg-clip-text text-transparent drop-shadow-[0_0_22px_rgba(var(--gold-primary-rgb),0.35)]">
                  Confession
                </span>
                <span className="hidden sm:flex items-center gap-1.5 mt-1.5">
                  <span className="w-1 h-1 rounded-full bg-(--gold-primary) animate-pulse"></span>
                  <span className="text-[9px] md:text-[10px] font-bold text-zinc-500 uppercase tracking-[0.22em]">
                    by SA Studios
                  </span>
                </span>
              </div>

              <div className="absolute -bottom-1.5 left-0 h-[2px] w-0 bg-linear-to-r from-(--gold-primary) via-(--gold-light) to-transparent group-hover:w-full transition-all duration-500"></div>
            </button>
          </div>

          {/* Center Spacer */}
          <div className="flex-1" />

          {/* Middle: Live Counter */}
          <div className="hidden sm:flex items-center gap-3 px-4 py-2 rounded-2xl bg-white/[0.03] border border-white/5 backdrop-blur-md group/counter hover:border-(--gold-primary)/20 transition-all duration-300">
            <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-(--gold-primary)/10 border border-(--gold-primary)/20">
              <Globe className="w-4 h-4 text-(--gold-primary) animate-pulse" />
              <div className="absolute inset-0 rounded-xl bg-(--gold-primary)/10 blur-md animate-ping"></div>
            </div>
            <div className="flex flex-col leading-tight pr-1">
              <span className="text-[8px] md:text-[9px] font-black text-zinc-500 uppercase tracking-[0.18em]">
                {nearbyPostsCount === null ? "Live Whispers" : "Nearby Whispers"}
              </span>
              <span className="text-sm md:text-[15px] font-black text-white tabular-nums tracking-tight">
                {(nearbyPostsCount ?? totalPostsCount).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Right Section: Grouped Actions */}
          <div className="flex items-center gap-1.5 md:gap-2 ml-2 md:ml-6 p-1 rounded-2xl bg-white/[0.03] border border-white/5 backdrop-blur-sm">
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setOpenDrawer?.(!notifications.openDrawer)}
                className="alert-btn relative w-10 h-10 md:w-11 md:h-11 flex items-center justify-center rounded-xl hover:bg-white/[0.07] transition-all duration-200 active:scale-95 group/notif"
                aria-label="Notifications"
                type="button"
              >
                <Bell className={`w-[18px] h-[18px] md:w-5 md:h-5 text-zinc-400 group-hover/notif:text-white transition-colors ${notificationCount > 0 ? "text-(--gold-primary) animate-[wiggle_1s_ease-in-out_infinite]" : ""}`} />
              </button>
              {notificationCount > 0 && (
                <span className="notification-badge absolute -top-0.5 -right-0.5 !w-auto !min-w-[18px] h-[18px] px-1 text-[9px] font-black">
                  {notificationCount > 99 ? "99+" : notificationCount}
                </span>
              )}
            </div>

            <div className="w-px h-6 bg-white/5 mx-0.5"></div>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className={`relative w-10 h-10 md:w-11 md:h-11 flex items-center justify-center rounded-xl transition-all duration-300 active:scale-95 group/theme overflow-hidden ${
                theme === "light"
                  ? "bg-zinc-900 text-white hover:bg-black hover:shadow-[0_0_20px_rgba(0,0,0,0.25)]"
                  : "text-zinc-400 hover:text-(--gold-primary) hover:bg-(--gold-primary)/[0.08]"
              }`}
              aria-live="polite"
              type="button"
              title={theme === "light" ? "Switch to Pitch Black" : "Switch to Light Mode"}
            >
              <svg
                className={`w-[18px] h-[18px] md:w-5 md:h-5 transition-transform duration-500 ${
                  theme === "dark" ? "group-hover/theme:rotate-90" : "group-hover/theme:-rotate-12"
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
            </button>

            <div className="w-px h-6 bg-white/5 mx-0.5"></div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="logout-btn relative w-10 h-10 md:w-11 md:h-11 flex items-center justify-center rounded-xl transition-all duration-200 active:scale-95 text-zinc-400 hover:text-[#ff0033] hover:bg-[#ff0033]/[0.08] group/logout"
              type="button"
              title="Logout"
            >
              <svg
                className="w-[18px] h-[18px] md:w-5 md:h-5"
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
            </button>
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
        className={`fixed left-0 top-[72px] md:top-20 w-64 h-[calc(100vh-72px)] md:h-[calc(100vh-80px)] bg-black/40 backdrop-blur-xl border-r border-(--gold-primary)/15 transition-transform duration-300 z-40 flex flex-col overflow-y-auto ${
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
              href="/notifications"
              label="Notifications"
              icon={Bell}
              isActive={isActive("/notifications")}
              onClick={() => {
                setOpenDrawer?.(true);
                handleNavClick();
              }}
            />
            {notificationCount > 0 && (
              <span className="absolute right-4 top-1/2 -translate-y-1/2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-lg animate-pulse px-1">
                {notificationCount > 9 ? "9+" : notificationCount}
              </span>
            )}
          </div>

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
