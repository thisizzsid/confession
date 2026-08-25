import "./globals.css";
import type { Metadata, Viewport } from "next";
import { AuthContextProvider } from "./context/AuthContext";
import ClientLayout from "./ClientLayout";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Confession",
  description: "Free Your Mind",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth h-full">
      <body className="font-sans antialiased h-dvh flex flex-col relative overflow-hidden">
        <AuthContextProvider>
          <ClientLayout>{children}</ClientLayout>
        </AuthContextProvider>
      </body>
    </html>
  );
}
