import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import Link from "next/link";
import { AccountButton } from "@/components/AccountButton";
import "./globals.css";

const display = Fraunces({ subsets: ["latin"], variable: "--font-display-face", weight: ["600", "700"] });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "Lifer — the daily bird-guessing game",
  description: "Find today's mystery bird by climbing the tree of life: Order, Family, Genus, Species.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <header className="border-b border-line">
          <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
            <Link href="/" className="font-display text-2xl font-bold tracking-tight text-accent">
              Lifer
            </Link>
            <nav className="flex gap-3 text-sm text-muted">
              <Link href="/" className="hover:text-ink">
                Daily
              </Link>
              <Link href="/practice" className="hover:text-ink">
                Practice
              </Link>
            </nav>
            <div className="ml-auto">
              <AccountButton />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 pb-8 pt-4 text-xs text-muted">
          Taxonomy from{" "}
          <a className="underline" href="https://www.avilist.org/" target="_blank" rel="noreferrer">
            AviList
          </a>{" "}
          (CC BY 4.0). Photos from{" "}
          <a className="underline" href="https://www.inaturalist.org/" target="_blank" rel="noreferrer">
            iNaturalist
          </a>{" "}
          and{" "}
          <a className="underline" href="https://commons.wikimedia.org/" target="_blank" rel="noreferrer">
            Wikimedia Commons
          </a>
          ; each photographer is credited next to their photo.
        </footer>
      </body>
    </html>
  );
}
