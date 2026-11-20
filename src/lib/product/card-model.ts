import type { ProductCardItem } from "./card-types";
import type { ProductMedia } from "./types";

/**
 * Everything a category card needs, computed once from a ProductCardItem.
 * Category-specific details are derived from the product name only, so a card never
 * claims something (sizes, specs, financing) the catalog doesn't actually record.
 */
export interface CardModel {
  image?: ProductMedia;
  alt: string;
  credit?: { name: string; url: string; unsplashUrl: string };
  /** "$24" and "$28.50" — never "$28.5". */
  price: string;
  /** Original price when on sale, otherwise undefined. */
  wasPrice?: string;
  onSale: boolean;
  /** Percent off, rounded, when on sale. */
  discount?: number;
  /** Trailing SKU segment, e.g. "001". */
  shortSku: string;
  /** Leading style word(s) of the name, e.g. "Studio" or "No. 01". */
  edition?: string;
  /** Name without the edition, e.g. "Cotton Tee". */
  productType: string;
}

// Seeded names are "<edition> <product type>"; editions are multi-word for perfumes ("No. 01").
const EDITION = /^(No\. \d+|\S+)\s+(.+)$/;

const str = (value: unknown) => (typeof value === "string" && value ? value : undefined);

/** Unsplash attribution for one photo, when its metadata carries it. */
export function photoCredit(image: ProductMedia | undefined): CardModel["credit"] {
  const name = str(image?.metadata?.photographerName);
  const url = str(image?.metadata?.photographerUrl);
  const unsplashUrl = str(image?.metadata?.unsplashUrl);
  return name && url && unsplashUrl ? { name, url, unsplashUrl } : undefined;
}

export function toCardModel(item: ProductCardItem): CardModel {
  const { name, sku, price, media } = item;
  const image =
    media.find((m) => m.isPrimary && m.type === "image" && m.url) ??
    media.find((m) => m.type === "image" && m.url);

  const money = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: price.currency || "USD",
    trailingZeroDisplay: "stripIfInteger",
  } as Intl.NumberFormatOptions);

  const onSale = typeof price.salePrice === "number" && price.salePrice < price.basePrice;
  const current = onSale ? (price.salePrice as number) : price.basePrice;
  const match = EDITION.exec(name);

  return {
    image,
    alt: image?.altText ?? name,
    credit: photoCredit(image),
    price: money.format(current),
    wasPrice: onSale ? money.format(price.basePrice) : undefined,
    onSale,
    discount: onSale ? Math.round((1 - current / price.basePrice) * 100) : undefined,
    shortSku: sku.split("-").pop() ?? sku,
    edition: match?.[1],
    productType: match?.[2] ?? name,
  };
}

const firstMatch = (text: string, table: [RegExp, string][]) =>
  table.find(([re]) => re.test(text))?.[1];

/** Perfume: concentration and scent family, read from the name. */
export function fragranceDetails(productType: string) {
  return {
    concentration: firstMatch(productType, [
      [/eau de parfum/i, "Eau de Parfum"],
      [/eau de toilette/i, "Eau de Toilette"],
      [/cologne/i, "Cologne"],
      [/oil/i, "Perfume Oil"],
      [/mist/i, "Body Mist"],
      [/discovery set/i, "Discovery Set"],
      [/spray/i, "Travel Spray"],
    ]),
    family: firstMatch(productType, [
      [/citrus/i, "Citrus"],
      [/amber|vanilla/i, "Amber"],
      [/rose|floral/i, "Floral"],
      [/woody|cedar/i, "Woody"],
    ]),
    scent: productType
      .replace(/\b(eau de parfum|eau de toilette|perfume oil|discovery set|body mist|cologne|travel spray)\b/i, "")
      .trim(),
  };
}

/** Audio: how the product is worn or placed. */
export function audioFormFactor(productType: string) {
  return (
    firstMatch(productType, [
      [/earbuds/i, "In-ear"],
      [/headphones/i, "Over-ear"],
      [/speaker|soundbar/i, "Speaker"],
      [/microphone/i, "Microphone"],
    ]) ?? "Audio"
  );
}

/** Software: delivery form, read from the name. */
export function softwareDelivery(productType: string) {
  return /plan/i.test(productType) ? "Subscription" : "License";
}
