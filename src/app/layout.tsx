import type { Metadata } from "next";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const hfLorflo = localFont({
  display: "swap",
  src: "./fonts/HF_Lorflo_Regular.otf",
  variable: "--font-hf-lorflo",
});

const botch = localFont({
  display: "swap",
  src: "./fonts/Botch.otf",
  variable: "--font-botch",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://sharkbite.andrew-boylan.com"),
  title: "Sharkbite",
  description: "A browser instrument that turns global echo servers into delay taps.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full antialiased ${hfLorflo.variable} ${botch.variable}`}>
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
