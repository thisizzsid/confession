"use client";

import { useEffect, useState } from "react";
import {
  getMessaging,
  getToken,
  onMessage,
  isSupported,
} from "firebase/messaging";
import { db, auth } from "@/firebase";
import { doc, updateDoc, arrayUnion, getDoc, setDoc, Firestore } from "firebase/firestore";

export function useNotifications() {
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const setupNotifications = async () => {
      try {
        if (!auth) {
          setLoading(false);
          return;
        }

        const user = auth.currentUser;
        if (!user || !db) {
          setLoading(false);
          return;
        }

        // 1️⃣ Android WebView token bridge
        (window as any).onFCMToken = async (token: string) => {
          console.log("📱 Android FCM token received:", token);

          await setDoc(
            doc(db as Firestore, "users", user.uid),
            {
              fcmTokens: arrayUnion(token),
              notificationsEnabled: true,
            },
            { merge: true }
          );

          setNotificationEnabled(true);
        };

        // 2️⃣ Web browser push (unchanged)
        const supported = await isSupported();
        if (!supported) {
          setLoading(false);
          return;
        }

        const userDoc = await getDoc(doc(db as Firestore, "users", user.uid));
        const userData = userDoc.data();

        if (userData?.notificationsEnabled === false) {
          setLoading(false);
          return;
        }

        if ("serviceWorker" in navigator) {
          navigator.serviceWorker.register("/firebase-messaging-sw.js");
        }

        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          const messaging = getMessaging();
          const token = await getToken(messaging, {
            vapidKey: process.env.NEXT_PUBLIC_VAPID_KEY,
          });

          if (token) {
            await updateDoc(doc(db as Firestore, "users", user.uid), {
              fcmTokens: arrayUnion(token),
              notificationsEnabled: true,
            });

            setNotificationEnabled(true);

            onMessage(messaging, (payload) => {
              if (Notification.permission === "granted") {
                new Notification(payload.notification?.title || "Confession", {
                  body: payload.notification?.body,
                  icon: "/logoemesis.png",
                  badge: "/logoemesis.png",
                  tag: payload.data?.type || "notification",
                  data: payload.data,
                });
              }
            });
          }
        }

        setLoading(false);
      } catch (error) {
        console.error("❌ Notification setup error:", error);
        setLoading(false);
      }
    };

    setupNotifications();
  }, [auth?.currentUser]);

  return { notificationEnabled, loading };
}

export default function NotificationSetup() {
  const { notificationEnabled, loading } = useNotifications();

  if (loading) return null;

  return (
    <div>
      {notificationEnabled ? (
        <p className="text-green-400 text-xs">✅ Push notifications enabled</p>
      ) : (
        <p className="text-amber-300 text-xs">📱 Allow notifications to get updates</p>
      )}
    </div>
  );
}
