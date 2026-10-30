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

const accountStatus = v.union(
  v.literal("pending"),
  v.literal("confirmed"),
  v.literal("active"),
  v.literal("suspended"),
  v.literal("closed"),
);

const accountPlan = v.union(
  v.literal("trial"),
  v.literal("starter"),
  v.literal("pro"),
  v.literal("enterprise"),
);

const accountAddress = v.object({
  line1: v.optional(v.string()),
  line2: v.optional(v.string()),
  city: v.optional(v.string()),
  region: v.optional(v.string()),
  postalCode: v.optional(v.string()),
  country: v.optional(v.string()),
});

const accountOrganization = v.object({
  legalName: v.optional(v.string()),
  website: v.optional(v.string()),
  industry: v.optional(v.string()),
  size: v.optional(v.string()),
  taxId: v.optional(v.string()),
  address: v.optional(accountAddress),
});

const accountPrimaryContact = v.object({
  name: v.string(),
  email: v.string(),
  phone: v.union(v.string(), v.null()),
  title: v.union(v.string(), v.null()),
  tokenIdentifier: v.union(v.string(), v.null()),
});

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

  accounts: defineTable({
    slug: v.string(),
    name: v.string(),
    status: accountStatus,
    plan: accountPlan,
    organization: accountOrganization,
    primaryContact: accountPrimaryContact,
    billingEmail: v.union(v.string(), v.null()),
    logoR2Key: v.optional(v.string()),
    ownerTokenIdentifier: v.string(),
    notes: v.union(v.string(), v.null()),
    closedAt: v.union(v.number(), v.null()),
    closedBy: v.union(v.string(), v.null()),
    closeReason: v.union(v.string(), v.null()),
    createdAt: v.number(),
    createdBy: v.string(),
    updatedAt: v.number(),
    verificationRecipientEmails: v.optional(v.array(v.string())),
    updatedBy: v.string(),
  })
    .index("by_slug", ["slug"])
    .index("by_createdAt", ["createdAt"])
    .index("by_status_and_createdAt", ["status", "createdAt"])
    .index("by_ownerTokenIdentifier_and_createdAt", ["ownerTokenIdentifier", "createdAt"])
    .index("by_primaryContact_tokenIdentifier", ["primaryContact.tokenIdentifier"])
    .index("by_primaryContact_email", ["primaryContact.email"]),

  accountSlugReservations: defineTable({
    slug: v.string(),
    accountId: v.id("accounts"),
  }).index("by_slug", ["slug"]),

  accountMembers: defineTable({
    accountId: v.id("accounts"),
    email: v.string(),
    tokenIdentifier: v.union(v.string(), v.null()),
    userId: v.union(v.id("users"), v.null()),
    name: v.union(v.string(), v.null()),
    title: v.union(v.string(), v.null()),
    role: v.union(v.literal("viewer"), v.literal("member"), v.literal("admin"), v.literal("owner")),
    status: v.union(v.literal("invited"), v.literal("active"), v.literal("suspended")),
    adminConfirmation: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("confirmed"),
        v.literal("complete"),
        v.literal("cancelled"),
        v.literal("revoking"),
        v.literal("revoked"),
      ),
    ),
    invitedAt: v.number(),
    invitedBy: v.string(),
    joinedAt: v.union(v.number(), v.null()),
    updatedAt: v.number(),
    verificationRecipientEmails: v.optional(v.array(v.string())),
    updatedBy: v.string(),
  })
    .index("by_accountId_and_status", ["accountId", "status"])
    .index("by_accountId_and_role", ["accountId", "role"])
    .index("by_accountId_and_email", ["accountId", "email"])
    .index("by_accountId_and_tokenIdentifier", ["accountId", "tokenIdentifier"])
    .index("by_tokenIdentifier_and_status", ["tokenIdentifier", "status"])
    .index("by_email_and_status", ["email", "status"]),

  users: defineTable({
    tokenIdentifier: v.string(),
    firebaseUid: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    subject: v.string(),
    issuer: v.string(),
    nickname: v.union(v.string(), v.null()),
    preferredUsername: v.union(v.string(), v.null()),
    profileUrl: v.optional(v.string()),
    phone: v.union(v.string(), v.null()),
    emailVerified: v.union(v.boolean(), v.null()),
    avatarR2Key: v.optional(v.string()),
    avatarSourceUrl: v.optional(v.string()),
    avatarSyncRequestedAt: v.optional(v.number()),
  })
    .index("by_tokenIdentifier", ["tokenIdentifier"])
    .index("by_firebaseUid", ["firebaseUid"])
    .index("by_email", ["email"]),

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
