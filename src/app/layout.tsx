import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const hfLorflo = localFont({
  display: "swap",
  src: "./fonts/HF_Lorflo_Regular.otf",
  variable: "--font-hf-lorflo",
});

export const metadata: Metadata = {
  title: "Sharkbite",
  description: "A browser instrument that turns global echo servers into delay taps.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full antialiased ${hfLorflo.variable}`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
