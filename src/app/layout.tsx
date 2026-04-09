import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Seva Track",
  description: "Seva Commons Meal Bag Delivery Tracker",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
