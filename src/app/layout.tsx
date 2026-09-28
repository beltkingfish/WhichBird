import type { Metadata } from "next";
import { Barlow, Barlow_Condensed, IBM_Plex_Mono } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

const barlow = Barlow({ subsets: ["latin"], variable: "--font-barlow", weight: ["400", "500", "600", "700"], style: ["normal", "italic"] });
const barlowCondensed = Barlow_Condensed({ subsets: ["latin"], variable: "--font-barlow-condensed", weight: ["700", "800"] });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], variable: "--font-plex-mono", weight: ["400", "600"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://whichbird.app"),
  title: "WhichBird · daily bird puzzle",
  description: "Guess the day's bird. Each guess shows how far up the tree of life it shares with the answer.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${barlow.variable} ${barlowCondensed.variable} ${plexMono.variable}`}>
      <body className="min-h-screen bg-base-100 font-sans text-base-content antialiased">
        <SiteHeader />
        <main className="mx-auto max-w-6xl px-4 py-5">{children}</main>
        <footer className="border-t border-base-300 text-xs text-base-content/60">
          <div className="mx-auto max-w-6xl px-4 py-6">
            <p>
              Taxonomy:{" "}
              <a className="link" href="https://www.avilist.org/" target="_blank" rel="noreferrer">
                AviList
              </a>{" "}
              v2025, CC BY 4.0. Photos:{" "}
              <a className="link" href="https://www.inaturalist.org/" target="_blank" rel="noreferrer">
                iNaturalist
              </a>{" "}
              and{" "}
              <a className="link" href="https://commons.wikimedia.org/" target="_blank" rel="noreferrer">
                Wikimedia Commons
              </a>{" "}
              contributors, credited under each photo.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
