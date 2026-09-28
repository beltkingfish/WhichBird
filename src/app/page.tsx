import { Game } from "@/components/Game";
import { loadBirds, loadPinnedPuzzles } from "@/lib/birds";

export const revalidate = 3600;

export default async function DailyPage() {
  const [{ birds }, pinned] = await Promise.all([loadBirds(), loadPinnedPuzzles()]);
  return <Game mode="daily" birds={birds} pinned={pinned} />;
}
