import {
  MAX_LINES,
  MAX_LINE_QUANTITY,
  type Cart,
  type CartId,
  type CartLine,
  type LineIntent,
  type LineSnapshot,
  type Money,
  type ServerCart,
} from "./schema"

export const DEFAULT_CURRENCY = "USD"

export const lineKey = (productId: string, variantId: string | null) =>
  variantId === null ? productId : `${productId}:${variantId}`

const keyOf = (line: { productId: string; variantId: string | null }) => lineKey(line.productId, line.variantId)

const clampQuantity = (quantity: number) => Math.min(MAX_LINE_QUANTITY, Math.max(0, Math.trunc(quantity)))

export const toMinorUnits = (amount: number) => Math.round(amount * 100)

export const emptyCart = (id: CartId, now = Date.now()): Cart => ({
  version: 1,
  id,
  lines: [],
  revision: 0,
  localVersion: 0,
  syncedVersion: 0,
  updatedAt: now,
})

const touch = (cart: Cart, lines: readonly CartLine[], now: number): Cart => ({
  ...cart,
  lines,
  localVersion: cart.localVersion + 1,
  updatedAt: now,
})

export interface AddLineInput {
  readonly productId: string
  readonly variantId?: string | null
  readonly snapshot: LineSnapshot
}

export function addLine(cart: Cart, input: AddLineInput, quantity = 1, now = Date.now()): Cart {
  const variantId = input.variantId ?? null
  const key = lineKey(input.productId, variantId)
  const existing = cart.lines.find((line) => keyOf(line) === key)

  if (existing) {
    const next = clampQuantity(existing.quantity + quantity)
    if (next === existing.quantity) return cart
    return touch(cart, cart.lines.map((line) => (line === existing ? { ...line, quantity: next } : line)), now)
  }

  if (cart.lines.length >= MAX_LINES) return cart
  const initial = clampQuantity(quantity)
  if (initial === 0) return cart
  return touch(cart, [...cart.lines, { productId: input.productId, variantId, quantity: initial, snapshot: input.snapshot }], now)
}

/** Quantity 0 (or less) removes the line. */
export function setQuantity(cart: Cart, key: string, quantity: number, now = Date.now()): Cart {
  const next = clampQuantity(quantity)
  const existing = cart.lines.find((line) => keyOf(line) === key)
  if (!existing || existing.quantity === next) return cart
  if (next === 0) return removeLine(cart, key, now)
  return touch(cart, cart.lines.map((line) => (line === existing ? { ...line, quantity: next } : line)), now)
}

export function removeLine(cart: Cart, key: string, now = Date.now()): Cart {
  const lines = cart.lines.filter((line) => keyOf(line) !== key)
  return lines.length === cart.lines.length ? cart : touch(cart, lines, now)
}

export function clear(cart: Cart, now = Date.now()): Cart {
  return cart.lines.length === 0 ? cart : touch(cart, [], now)
}

export const isDirty = (cart: Cart) => cart.localVersion !== cart.syncedVersion

export const toIntents = (cart: Cart): LineIntent[] =>
  cart.lines.map(({ productId, variantId, quantity }) => ({ productId, variantId, quantity }))

export interface Totals {
  readonly itemCount: number
  readonly subtotal: Money
}

export function totals(cart: Cart): Totals {
  let itemCount = 0
  let amount = 0
  for (const line of cart.lines) {
    itemCount += line.quantity
    amount += line.snapshot.unitPrice.amount * line.quantity
  }
  const currency = cart.lines[0]?.snapshot.unitPrice.currency ?? DEFAULT_CURRENCY
  return { itemCount, subtotal: { amount, currency } }
}

/**
 * Fold a server receipt into the local cart.
 * - Older or equal revisions are ignored.
 * - If nothing changed locally since `pushedVersion`, the server's lines win (prices, clamped quantities, removals).
 * - Otherwise local quantities are kept (they are newer intent) and only snapshots/prices are refreshed;
 *   the cart stays dirty so the next sync sends the newer intent.
 */
export function reconcile(cart: Cart, receipt: ServerCart, pushedVersion: number): Cart {
  if (receipt.revision <= cart.revision) return cart

  if (cart.localVersion === pushedVersion) {
    return {
      ...cart,
      lines: receipt.lines,
      revision: receipt.revision,
      syncedVersion: pushedVersion,
    }
  }

  const serverByKey = new Map(receipt.lines.map((line) => [keyOf(line), line]))
  return {
    ...cart,
    revision: receipt.revision,
    lines: cart.lines.map((line) => {
      const server = serverByKey.get(keyOf(line))
      return server ? { ...line, snapshot: server.snapshot } : line
    }),
  }
}

export function formatMoney({ amount, currency }: Money, locale?: string) {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount / 100)
}
