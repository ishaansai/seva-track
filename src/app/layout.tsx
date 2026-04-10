import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Seva Track",
  description: "Seva Commons Meal Bag Delivery Tracker",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Seva Track",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",          // safe area for iPhone notch / home bar
  themeColor: "#f97316",         // orange-500 — colors the iOS status bar
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* iOS home-screen icon */}
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      {/* pb-safe keeps content above iPhone home bar */}
      <body className="pb-safe">{children}</body>
    </html>
  );
}
