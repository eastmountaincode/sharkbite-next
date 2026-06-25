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

const metadataTitle = "Sharkbite - Internet Delay Pedal";
const metadataDescription = "A website that turns the internet into a delay pedal.";

export const metadata: Metadata = {
  metadataBase: new URL("https://sharkbite.andrew-boylan.com"),
  title: metadataTitle,
  description: metadataDescription,
  openGraph: {
    title: metadataTitle,
    description: metadataDescription,
    url: "https://sharkbite.andrew-boylan.com",
    siteName: "Sharkbite",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "Sharkbite",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: metadataTitle,
    description: metadataDescription,
    images: [
      {
        url: "/twitter-image.png",
        alt: "Sharkbite",
      },
    ],
  },
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
