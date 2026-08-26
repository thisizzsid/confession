"use client";
import {
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  signInWithPhoneNumber,
  signInAnonymously,
  Auth,
} from "firebase/auth";
import { auth } from "../../firebase";
import { db } from "../../firebase";
import { doc, setDoc, getDoc, Timestamp, Firestore } from "firebase/firestore";
import { RecaptchaVerifier } from "firebase/auth";
import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext<any>(null);
let recaptcha: RecaptchaVerifier | null = null;
const ANONYMOUS_SESSION_PAUSED = "confession-anonymous-session-paused";

export const AuthContextProvider = ({ children }: any) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const isAnonymousSessionPaused = () => {
    try {
      return window.localStorage.getItem(ANONYMOUS_SESSION_PAUSED) === "true";
    } catch {
      return false;
    }
  };

  const clearAnonymousSessionPause = () => {
    try {
      window.localStorage.removeItem(ANONYMOUS_SESSION_PAUSED);
    } catch {}
  };

  const pauseAnonymousSession = () => {
    try {
      window.localStorage.setItem(ANONYMOUS_SESSION_PAUSED, "true");
    } catch {}
  };

  /** Ensure Firestore profile exists **/
  const ensureUserProfile = async (u: any) => {
    if (!u?.uid || !db) return;
    const ref = doc(db as Firestore, "users", u.uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      await setDoc(
        ref,
        {
          uid: u.uid,
          email: u.email || "",
          username: u.displayName || "Anonymous",
          bio: "",
          age: "",
          gender: "",
          location: "",
          joined: Timestamp.now(),
          isAnonymous: u.isAnonymous || false,
        },
        { merge: true }
      );
    } else {
      const dataToUpdate: any = {
        email: u.email || "",
        isAnonymous: u.isAnonymous || false,
      };

      // Only overwrite username if Auth profile has one (e.g. Google)
      // Preserves custom usernames for anonymous users
      if (u.displayName) {
        dataToUpdate.username = u.displayName;
      }

      await setDoc(ref, dataToUpdate, { merge: true });
    }
  };

  /** 
   * Anonymous Login Flow:
   * 1. Calls Firebase `signInAnonymously`.
   * 2. Firebase generates a unique UID and persists the session.
   * 3. `ensureUserProfile` creates a Firestore document for the user with `isAnonymous: true`.
   * 4. The `username` is set to "Anonymous" by default.
   * 5. User can later upgrade this account by linking email/Google (logic to be implemented if needed).
   **/
  const anonymousLogin = async () => {
    if (!auth || !db) return;
    const current = auth.currentUser;
    const res = current?.isAnonymous ? { user: current } : await signInAnonymously(auth);
    clearAnonymousSessionPause();
    await ensureUserProfile(res.user);
    const ref = doc(db as Firestore, "users", res.user.uid);
    const snap = await getDoc(ref);
    setUser({ ...res.user, profile: snap.data() || {} });
  };

  /** Google Auth **/
  const googleLogin = async () => {
    if (!auth) return;
    clearAnonymousSessionPause();
    const provider = new GoogleAuthProvider();
    const res = await signInWithPopup(auth, provider);
    await ensureUserProfile(res.user);
  };

  /** Email Signup **/
  const signupWithEmail = async (email: string, password: string) => {
    if (!auth) return;
    clearAnonymousSessionPause();
    const res = await createUserWithEmailAndPassword(auth, email, password);
    await ensureUserProfile(res.user);
  };

  /** Email Login **/
  const loginWithEmail = async (email: string, password: string) => {
    if (!auth) return;
    clearAnonymousSessionPause();
    const res = await signInWithEmailAndPassword(auth, email, password);
    await ensureUserProfile(res.user);
  };

  /** Password Reset **/
  const resetPassword = async (email: string) => {
    if (!auth) return;
    await sendPasswordResetEmail(auth, email);
    alert("Password reset email sent!");
  };

  /** Phone Login Setup **/
  const setupRecaptcha = () => {
    if (typeof window === "undefined" || !auth) return null;
    if (!recaptcha) {
      recaptcha = new RecaptchaVerifier(auth as Auth, "recaptcha-container", {
        size: "invisible",
      });
    }
    return recaptcha;
  };

  /** Send OTP **/
  const sendOTP = async (phone: string) => {
    if (!auth) return;
    const verifier = setupRecaptcha();
    if (!verifier) return;
    return signInWithPhoneNumber(auth, phone, verifier);
  };

  /** Verify OTP **/
  const verifyOTP = async (confirmation: any, code: string) => {
    const result = await confirmation.confirm(code);
    await ensureUserProfile(result.user);
    return result.user;
  };

  /** Logout **/
  const logout = async () => {
    if (!auth) return;
    if (auth.currentUser?.isAnonymous) {
      pauseAnonymousSession();
      setUser(null);
      return;
    }
    return signOut(auth);
  };

  /** Track user **/
  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, async (current) => {
      if (!current) {
        setUser(null);
        setLoading(false);
        return;
      }

      if (current.isAnonymous && isAnonymousSessionPaused()) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        await ensureUserProfile(current);
        if (!db) {
          setUser({ ...current, profile: {} });
          return;
        }
        const ref = doc(db as Firestore, "users", current.uid);
        const snap = await getDoc(ref);
        setUser({ ...current, profile: snap.data() || {} });
      } catch (error) {
        console.error("Auth profile load error:", error);
        setUser({ ...current, profile: {} });
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  /** Real-time Presence System **/
  useEffect(() => {
    if (!user?.uid || !db) return;

    const updatePresence = async () => {
      if (document.visibilityState === "visible") {
        try {
          const ref = doc(db as Firestore, "users", user.uid);
          await setDoc(ref, {
            lastSeen: Timestamp.now(),
            isOnline: true
          }, { merge: true });
        } catch (err) {
          // silent fail
        }
      }
    };

    // Initial update
    updatePresence();

    // Heartbeat every 60s
    const interval = setInterval(updatePresence, 60000);

    // Update on visibility change
    const handleVisibility = () => {
      if (document.visibilityState === "visible") updatePresence();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [user?.uid]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        googleLogin,
        signupWithEmail,
        loginWithEmail,
        resetPassword,
        logout,
        sendOTP,
        verifyOTP,
        anonymousLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
