"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import Image from "next/image";
import { useAuth } from "../context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import LoadingOverlay from "../components/LoadingOverlay";
import { Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, User, Ghost, Sparkles, MessageSquare, Shield, Zap } from "lucide-react";
import { db, auth } from "../../firebase";
import { doc, setDoc, Firestore } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { duration: 0.5, ease: "easeOut" } }
};

function AnimatedLogo() {
  return (
    <div className="loader" aria-label="Confession logo" role="img">
      <svg width="100" height="100" viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <mask id="clipping">
            <polygon points="0,0 100,0 100,100 0,100" fill="black" />
            <polygon points="25,25 75,25 50,75" fill="white" />
            <polygon points="50,25 75,75 25,75" fill="white" />
            <polygon points="35,35 65,35 50,65" fill="white" />
            <polygon points="35,35 65,35 50,65" fill="white" />
            <polygon points="35,35 65,35 50,65" fill="white" />
            <polygon points="35,35 65,35 50,65" fill="white" />
          </mask>
        </defs>
      </svg>
      <div className="box" />
    </div>
  );
}

function LoginContent() {
  const { googleLogin, loginWithEmail, signupWithEmail, resetPassword, anonymousLogin, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  useEffect(() => {
    const m = searchParams.get("mode");
    if (m === "signup") setMode("signup");
  }, [searchParams]);

  useEffect(() => {
    if (user) {
        setLoading(true);
        setTimeout(() => router.push("/feed"), 800);
    }
  }, [user, router]);

  // Particle System
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let animationFrame = 0;

    const resize = () => {
      c.width = window.innerWidth;
      c.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const style = getComputedStyle(document.documentElement);
    const goldPrimaryRgb = style.getPropertyValue('--gold-primary-rgb').trim() || "245, 194, 107";

    const particles: any[] = [];
    const count = reducedMotion ? 24 : 80;

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * c.width,
        y: Math.random() * c.height,
        r: Math.random() * 1.5 + 0.5,
        dx: (Math.random() - 0.5) * 0.5,
        dy: (Math.random() - 0.5) * 0.5,
        opacity: Math.random() * 0.4 + 0.1,
        color: `rgba(${goldPrimaryRgb},`
      });
    }

    function draw() {
      if (!ctx || !c) return;
      ctx.clearRect(0, 0, c.width, c.height);
      
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color} ${p.opacity})`;
        ctx.fill();
        
        p.x += p.dx;
        p.y += p.dy;
        
        if (p.x < 0 || p.x > c.width) p.dx *= -1;
        if (p.y < 0 || p.y > c.height) p.dy *= -1;

        // Draw connecting lines
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dist = Math.sqrt((p.x - p2.x)**2 + (p.y - p2.y)**2);
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(${goldPrimaryRgb}, ${0.1 * (1 - dist/100)})`;
            ctx.stroke();
          }
        }
      }
      if (!reducedMotion) animationFrame = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  const handleReset = () => {
    if (!email.trim()) return alert("Enter your email first");
    resetPassword(email);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
        if (mode === "signup") {
            if (!email || !password || !confirm || !username) {
                throw new Error("All fields are required.");
            }
            if (password !== confirm) {
                throw new Error("Passwords do not match.");
            }
            await signupWithEmail(email, password);
            
            // Create user document with username
            // Using auth.currentUser because context user might not be updated yet
            if (auth?.currentUser && db) {
                 const ref = doc(db as Firestore, "users", auth.currentUser.uid);
                 await setDoc(ref, { username }, { merge: true });
            }
        } else {
            await loginWithEmail(email, password);
        }
    } catch (e: any) {
        console.error(e);
        setLoading(false);
        if (e.code === 'auth/unauthorized-domain') {
          setError("Domain not authorized. Add to Firebase Console.");
        } else if (e.code === 'auth/too-many-requests') {
          setError("Too many attempts. Please wait.");
        } else if (e.code === 'auth/email-already-in-use') {
          setError("Email already in use.");
        } else if (e.code === 'auth/weak-password') {
          setError("Password should be at least 6 characters.");
        } else {
          setError(e.message || "Authentication failed");
        }
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");
    try {
        await googleLogin();
    } catch (e: any) {
        console.error(e);
        setLoading(false);
        setError(e.message || "Google login failed");
    }
  };

  const handleAnonymousLogin = async () => {
    setLoading(true);
    setError("");
    try {
        await anonymousLogin();
    } catch (e: any) {
         console.error(e);
         setLoading(false);
         if (e.code === 'auth/admin-restricted-operation') {
           setError("Anonymous auth disabled. Enable it in Firebase Console.");
         } else {
           setError(e.message || "Anonymous login failed");
         }
     }
   };

  return (
    <div className="min-h-dvh w-full relative flex items-center justify-center bg-(--background) selection:bg-(--gold-primary) selection:text-black overflow-hidden">
      <LoadingOverlay isLoading={loading} />
      
      {/* Background Elements */}
      <canvas ref={canvasRef} className="absolute inset-0 z-0 pointer-events-none" />
      <div className="absolute inset-0 bg-linear-to-br from-black/90 via-black/70 to-black/90 z-0" />
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,color-mix(in_srgb,var(--gold-primary),transparent_98%),transparent_80%)] pointer-events-none" />
      
      <div className="flex w-full max-w-6xl min-h-[calc(100dvh-2rem)] lg:min-h-[85vh] m-2 sm:m-4 md:m-10 relative z-10 glass-card rounded-3xl lg:rounded-[40px] border border-white/5 shadow-2xl overflow-hidden backdrop-blur-3xl">
        
        {/* Left Side: Branding (Desktop Only) */}
        <motion.div 
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="hidden lg:flex flex-1 relative flex-col justify-between p-12 xl:p-16 overflow-hidden border-r border-white/5"
        >
          {/* Animated Gradient Background */}
          <div className="absolute inset-0 bg-linear-to-br from-(--gold-primary)/5 via-transparent to-transparent animate-pulse" />
          
          <div className="relative z-10">
            <Link href="/" className="inline-flex items-center gap-3 group">
              <div className="auth-logo-shell group-hover:scale-110">
                <AnimatedLogo />
              </div>
            </Link>

            <div className="mt-20 space-y-8">
              <motion.h2 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.6 }}
                className="text-6xl font-black leading-tight text-white tracking-tight"
              >
                Release your <br />
                <span className="text-(--gold-primary) italic">thoughts</span> <br />
                into the void.
              </motion.h2>
              
              <div className="space-y-6">
                {[
                  { icon: MessageSquare, title: "Safe Haven", desc: "A secure space for anonymous confessions." },
                  { icon: Shield, title: "AI Moderated", desc: "Protected by advanced content analysis." },
                  { icon: Zap, title: "Instant Reach", desc: "Share with the global community instantly." }
                ].map((item, idx) => (
                  <motion.div 
                    key={idx}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.5 + (idx * 0.1), duration: 0.5 }}
                    className="flex items-start gap-4"
                  >
                    <div className="w-10 h-10 rounded-xl bg-(--gold-primary)/10 border border-(--gold-primary)/20 flex items-center justify-center shrink-0">
                      <item.icon className="w-5 h-5 text-(--gold-primary)" />
                    </div>
                    <div>
                      <h4 className="text-white font-bold">{item.title}</h4>
                      <p className="text-zinc-500 text-sm">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          <div className="relative z-10">
            <div className="flex items-center gap-4 text-zinc-500 text-sm">
              <span className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-(--gold-primary)" /> 50k+ Users</span>
              <span className="w-1 h-1 rounded-full bg-zinc-800" />
              <span>Built with TRAE AI</span>
            </div>
          </div>
        </motion.div>

        {/* Right Side: Auth Form */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="w-full lg:w-120 flex flex-col p-5 sm:p-8 md:p-12 bg-black/40"
        >
          {/* Mobile Logo */}
          <div className="lg:hidden flex justify-center mb-6 sm:mb-10">
            <div className="auth-logo-shell auth-logo-shell-mobile">
              <AnimatedLogo />
            </div>
          </div>

          <div className="mb-8">
            <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2">
              {mode === 'login' ? 'Welcome Back' : 'Create Account'}
            </h3>
            <p className="text-zinc-500 text-sm">
              {mode === 'login' ? 'Please enter your details to sign in.' : 'Join the community of truth-seekers.'}
            </p>
          </div>

          {/* Mode Toggle */}
          <div className="flex p-1 bg-white/5 rounded-2xl mb-8 relative border border-white/5">
            <motion.div 
              layoutId="toggle"
              className="absolute inset-y-1 w-[calc(50%-4px)] bg-(--gold-primary) rounded-xl shadow-lg"
              initial={false}
              animate={{ x: mode === 'login' ? 0 : '100%' }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            />
            <button 
              onClick={() => setMode('login')} 
              className={`flex-1 py-3 text-sm font-black relative z-10 transition-colors duration-300 ${mode === 'login' ? 'text-black' : 'text-zinc-500 hover:text-white'}`}
            >
              LOG IN
            </button>
            <button 
              onClick={() => setMode('signup')} 
              className={`flex-1 py-3 text-sm font-black relative z-10 transition-colors duration-300 ${mode === 'signup' ? 'text-black' : 'text-zinc-500 hover:text-white'}`}
            >
              SIGN UP
            </button>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ x: 10, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -10, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {error && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold text-center flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4 rotate-180" />
                  {error}
                </motion.div>
              )}

              <form onSubmit={handleAuth} className="space-y-4">
                {mode === 'signup' && (
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600 group-focus-within:text-(--gold-primary) transition-colors" />
                    <input
                      type="text"
                      placeholder="Username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white/5 border border-white/5 text-white placeholder:text-zinc-600 focus:border-(--gold-primary)/30 focus:ring-1 focus:ring-(--gold-primary)/20 outline-none transition-all"
                      required
                    />
                  </div>
                )}

                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600 group-focus-within:text-(--gold-primary) transition-colors" />
                  <input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white/5 border border-white/5 text-white placeholder:text-zinc-600 focus:border-(--gold-primary)/30 focus:ring-1 focus:ring-(--gold-primary)/20 outline-none transition-all"
                    required
                  />
                </div>

                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600 group-focus-within:text-(--gold-primary) transition-colors" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-12 py-4 rounded-2xl bg-white/5 border border-white/5 text-white placeholder:text-zinc-600 focus:border-(--gold-primary)/30 focus:ring-1 focus:ring-(--gold-primary)/20 outline-none transition-all"
                    required
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white transition-colors p-1"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>

                {mode === 'signup' && (
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600 group-focus-within:text-(--gold-primary) transition-colors" />
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Confirm Password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white/5 border border-white/5 text-white placeholder:text-zinc-600 focus:border-(--gold-primary)/30 focus:ring-1 focus:ring-(--gold-primary)/20 outline-none transition-all"
                      required
                    />
                  </div>
                )}

                {mode === 'login' && (
                  <div className="flex justify-end">
                    <button type="button" onClick={handleReset} className="text-xs font-bold text-zinc-500 hover:text-(--gold-primary) transition-colors">
                      Forgot password?
                    </button>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 rounded-2xl bg-linear-to-r from-(--gold-primary) to-(--gold-light) text-black font-black text-sm hover:shadow-[0_0_30px_color-mix(in_srgb,var(--gold-primary),transparent_80%)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group/btn mt-4"
                >
                  <span>{loading ? "PROCESSING..." : mode === 'login' ? "SIGN IN" : "CREATE ACCOUNT"}</span>
                  <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                </button>
              </form>

              <div className="relative flex items-center gap-4 py-2">
                <div className="flex-1 h-px bg-white/5" />
                <span className="text-[10px] font-black text-zinc-600 tracking-widest uppercase">Social Access</span>
                <div className="flex-1 h-px bg-white/5" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-white/5 border border-white/5 text-white text-xs font-bold hover:bg-white/10 hover:border-white/20 transition-all group/google"
                >
                  <div className="p-0.5 bg-white rounded-full">
                    <Image src="/google.png" alt="Google" width={16} height={16} className="object-contain" />
                  </div>
                  <span>GOOGLE</span>
                </button>

                <button
                  type="button"
                  onClick={handleAnonymousLogin}
                  disabled={loading}
                  className="flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-zinc-900/50 border border-white/5 text-zinc-400 text-xs font-bold hover:bg-zinc-800 hover:text-white transition-all group/anon"
                >
                  <Ghost className="w-4 h-4" />
                  <span>ANONYMOUS</span>
                </button>
              </div>

              <div className="text-center pt-4">
                <p className="text-zinc-500 text-xs font-bold">
                  {mode === 'login' ? "New here? " : "Already joined? "}
                  <button 
                    onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                    className="text-(--gold-primary) hover:underline underline-offset-4"
                  >
                    {mode === 'login' ? "CREATE ACCOUNT" : "SIGN IN"}
                  </button>
                </p>
                
                <div className="mt-8 flex items-center justify-center gap-2 text-green-500/60 font-black text-[10px] tracking-widest uppercase">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Secure & Private</span>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen bg-black text-(--gold-primary)">
        <div className="w-10 h-10 border-2 border-(--gold-primary) border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}