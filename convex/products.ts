import { query, type QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { v } from "convex/values";

/** One product for its item page, addressed by category slug + SKU (both appear in the URL). */
export const getBySku = query({
  args: { categorySlug: v.string(), sku: v.string() },
  handler: async (ctx, args) => {
    const category = await ctx.db
      .query("categories")
      .withIndex("by_slug", (q) => q.eq("slug", args.categorySlug))
      .unique();
    if (!category) return null;

    const product = await ctx.db
      .query("products")
      .withIndex("by_sku", (q) => q.eq("sku", args.sku))
      .first();
    // Only listed products have a page, and only under their own category.
    if (
      !product ||
      product.categoryId !== category._id ||
      product.status !== "active" ||
      product.visibility !== "visible"
    ) {
      return null;
    }

    const [media, attributes] = await Promise.all([
      ctx.db
        .query("productMedia")
        .withIndex("by_product_and_sort_order", (q) => q.eq("productId", product._id))
        .take(24),
      ctx.db
        .query("productAttributes")
        .withIndex("by_product", (q) => q.eq("productId", product._id))
        .take(50),
    ]);

    return {
      category: { id: category._id, name: category.name, slug: category.slug },
      product: {
        id: product._id,
        sku: product.sku,
        name: product.name,
        description: product.description,
        ...(product.shortDescription === undefined ? {} : { shortDescription: product.shortDescription }),
        ...(product.brand === undefined ? {} : { brand: product.brand }),
        ...(product.warrantyInfo === undefined ? {} : { warrantyInfo: product.warrantyInfo }),
        ...(product.countryOfOrigin === undefined ? {} : { countryOfOrigin: product.countryOfOrigin }),
        price: {
          basePrice: product.basePrice,
          currency: product.currency,
          isTaxInclusive: product.isTaxInclusive,
          ...(product.salePrice === undefined ? {} : { salePrice: product.salePrice }),
          ...(product.taxRate === undefined ? {} : { taxRate: product.taxRate }),
        },
        availability: {
          available: product.inventory.availableQuantity,
          lowStockThreshold: product.inventory.lowStockThreshold,
          tracked: product.inventory.trackInventory,
          allowBackorders: product.inventory.allowBackorders,
        },
        media: media.map((item) => ({
          id: item.externalId,
          type: item.type,
          url: item.url,
          sortOrder: item.sortOrder,
          isPrimary: item.isPrimary,
          ...(item.altText === undefined ? {} : { altText: item.altText }),
          ...(item.title === undefined ? {} : { title: item.title }),
          ...(item.metadata === undefined ? {} : { metadata: item.metadata }),
        })),
        attributes: attributes
          .filter((attribute) => attribute.isVisible)
          .map((attribute) => ({
            id: attribute.externalId,
            name: attribute.name,
            value: attribute.value,
            ...(attribute.unit === undefined ? {} : { unit: attribute.unit }),
            ...(attribute.group === undefined ? {} : { group: attribute.group }),
          })),
      },
    };
  },
});

export const listByCategory = query({
  args: { categorySlug: v.string() },
  handler: async (ctx, args) => {
    const category = await ctx.db
      .query("categories")
      .withIndex("by_slug", (q) => q.eq("slug", args.categorySlug))
      .unique();

    if (!category) return { category: null, products: [] };

    const products = await ctx.db
      .query("products")
      .withIndex("by_category_and_status_and_visibility", (q) =>
        q
          .eq("categoryId", category._id)
          .eq("status", "active")
          .eq("visibility", "visible"),
      )
      .take(100);

    const productsWithMedia = await Promise.all(
      products.map(async (product) => {
        const media = await ctx.db
          .query("productMedia")
          .withIndex("by_product_and_sort_order", (q) => q.eq("productId", product._id))
          .take(10);

        return {
          id: product._id,
          sku: product.sku,
          name: product.name,
          price: {
            basePrice: product.basePrice,
            currency: product.currency,
            isTaxInclusive: product.isTaxInclusive,
            ...(product.salePrice === undefined ? {} : { salePrice: product.salePrice }),
            ...(product.taxRate === undefined ? {} : { taxRate: product.taxRate }),
          },
          media: media.map((item) => ({
            id: item.externalId,
            type: item.type,
            url: item.url,
            sortOrder: item.sortOrder,
            isPrimary: item.isPrimary,
            ...(item.altText === undefined ? {} : { altText: item.altText }),
            ...(item.title === undefined ? {} : { title: item.title }),
            ...(item.metadata === undefined ? {} : { metadata: item.metadata }),
          })),
        };
      }),
    );

    return {
      category: { id: category._id, name: category.name, slug: category.slug },
      products: productsWithMedia,
    };
  },
});

const FEATURED_TAG = "featured";
const MAX_FEATURED = 4;

/** Card-shaped product + its category, with just the primary image (enough for a compact row). */
async function toSuggestion(ctx: QueryCtx, product: Doc<"products">, category: Doc<"categories">) {
  const media = await ctx.db
    .query("productMedia")
    .withIndex("by_product_and_sort_order", (q) => q.eq("productId", product._id))
    .take(4);
  const primary = media.find((item) => item.isPrimary && item.type === "image") ?? media.find((item) => item.type === "image");
  return {
    id: product._id,
    sku: product.sku,
    name: product.name,
    price: {
      basePrice: product.basePrice,
      currency: product.currency,
      isTaxInclusive: product.isTaxInclusive,
      ...(product.salePrice === undefined ? {} : { salePrice: product.salePrice }),
      ...(product.taxRate === undefined ? {} : { taxRate: product.taxRate }),
    },
    media: primary
      ? [
          {
            id: primary.externalId,
            type: primary.type,
            url: primary.url,
            sortOrder: primary.sortOrder,
            isPrimary: true,
            ...(primary.altText === undefined ? {} : { altText: primary.altText }),
            ...(primary.metadata === undefined ? {} : { metadata: primary.metadata }),
          },
        ]
      : [],
    category: { name: category.name, slug: category.slug },
  };
}

const isListed = (product: Doc<"products"> | null): product is Doc<"products"> =>
  product !== null && product.status === "active" && product.visibility === "visible";

/**
 * What to show in an empty cart: products tagged "featured" (if any), then one product from
 * each category that isn't already featured.
 */
export const cartSuggestions = query({
  args: {},
  handler: async (ctx) => {
    const featured: Awaited<ReturnType<typeof toSuggestion>>[] = [];
    const featuredIds = new Set<string>();

    const tags = await ctx.db
      .query("productTags")
      .withIndex("by_value", (q) => q.eq("value", FEATURED_TAG))
      .take(20);
    for (const tag of tags) {
      if (featured.length >= MAX_FEATURED) break;
      if (featuredIds.has(tag.productId)) continue;
      const product = await ctx.db.get("products", tag.productId);
      if (!isListed(product)) continue;
      const category = await ctx.db.get("categories", product.categoryId);
      if (!category) continue;
      featuredIds.add(product._id);
      featured.push(await toSuggestion(ctx, product, category));
    }

    const byCategory: Awaited<ReturnType<typeof toSuggestion>>[] = [];
    const categories = await ctx.db.query("categories").take(50);
    for (const category of categories) {
      const candidates = await ctx.db
        .query("products")
        .withIndex("by_category_and_status_and_visibility", (q) =>
          q.eq("categoryId", category._id).eq("status", "active").eq("visibility", "visible"),
        )
        .take(MAX_FEATURED + 1);
      const pick = candidates.find((product) => !featuredIds.has(product._id));
      if (pick) byCategory.push(await toSuggestion(ctx, pick, category));
    }

    return { featured, byCategory };
  },
});
