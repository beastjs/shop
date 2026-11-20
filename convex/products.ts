import { query } from "./_generated/server";
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
