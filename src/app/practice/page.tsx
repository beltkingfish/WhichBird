import type { Metadata } from "next";
import { Game } from "@/components/Game";
import { loadBirds } from "@/lib/birds";

export const revalidate = 3600;
export const metadata: Metadata = { title: "Practice · WhichBird" };

export default async function PracticePage() {
  const { birds } = await loadBirds();
  return <Game mode="practice" birds={birds} pinned={{}} />;
}
