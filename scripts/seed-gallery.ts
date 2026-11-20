/**
 * Tops every product in a category up to 4 gallery photos from Unsplash.
 *
 *   bun run seed:gallery -- <category-slug | all>
 *
 * Photos are searched per product type ("Canvas Tote", "Cotton Tee"…) so a gallery shows the
 * same kind of item as its card. The primary (card) photo is never touched.
 *
 * Unsplash's API terms require reporting each photo we use (one request per photo), and demo
 * keys allow 50 requests/hour. The script spends only what the hourly budget has left, saves
 * after every product type, and is safe to re-run: it resumes where the last run stopped.
 */
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { productCategories } from "../src/lib/product/categories";

const TARGET = 4;
const accessKey = process.env.UNSPLASH_ACCESS_KEY;
const convexUrl = process.env.CONVEX_URL;
if (!accessKey) throw new Error("UNSPLASH_ACCESS_KEY is missing. Add it to your local .env file.");
if (!convexUrl) throw new Error("CONVEX_URL is missing. Connect this project to a Convex deployment first.");

const arg = process.argv[2];
const slugs: string[] = productCategories.map((c) => c.slug);
if (!arg || (arg !== "all" && !slugs.includes(arg))) {
  throw new Error(`Usage: bun run seed:gallery -- <${[...slugs, "all"].join(" | ")}>`);
}
const selected = arg === "all" ? slugs : [arg];

interface ListedProduct {
  id: string;
  sku: string;
  name: string;
  media: { id: string; type: string }[];
}
const listByCategory = makeFunctionReference<
  "query",
  { categorySlug: string },
  { category: { name: string } | null; products: ListedProduct[] }
>("products:listByCategory");

interface UnsplashPhoto {
  id: string;
  description: string | null;
  alt_description: string | null;
  urls: { small: string };
  links: { html: string; download_location: string };
  user: { name: string; links: { html: string } };
}

const client = new ConvexHttpClient(convexUrl);
/** Requests left this hour; null until Unsplash tells us. */
let budget: number | null = null;

const readBudget = (response: Response) => {
  const remaining = response.headers.get("X-Ratelimit-Remaining");
  if (remaining !== null) budget = Number(remaining);
};

const attributed = (url: string) => {
  const u = new URL(url);
  u.searchParams.set("utm_source", "shop");
  u.searchParams.set("utm_medium", "referral");
  return u.toString();
};

// Seeded names are "<style> <product type>"; perfumes use "No. 01" as the style.
const productType = (name: string) => /^(No\. \d+|\S+)\s+(.+)$/.exec(name)?.[2] ?? name;
const searchTerms = (type: string) => type.replace(/\b(license|plan)\b/gi, "software").trim();

async function search(type: string): Promise<UnsplashPhoto[]> {
  const url = new URL("https://api.unsplash.com/search/photos");
  url.searchParams.set("query", searchTerms(type));
  url.searchParams.set("per_page", "30");
  url.searchParams.set("orientation", "squarish");
  url.searchParams.set("content_filter", "high");
  const response = await fetch(url, { headers: { Authorization: `Client-ID ${accessKey}` } });
  readBudget(response);
  if (!response.ok) throw new Error(`Unsplash search "${type}" failed (${response.status}): ${await response.text()}`);
  return ((await response.json()) as { results: UnsplashPhoto[] }).results;
}

async function track(photo: UnsplashPhoto): Promise<void> {
  const response = await fetch(photo.links.download_location, {
    headers: { Authorization: `Client-ID ${accessKey}` },
  });
  readBudget(response);
  if (!response.ok) throw new Error(`Unsplash tracking failed (${response.status}): ${await response.text()}`);
}

function save(products: { sku: string; images: unknown[] }[]): void {
  // Internal mutation: only the CLI (with this machine's deployment credentials) can call it.
  const run = Bun.spawnSync(["bunx", "convex", "run", "seed:addProductImages", JSON.stringify({ products })], {
    stdout: "pipe",
    stderr: "pipe",
  });
  if (run.exitCode !== 0) throw new Error(`convex run failed: ${run.stderr.toString()}`);
  console.log(`  saved ${run.stdout.toString().trim().replace(/\s+/g, " ")}`);
}

let outOfBudget = false;
let pending = 0;

for (const slug of selected) {
  if (outOfBudget) break;
  const { category, products } = await client.query(listByCategory, { categorySlug: slug });
  if (!category) {
    console.log(`${slug}: category not found, skipping`);
    continue;
  }

  const used = new Set(products.flatMap((p) => p.media.map((m) => m.id)));
  const byType = new Map<string, ListedProduct[]>();
  for (const product of products) {
    const imageCount = product.media.filter((m) => m.type === "image").length;
    if (imageCount >= TARGET) continue;
    const type = productType(product.name);
    byType.set(type, [...(byType.get(type) ?? []), product]);
  }
  if (byType.size === 0) {
    console.log(`${category.name}: every product already has ${TARGET} photos`);
    continue;
  }
  console.log(`${category.name}: ${byType.size} product types need photos`);

  for (const [type, group] of byType) {
    // A search plus at least one tracked photo, or it isn't worth starting this type.
    if (budget !== null && budget < 2) {
      outOfBudget = true;
      break;
    }
    const pool = (await search(type)).filter((photo) => !used.has(photo.id));
    const batch: { sku: string; images: unknown[] }[] = [];

    for (const product of group) {
      const need = TARGET - product.media.filter((m) => m.type === "image").length;
      const images: unknown[] = [];
      while (images.length < need && pool.length > 0) {
        if (budget !== null && budget < 1) break;
        const photo = pool.shift()!;
        await track(photo);
        used.add(photo.id);
        images.push({
          id: photo.id,
          url: photo.urls.small,
          ...(photo.alt_description ?? photo.description ? { altText: photo.alt_description ?? photo.description } : {}),
          photographerName: photo.user.name,
          photographerUrl: attributed(photo.user.links.html),
          photoUrl: attributed(photo.links.html),
          unsplashUrl: "https://unsplash.com/?utm_source=shop&utm_medium=referral",
        });
      }
      if (images.length > 0) batch.push({ sku: product.sku, images });
      pending += need - images.length;
    }

    console.log(`  ${type}: ${batch.reduce((n, p) => n + p.images.length, 0)} photos (budget left: ${budget ?? "?"})`);
    if (batch.length > 0) save(batch);
    if (budget !== null && budget < 1) {
      outOfBudget = true;
      break;
    }
  }
}

if (outOfBudget) {
  console.log("\nUnsplash hourly limit reached. Run the same command again after the limit resets; it resumes where this stopped.");
} else if (pending > 0) {
  console.log(`\nDone, but ${pending} slots stayed empty (not enough distinct search results).`);
} else {
  console.log("\nDone.");
}
