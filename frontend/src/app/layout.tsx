import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Civilis by ioio",
  description: "Waze de obras públicas",
};

export default function RootLayout({ children }: { children: any }) {
  return (
    <html lang="es">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
