import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Converter",
  description: "Convert images, documents, audio and video — fast.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#080b14] text-slate-200">{children}</body>
    </html>
  );
}
