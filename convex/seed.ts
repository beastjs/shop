import { mutation } from "./_generated/server";
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
