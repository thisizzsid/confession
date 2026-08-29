import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const extractHashtags = (text: string): string[] => {
  const hashtagRegex = /#[\w\u0590-\u05ff]+/gi;
  return text.match(hashtagRegex) || [];
};

export const normalizeGeoPoint = (latitude: number, longitude: number) => {
  const clampedLatitude = Math.min(90, Math.max(-90, Number(latitude) || 0));
  const clampedLongitude = Math.min(180, Math.max(-180, Number(longitude) || 0));

  return {
    x: ((clampedLongitude + 180) / 360) * 100,
    y: 100 - ((clampedLatitude + 90) / 180) * 100,
  };
};

export const getDeviceName = (): string => {
  if (typeof window === "undefined") return "Unknown";
  const ua = window.navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android Device";
  if (/Macintosh/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "PC";
  if (/Linux/.test(ua)) return "Linux PC";
  return "Mobile Device";
};
