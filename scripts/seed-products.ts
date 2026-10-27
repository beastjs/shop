import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { productCategories } from "../src/lib/product/categories";

const productSets = {
  apparel: {
    searchQuery: "apparel clothing fashion product photography",
    productTypes: [
      "Cotton Tee",
      "Linen Shirt",
      "Everyday Hoodie",
      "Relaxed Jeans",
      "Knit Sweater",
      "Utility Jacket",
      "Pleated Trousers",
    ],
    styles: ["Essential", "Studio", "Classic"],
    basePrice: 24,
  },
  bags: {
    searchQuery: "handbag tote backpack bag product photography",
    productTypes: [
      "Canvas Tote",
      "Leather Crossbody",
      "Travel Backpack",
      "Mini Shoulder Bag",
      "Weekend Duffel",
      "Structured Satchel",
      "Everyday Sling",
    ],
    styles: ["Everyday", "Studio", "Classic"],
    basePrice: 38,
  },
  perfumes: {
    searchQuery: "perfume fragrance bottle product photography",
    productTypes: [
      "Citrus Eau de Parfum",
      "Amber Eau de Toilette",
      "Rose Perfume Oil",
      "Woody Discovery Set",
      "Floral Body Mist",
      "Cedar Cologne",
      "Vanilla Travel Spray",
    ],
    styles: ["No. 01", "No. 02", "No. 03"],
    basePrice: 32,
  },
  phones: {
    searchQuery: "smartphone mobile phone product photography",
    productTypes: [
      "5G Smartphone",
      "Compact Smartphone",
      "Pro Camera Phone",
      "Foldable Smartphone",
      "Rugged Phone",
      "Wireless Charger",
      "Protective Phone Case",
    ],
    styles: ["Nova", "Edge", "Core"],
    basePrice: 29,
  },
  audio: {
    searchQuery: "headphones earbuds speaker audio product photography",
    productTypes: [
      "Wireless Headphones",
      "Noise Cancelling Earbuds",
      "Portable Bluetooth Speaker",
      "Studio Monitor Headphones",
      "Compact Soundbar",
      "USB Microphone",
      "Turntable Speaker Set",
    ],
    styles: ["Studio", "Pulse", "Wave"],
    basePrice: 34,
  },
  gaming: {
    searchQuery: "gaming controller console setup product photography",
    productTypes: [
      "Wireless Controller",
      "Gaming Headset",
      "Mechanical Gaming Keyboard",
      "RGB Gaming Mouse",
      "Portable Game Console",
      "Streaming Microphone",
      "Gaming Monitor",
    ],
    styles: ["Arcade", "Level", "Pixel"],
    basePrice: 39,
  },
  software: {
    searchQuery: "software technology laptop screen digital product",
    productTypes: [
      "Design Suite License",
      "Photo Editing License",
      "Project Planner License",
      "Music Production License",
      "Security Suite License",
      "Code Editor License",
      "Cloud Storage Plan",
    ],
    styles: ["Personal", "Studio", "Pro"],
    basePrice: 19,
  },
} as const;

type SeedCategory = (typeof productCategories)[number];
type CategorySlug = SeedCategory["slug"];
type ProductSet = (typeof productSets)[keyof typeof productSets];

interface UnsplashPhoto {
  id: string;
  description: string | null;
  alt_description: string | null;
  urls: { small: string };
  links: { html: string; download_location: string };
  user: { name: string; links: { html: string } };
}

interface UnsplashSearchResponse {
  results: UnsplashPhoto[];
}

interface PreparedCategory {
  category: SeedCategory;
  productSet: ProductSet;
  photos: UnsplashPhoto[];
}

interface SeedProductArgs {
  sku: string;
  name: string;
  description: string;
  basePrice: number;
  quantity: number;
  image: {
    id: string;
    url: string;
    altText?: string;
    photographerName: string;
    photographerUrl: string;
    photoUrl: string;
    unsplashUrl: string;
  };
}

const seedCategoriesTable = makeFunctionReference<
  "mutation",
  {},
  { slug: string; id: string; created: boolean }[]
>(
  "categories:seedCategoriesTable",
);
const seedCategoryProducts = makeFunctionReference<
  "mutation",
  { categorySlug: string; products: SeedProductArgs[]; createdAt: number },
  { category: string; inserted: number; skipped: number }
>("seed:seedCategoryProducts");

const productCount = 21;
const accessKey = process.env.UNSPLASH_ACCESS_KEY;
const convexUrl = process.env.CONVEX_URL;

if (!accessKey) {
  throw new Error("UNSPLASH_ACCESS_KEY is missing. Add it to your local .env file.");
}
if (!convexUrl) {
  throw new Error("CONVEX_URL is missing. Connect this project to a Convex deployment first.");
}

