import { mutation, query, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";

const MAX_CART_LINES = 100;
const MAX_LINE_QUANTITY = 99;

const lineIntent = v.object({
  productId: v.string(),
  variantId: v.union(v.string(), v.null()),
  quantity: v.number(),
});

const money = v.object({ amount: v.number(), currency: v.string() });

const pricedCart = v.object({
  revision: v.number(),
  lines: v.array(
    v.object({
      productId: v.string(),
      variantId: v.union(v.string(), v.null()),
      quantity: v.number(),
      snapshot: v.object({
        name: v.string(),
        sku: v.string(),
        image: v.union(v.string(), v.null()),
        unitPrice: money,
      }),
    }),
  ),
  adjustments: v.array(
    v.object({
      productId: v.string(),
      variantId: v.union(v.string(), v.null()),
      kind: v.union(v.literal("removed"), v.literal("quantity"), v.literal("price")),
      message: v.string(),
    }),
  ),
});

type StoredLine = Doc<"carts">["lines"][number];
type PricedCart = typeof pricedCart.type;
type Adjustment = PricedCart["adjustments"][number];

const toMinorUnits = (amount: number) => Math.round(amount * 100);

const sellable = (product: Doc<"products"> | null): product is Doc<"products"> =>
  product !== null && product.status === "active" && product.visibility === "visible";

/** Most a shopper may hold of a product right now. */
const purchasable = (product: Doc<"products">) =>
  !product.inventory.trackInventory || product.inventory.allowBackorders
    ? MAX_LINE_QUANTITY
    : Math.max(0, Math.min(MAX_LINE_QUANTITY, product.inventory.availableQuantity));

async function primaryImage(ctx: QueryCtx, productId: Id<"products">) {
  const media = await ctx.db
    .query("productMedia")
    .withIndex("by_product_and_sort_order", (q) => q.eq("productId", productId))
    .take(10);
  const image = media.find((m) => m.isPrimary && m.type === "image") ?? media.find((m) => m.type === "image");
  return image?.url ?? null;
}

/** Re-price and validate lines against the catalog. The server price always wins. */
async function priceLines(ctx: QueryCtx, lines: StoredLine[], revision: number) {
  const kept: StoredLine[] = [];
  const priced: PricedCart["lines"] = [];
  const adjustments: Adjustment[] = [];

  for (const line of lines) {
    const product = await ctx.db.get("products", line.productId);
    const ids = { productId: line.productId as string, variantId: line.variantId as string | null };
    if (!sellable(product)) {
      adjustments.push({ ...ids, kind: "removed", message: "This item is no longer available." });
      continue;
    }
    const max = purchasable(product);
    if (max === 0) {
      adjustments.push({ ...ids, kind: "removed", message: `${product.name} is out of stock.` });
      continue;
    }
    const quantity = Math.min(line.quantity, max);
    if (quantity < line.quantity) {
      adjustments.push({ ...ids, kind: "quantity", message: `Only ${max} of ${product.name} available.` });
    }
    kept.push({ ...line, quantity });
    priced.push({
      ...ids,
      quantity,
      snapshot: {
        name: product.name,
        sku: product.sku,
        image: await primaryImage(ctx, product._id),
        unitPrice: { amount: toMinorUnits(product.salePrice ?? product.basePrice), currency: product.currency },
      },
    });
  }

  return { kept, cart: { revision, lines: priced, adjustments } satisfies PricedCart };
}

export const get = query({
  args: { cartKey: v.string() },
  returns: v.union(pricedCart, v.null()),
  handler: async (ctx, args) => {
    const cart = await ctx.db
      .query("carts")
      .withIndex("by_cartKey", (q) => q.eq("cartKey", args.cartKey))
      .unique();
    if (!cart) return null;
    return (await priceLines(ctx, cart.lines, cart.revision)).cart;
  },
});

/**
 * Store the shopper's line intent (product + quantity only; prices are never accepted
 * from the client), clamp it to what is sellable, and return the priced cart.
 */
export const sync = mutation({
  args: { cartKey: v.string(), lines: v.array(lineIntent) },
  returns: pricedCart,
  handler: async (ctx, args) => {
    if (args.cartKey.length < 32 || args.cartKey.length > 64) throw new Error("Invalid cart key");

    // Normalize and de-duplicate intents; ids that don't belong to our tables are dropped.
    const byKey = new Map<string, StoredLine>();
    for (const intent of args.lines.slice(0, MAX_CART_LINES)) {
      const productId = ctx.db.normalizeId("products", intent.productId);
      const variantId = intent.variantId === null ? null : ctx.db.normalizeId("productVariants", intent.variantId);
      const quantity = Math.min(MAX_LINE_QUANTITY, Math.max(0, Math.trunc(intent.quantity)));
      if (!productId || (intent.variantId !== null && !variantId) || quantity === 0) continue;
      const key = `${productId}:${variantId ?? ""}`;
      const existing = byKey.get(key);
      byKey.set(key, { productId, variantId, quantity: Math.min(MAX_LINE_QUANTITY, (existing?.quantity ?? 0) + quantity) });
    }

    const existing = await ctx.db
      .query("carts")
      .withIndex("by_cartKey", (q) => q.eq("cartKey", args.cartKey))
      .unique();
    const revision = (existing?.revision ?? 0) + 1;
    const { kept, cart } = await priceLines(ctx, [...byKey.values()], revision);

    const doc = { cartKey: args.cartKey, lines: kept, revision, updatedAt: Date.now() };
    if (existing) await ctx.db.replace("carts", existing._id, doc);
    else await ctx.db.insert("carts", doc);

    return cart;
  },
});
