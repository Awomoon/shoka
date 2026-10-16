import type { Metadata, Viewport } from "next";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://awomoon.github.io/shoka/"),
  title: "Shoka — Know your shop's money. Even without internet.",
  description:
    "Shoka is an offline-first sales and inventory app for Nigerian shop owners. Record sales in seconds, track stock automatically, see your money daily. No internet needed. By Moontech, Oyo State, Nigeria.",
  openGraph: {
    title: "Shoka — Know your shop's money.",
    description:
      "Offline sales & stock tracking for Nigerian shops. Record sales in seconds. First week free.",
    type: "website",
    url: "https://awomoon.github.io/shoka/",
    images: [{ url: "og-image.png", width: 1024, height: 1024 }],
  },
  icons: {
    icon: [{ url: "favicon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0B5D3B",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${poppins.variable} ${inter.variable}`}>
      <body className="font-sans leading-relaxed">{children}</body>
    </html>
  );
}
