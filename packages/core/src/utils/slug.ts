export function slugify(input: string): string {
  const normalized = input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 80);
  return normalized || "proyecto";
}

export function uniqueSlug(base: string, exists: (slug: string) => boolean): string {
  const root = slugify(base);
  if (!exists(root)) return root;
  for (let index = 2; index < 10_000; index++) {
    const candidate = `${root}-${index}`;
    if (!exists(candidate)) return candidate;
  }
  return `${root}-${Date.now()}`;
}
