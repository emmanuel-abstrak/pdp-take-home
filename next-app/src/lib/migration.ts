export const LEGACY_ORIGIN = process.env.LEGACY_ORIGIN ?? "http://127.0.0.1:8000";

const DEFAULT_MIGRATED = ["why-we-are-moving-to-nextjs", "a-field-guide-to-legacy-data"];

export const migratedSlugs: readonly string[] = (process.env.MIGRATED_SLUGS?.split(",") ?? DEFAULT_MIGRATED)
  .map((s) => s.trim())
  .filter(Boolean);

export function isMigrated(slug: string): boolean {
  return migratedSlugs.includes(slug);
}
