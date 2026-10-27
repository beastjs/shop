import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const inventory = v.object({
  quantity: v.number(),
  reservedQuantity: v.number(),
  availableQuantity: v.number(),
  lowStockThreshold: v.number(),
  trackInventory: v.boolean(),
  allowBackorders: v.boolean(),
  skuLocation: v.optional(v.string()),
});

const mediaType = v.union(
  v.literal("image"),
  v.literal("video"),
  v.literal("document"),
  v.literal("3d-model"),
);

const attributeValue = v.union(
  v.string(),
  v.number(),
  v.boolean(),
  v.array(v.string()),
);

const attributeDisplayType = v.union(
  v.literal("text"),
  v.literal("number"),
  v.literal("boolean"),
  v.literal("select"),
  v.literal("multiselect"),
  v.literal("color"),
);

export default defineSchema({
  // Guest carts keyed by an anonymous client-generated UUID. Lines are bounded (MAX_CART_LINES in carts.ts).
  carts: defineTable({
    cartKey: v.string(),
    lines: v.array(
      v.object({
        productId: v.id("products"),
        variantId: v.union(v.id("productVariants"), v.null()),
        quantity: v.number(),
      }),
    ),
    revision: v.number(),
    updatedAt: v.number(),
  }).index("by_cartKey", ["cartKey"]),

  categories: defineTable({
    externalId: v.string(),
    name: v.string(),
    slug: v.string(),
    parentId: v.optional(v.id("categories")),
  })
    .index("by_external_id", ["externalId"])
    .index("by_slug", ["slug"])
    .index("by_parent", ["parentId"]),

  products: defineTable({
    sku: v.string(),
    name: v.string(),
    description: v.string(),
    shortDescription: v.optional(v.string()),
    categoryId: v.id("categories"),
    subcategory: v.optional(v.string()),
    basePrice: v.number(),
    salePrice: v.optional(v.number()),
    currency: v.string(),
    taxRate: v.optional(v.number()),
    isTaxInclusive: v.boolean(),
    inventory,
    status: v.union(
      v.literal("draft"),
      v.literal("active"),
      v.literal("archived"),
      v.literal("discontinued"),
      v.literal("out_of_stock"),
      v.literal("pending_review"),
    ),
    visibility: v.union(
      v.literal("visible"),
      v.literal("hidden"),
      v.literal("private"),
      v.literal("catalog_only"),
    ),
    dimensions: v.optional(
      v.object({
        length: v.number(),
        width: v.number(),
        height: v.number(),
        unit: v.union(v.literal("cm"), v.literal("in"), v.literal("m"), v.literal("ft")),
      }),
    ),
    weight: v.optional(
      v.object({
        value: v.number(),
        unit: v.union(v.literal("g"), v.literal("kg"), v.literal("lb"), v.literal("oz")),
      }),
    ),
    brand: v.optional(v.string()),
    manufacturer: v.optional(v.string()),
    modelNumber: v.optional(v.string()),
    upc: v.optional(v.string()),
    ean: v.optional(v.string()),
    isbn: v.optional(v.string()),
    countryOfOrigin: v.optional(v.string()),
    warrantyInfo: v.optional(v.string()),
    customFields: v.record(v.string(), v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_sku", ["sku"])
    .index("by_category", ["categoryId"])
    .index("by_status", ["status"])
    .index("by_category_and_status_and_visibility", ["categoryId", "status", "visibility"])
    .index("by_visibility_and_status", ["visibility", "status"]),

  productTags: defineTable({
    productId: v.id("products"),
    value: v.string(),
  }).index("by_product", ["productId"]),

  productCertifications: defineTable({
    productId: v.id("products"),
    value: v.string(),
  }).index("by_product", ["productId"]),

  productMedia: defineTable({
    productId: v.id("products"),
    variantId: v.optional(v.id("productVariants")),
    externalId: v.string(),
    type: mediaType,
    url: v.string(),
    altText: v.optional(v.string()),
    title: v.optional(v.string()),
    sortOrder: v.number(),
    isPrimary: v.boolean(),
    metadata: v.optional(v.record(v.string(), v.any())),
  })
    .index("by_product_and_sort_order", ["productId", "sortOrder"])
    .index("by_variant_and_sort_order", ["variantId", "sortOrder"]),

  productAttributes: defineTable({
    productId: v.id("products"),
    externalId: v.string(),
    name: v.string(),
    value: attributeValue,
    unit: v.optional(v.string()),
    displayType: attributeDisplayType,
    isFilterable: v.boolean(),
    isVisible: v.boolean(),
    group: v.optional(v.string()),
  })
    .index("by_product", ["productId"])
    .index("by_product_and_name", ["productId", "name"]),

  productVariants: defineTable({
    productId: v.id("products"),
    externalId: v.string(),
    sku: v.string(),
    name: v.string(),
    attributes: v.record(v.string(), v.string()),
    priceAdjustment: v.optional(v.number()),
    inventory,
    isDefault: v.boolean(),
  })
    .index("by_product", ["productId"])
    .index("by_sku", ["sku"]),
});