const selectedSlug = process.argv[2];
if (!selectedSlug) {
  throw new Error(
    `Choose one category: ${productCategories.map((item) => item.slug).join(", ")}\n` +
      "Usage: bun run seed:products -- <category-slug>",
  );
}

const selectedCategories = productCategories.filter((category) => category.slug === selectedSlug);

if (selectedSlug && selectedCategories.length === 0) {
  throw new Error(
    `Unknown category "${selectedSlug}". Choose one of: ${productCategories.map((item) => item.slug).join(", ")}`,
  );
}

const client = new ConvexHttpClient(convexUrl);

function productNames(productSet: ProductSet): string[] {
  return productSet.productTypes.flatMap((productType) =>
    productSet.styles.map((style) => `${style} ${productType}`),
  );
}

function attributedUrl(url: string): string {
  const profile = new URL(url);
  profile.searchParams.set("utm_source", "shop");
  profile.searchParams.set("utm_medium", "referral");
  return profile.toString();
}

async function searchPhotos(category: SeedCategory): Promise<{
  photos: UnsplashPhoto[];
  rateLimitRemaining: number | null;
}> {
  const productSet = productSets[category.slug as CategorySlug];
  const url = new URL("https://api.unsplash.com/search/photos");
  url.searchParams.set("query", productSet.searchQuery);
  url.searchParams.set("per_page", "30");
  url.searchParams.set("orientation", "squarish");
  url.searchParams.set("content_filter", "high");

  const response = await fetch(url, {
    headers: { Authorization: `Client-ID ${accessKey}` },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Unsplash search failed for ${category.name} (${response.status}): ${details}`);
  }

  const body = (await response.json()) as UnsplashSearchResponse;
  if (body.results.length < productCount) {
    throw new Error(
      `Unsplash returned ${body.results.length} photos for ${category.name}; ${productCount} are required.`,
    );
  }

  const remaining = response.headers.get("X-Ratelimit-Remaining");
  return {
    photos: body.results.slice(0, productCount),
    rateLimitRemaining: remaining === null ? null : Number(remaining),
  };
}

async function trackPhotoSelection(photo: UnsplashPhoto): Promise<void> {
  const response = await fetch(photo.links.download_location, {
    headers: { Authorization: `Client-ID ${accessKey}` },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Unsplash photo tracking failed (${response.status}): ${details}`);
  }
}

async function main(): Promise<void> {
  const prepared: PreparedCategory[] = [];

  for (const category of selectedCategories) {
    const { photos, rateLimitRemaining } = await searchPhotos(category);
    prepared.push({
      category,
      productSet: productSets[category.slug as CategorySlug],
      photos,
    });

    if (rateLimitRemaining !== null && prepared.length === selectedCategories.length) {
      const requiredTrackingRequests = selectedCategories.length * productCount;
      if (rateLimitRemaining < requiredTrackingRequests) {
        throw new Error(
          `Unsplash rate limit has ${rateLimitRemaining} requests remaining, but this run needs ${requiredTrackingRequests} photo tracking requests. ` +
            "Run one category at a time or retry after the rate limit resets.",
        );
      }
    }
  }

  console.log(`Tracking ${prepared.length * productCount} selected Unsplash photos...`);
  for (const { photos } of prepared) {
    for (const photo of photos) await trackPhotoSelection(photo);
  }

  await client.mutation(seedCategoriesTable, {});

  for (const { category, productSet, photos } of prepared) {
    const names = productNames(productSet);
    const createdAt = Date.now();
    const products = photos.map((photo, index) => {
      const name = names[index];
      const photographerUrl = attributedUrl(photo.user.links.html);
      return {
        sku: `${category.slug.toUpperCase()}-${String(index + 1).padStart(3, "0")}`,
        name,
        description: `${name}, selected for the ${category.name.toLowerCase()} collection.`,
        basePrice: Number((productSet.basePrice + (index % 7) * 4.5).toFixed(2)),
        quantity: 24 + ((index * 7) % 53),
        image: {
          id: photo.id,
          url: photo.urls.small,
          altText: photo.alt_description ?? photo.description ?? undefined,
          photographerName: photo.user.name,
          photographerUrl,
          photoUrl: attributedUrl(photo.links.html),
          unsplashUrl: "https://unsplash.com/?utm_source=shop&utm_medium=referral",
        },
      };
    });

    const result = await client.mutation(seedCategoryProducts, {
      categorySlug: category.slug,
      products,
      createdAt,
    });
    console.log(`${category.name}: ${productCount} requested`, result);
  }
}

await main();
