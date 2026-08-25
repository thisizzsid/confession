"use client";
import { useState } from "react";
import { db } from "../../firebase";
import { doc, updateDoc, Firestore } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [gender, setGender] = useState("");
  const [age, setAge] = useState("");
  const [location, setLocation] = useState("");

  const save = async () => {
    if (!user || !db) return;
    const ref = doc(db as Firestore, "users", user.uid);
    await updateDoc(ref, {
      username,
      gender,
      age,
      location,
    });
    router.push("/feed");
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-linear-to-br from-[#0A0A0A] via-black to-[#0A0A0A] text-(--gold-primary) relative py-10 px-4">
      {/* Background Elements */}
      <div className="fixed top-20 right-20 w-96 h-96 bg-(--gold-primary)/10 rounded-full blur-3xl animate-float pointer-events-none"></div>
      <div className="fixed bottom-20 left-20 w-96 h-96 bg-[#00F0FF]/5 rounded-full blur-3xl animate-float animation-delay-2000 pointer-events-none"></div>

      <div className="w-full max-w-2xl glass rounded-3xl p-6 md:p-12 border-2 border-(--gold-primary)/30 shadow-2xl relative z-10">
        {/* Welcome Message */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-(--gold-primary) to-(--gold-light) flex items-center justify-center shadow-2xl shadow-(--gold-primary)/50 animate-pulse-glow mx-auto mb-4">
            <span className="text-3xl">🇮🇳</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-transparent bg-linear-to-r from-(--gold-primary) to-(--gold-light) bg-clip-text mb-3">
            Welcome to Confession
          </h2>
          <p className="text-zinc-400 text-sm md:text-base leading-relaxed max-w-lg mx-auto mb-4">
            A <strong className="text-(--gold-primary)">100% FREE</strong> platform for authentic expression and connection.
            Owned by SA Studios · Crafted with care in the USA 🇺🇸
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-(--gold-primary)/10 border border-(--gold-primary)/30">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <span className="text-xs font-semibold text-(--gold-primary)">Free Forever • No Hidden Charges</span>
          </div>
        </div>

        <h3 className="text-xl font-bold text-(--gold-primary) mb-6 text-center">
          Complete Your Profile
        </h3>

        <div className="space-y-4">
          <input
            className="w-full p-4 bg-black/60 border-2 border-(--gold-primary)/30 rounded-xl text-(--gold-primary) focus:border-(--gold-primary) transition-all duration-300 placeholder:text-(--gold-primary)/40 font-medium"
            placeholder="Choose a username"
            value={username}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
          />
          <input
            className="w-full p-4 bg-black/60 border-2 border-(--gold-primary)/30 rounded-xl text-(--gold-primary) focus:border-(--gold-primary) transition-all duration-300 placeholder:text-(--gold-primary)/40 font-medium"
            placeholder="Gender (Optional)"
            value={gender}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGender(e.target.value)}
          />
          <input
            className="w-full p-4 bg-black/60 border-2 border-(--gold-primary)/30 rounded-xl text-(--gold-primary) focus:border-(--gold-primary) transition-all duration-300 placeholder:text-(--gold-primary)/40 font-medium"
            placeholder="Age (Optional)"
            value={age}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAge(e.target.value)}
          />
          <input
            className="w-full p-4 bg-black/60 border-2 border-(--gold-primary)/30 rounded-xl text-(--gold-primary) focus:border-(--gold-primary) transition-all duration-300 placeholder:text-(--gold-primary)/40 font-medium"
            placeholder="Location (Optional)"
            value={location}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLocation(e.target.value)}
          />
        </div>

        <button
          onClick={save}
            className="w-full mt-6 bg-linear-to-r from-(--gold-primary) to-(--gold-light) text-black py-4 rounded-2xl font-bold shadow-xl shadow-(--gold-primary)/30 hover:shadow-2xl hover:shadow-(--gold-primary)/50 transition-all duration-300 hover:scale-105 active:scale-95"
        >
          Save & Continue to Feed
        </button>

        <p className="text-center text-zinc-600 text-xs mt-4">
          Your privacy is our priority. All data is encrypted and secure.
        </p>
      </div>
    </div>
  );
}
