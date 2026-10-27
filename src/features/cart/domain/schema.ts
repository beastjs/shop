import { Schema } from "effect"

export const MAX_LINE_QUANTITY = 99
export const MAX_LINES = 100

export const CartId = Schema.String.check(Schema.isUUID()).pipe(Schema.brand("CartId"))
export type CartId = typeof CartId.Type

export const Quantity = Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: MAX_LINE_QUANTITY }))

/** Integer minor units (cents) so totals never accumulate float error. */
export const Money = Schema.Struct({
  amount: Schema.Int,
  currency: Schema.String,
})
export type Money = typeof Money.Type

/** Display-only copy of product data; the server price always wins. */
export const LineSnapshot = Schema.Struct({
  name: Schema.String,
  sku: Schema.String,
  image: Schema.NullOr(Schema.String),
  unitPrice: Money,
})
export type LineSnapshot = typeof LineSnapshot.Type

export const CartLine = Schema.Struct({
  productId: Schema.String,
  variantId: Schema.NullOr(Schema.String),
  quantity: Quantity,
  snapshot: LineSnapshot,
})
export type CartLine = typeof CartLine.Type

export const Cart = Schema.Struct({
  version: Schema.Literal(1),
  id: CartId,
  lines: Schema.Array(CartLine),
  /** Last server revision this cart has seen. */
  revision: Schema.Int,
  /** Bumped on every local edit; `syncedVersion` trails it until the server confirms. */
  localVersion: Schema.Int,
  syncedVersion: Schema.Int,
  updatedAt: Schema.Number,
})
export type Cart = typeof Cart.Type

/** What the server returns after pricing and validating a cart. */
export const ServerLine = Schema.Struct({
  productId: Schema.String,
  variantId: Schema.NullOr(Schema.String),
  quantity: Quantity,
  snapshot: LineSnapshot,
})

export const LineAdjustment = Schema.Struct({
  productId: Schema.String,
  variantId: Schema.NullOr(Schema.String),
  kind: Schema.Literals(["removed", "quantity", "price"]),
  message: Schema.String,
})
export type LineAdjustment = typeof LineAdjustment.Type

export const ServerCart = Schema.Struct({
  revision: Schema.Int,
  lines: Schema.Array(ServerLine),
  adjustments: Schema.Array(LineAdjustment),
})
export type ServerCart = typeof ServerCart.Type

/** The line intent sent to the server: no prices, the server supplies those. */
export interface LineIntent {
  readonly productId: string
  readonly variantId: string | null
  readonly quantity: number
}
