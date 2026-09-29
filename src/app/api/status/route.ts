import { loadBirds } from "@/lib/birds";

export const dynamic = "force-dynamic";

/** Setup check: is the deployed app reading from Supabase, and how much data does it have? */
export async function GET() {
  const { source, birds } = await loadBirds();
  return Response.json({
    supabaseConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    dataSource: source, // "supabase" once seeded; "checklist" / "avilist" means the bundled fallback
    birds: birds.length,
    birdsWithPhotos: birds.filter((b) => b.photo).length,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? null,
  });
}
