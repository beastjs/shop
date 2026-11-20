import { internalMutation, mutation } from "./_generated/server";
import { v } from "convex/values";

export const seedCategoryProducts = mutation({
  args: {
    categorySlug: v.string(),
    products: v.array(
      v.object({
        sku: v.string(),
        name: v.string(),
        description: v.string(),
        basePrice: v.number(),
        quantity: v.number(),
        image: v.object({
          id: v.string(),
          url: v.string(),
          altText: v.optional(v.string()),
          photographerName: v.string(),
          photographerUrl: v.string(),
          photoUrl: v.string(),
          unsplashUrl: v.string(),
        }),
      }),
    ),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    const category = await ctx.db
      .query("categories")
      .withIndex("by_slug", (q) => q.eq("slug", args.categorySlug))
      .unique();

    if (!category) {
      throw new Error(`Category "${args.categorySlug}" does not exist. Seed categories first.`);
    }

    let inserted = 0;
    let skipped = 0;

    for (const seedProduct of args.products) {
      const existing = await ctx.db
        .query("products")
        .withIndex("by_sku", (q) => q.eq("sku", seedProduct.sku))
        .unique();

      if (existing) {
        skipped += 1;
        continue;
      }

      const productId = await ctx.db.insert("products", {
        sku: seedProduct.sku,
        name: seedProduct.name,
        description: seedProduct.description,
        categoryId: category._id,
        basePrice: seedProduct.basePrice,
        currency: "USD",
        isTaxInclusive: false,
        inventory: {
          quantity: seedProduct.quantity,
          reservedQuantity: 0,
          availableQuantity: seedProduct.quantity,
          lowStockThreshold: 5,
          trackInventory: true,
          allowBackorders: false,
        },
        status: "active",
        visibility: "visible",
        customFields: {},
        createdAt: args.createdAt,
        updatedAt: args.createdAt,
      });

      await ctx.db.insert("productMedia", {
        productId,
        externalId: seedProduct.image.id,
        type: "image",
        url: seedProduct.image.url,
        altText: seedProduct.image.altText,
        title: seedProduct.name,
        sortOrder: 0,
        isPrimary: true,
        metadata: {
          photographerName: seedProduct.image.photographerName,
          photographerUrl: seedProduct.image.photographerUrl,
          photoUrl: seedProduct.image.photoUrl,
          unsplashUrl: seedProduct.image.unsplashUrl,
        },
      });
      inserted += 1;
    }

    return { category: category.name, inserted, skipped };
  },
});

const MAX_GALLERY_IMAGES = 4;

/**
 * Tops up existing products' galleries with extra photos (never replaces the primary image).
 * Internal: run via `npx convex run`, so nobody can attach images to products from a client.
 * Idempotent — photos a product already has are skipped, and galleries stop at 4 images.
 */
export const addProductImages = internalMutation({
  args: {
    products: v.array(
      v.object({
        sku: v.string(),
        images: v.array(
          v.object({
            id: v.string(),
            url: v.string(),
            altText: v.optional(v.string()),
            photographerName: v.string(),
            photographerUrl: v.string(),
            photoUrl: v.string(),
            unsplashUrl: v.string(),
          }),
        ),
      }),
    ),
  },
  handler: async (ctx, args) => {
    let added = 0;
    let missing = 0;

    for (const seed of args.products) {
      const product = await ctx.db
        .query("products")
        .withIndex("by_sku", (q) => q.eq("sku", seed.sku))
        .unique();
      if (!product) {
        missing += 1;
        continue;
      }

      const media = await ctx.db
        .query("productMedia")
        .withIndex("by_product_and_sort_order", (q) => q.eq("productId", product._id))
        .take(MAX_GALLERY_IMAGES * 4);
      const existingIds = new Set(media.map((item) => item.externalId));
      let count = media.length;
      let sortOrder = media.reduce((max, item) => Math.max(max, item.sortOrder), -1);

      for (const image of seed.images) {
        if (count >= MAX_GALLERY_IMAGES) break;
        if (existingIds.has(image.id)) continue;
        sortOrder += 1;
        count += 1;
        existingIds.add(image.id);
        await ctx.db.insert("productMedia", {
          productId: product._id,
          externalId: image.id,
          type: "image",
          url: image.url,
          altText: image.altText,
          title: product.name,
          sortOrder,
          isPrimary: false,
          metadata: {
            photographerName: image.photographerName,
            photographerUrl: image.photographerUrl,
            photoUrl: image.photoUrl,
            unsplashUrl: image.unsplashUrl,
          },
        });
        added += 1;
      }
    }

    return { added, missing };
  },
});

/**
 * Adds a tag (e.g. "featured") to products by SKU. Internal: run via `npx convex run`.
 * Idempotent — a product that already has the tag is left alone.
 */
export const tagProducts = internalMutation({
  args: { skus: v.array(v.string()), tag: v.string() },
  handler: async (ctx, args) => {
    let tagged = 0;
    let alreadyTagged = 0;
    const missing: string[] = [];

    for (const sku of args.skus) {
      const product = await ctx.db
        .query("products")
        .withIndex("by_sku", (q) => q.eq("sku", sku))
        .unique();
      if (!product) {
        missing.push(sku);
        continue;
      }
      const tags = await ctx.db
        .query("productTags")
        .withIndex("by_product", (q) => q.eq("productId", product._id))
        .take(100);
      if (tags.some((t) => t.value === args.tag)) {
        alreadyTagged += 1;
        continue;
      }
      await ctx.db.insert("productTags", { productId: product._id, value: args.tag });
      tagged += 1;
    }

    return { tagged, alreadyTagged, missing };
  },
});
