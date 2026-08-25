import "./globals.css";
import type { Metadata, Viewport } from "next";
import { AuthContextProvider } from "./context/AuthContext";
import ClientLayout from "./ClientLayout";
import { NotificationProvider } from "./components/NotificationSetup";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#000000",
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "Confession",
  description: "Free Your Mind — Owned by SA Studios, Crafted in USA",
  applicationName: "Confession by SA Studios",
  appleWebApp: {
    capable: true,
    title: "Confession",
    statusBarStyle: "black-translucent",
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: [{ url: "/icon-192.png", type: "image/png" }],
  },
  openGraph: {
    title: "Confession",
    description: "Free Your Mind — Owned by SA Studios, Crafted in USA",
    siteName: "Confession",
    images: ["/icon-512.png"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Confession",
    description: "Free Your Mind — Owned by SA Studios, Crafted in USA",
    images: ["/icon-512.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth h-full">
      <body className="font-sans antialiased h-dvh flex flex-col relative overflow-hidden">
        <AuthContextProvider>
          <NotificationProvider>
            <ClientLayout>{children}</ClientLayout>
          </NotificationProvider>
        </AuthContextProvider>
      </body>
    </html>
  );
}
