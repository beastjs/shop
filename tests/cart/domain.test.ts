import { describe, expect, it } from "bun:test"
import { Schema } from "effect"
import {
  addLine,
  clear,
  emptyCart,
  isDirty,
  lineKey,
  reconcile,
  removeLine,
  setQuantity,
  toMinorUnits,
  totals,
} from "../../src/features/cart/domain/cart"
import { Cart, CartId, type LineSnapshot } from "../../src/features/cart/domain/schema"

const id = Schema.decodeUnknownSync(CartId)("6f1d2b44-8f0e-4c5a-9a7e-2f3b1c4d5e6f")
const snap = (name: string, dollars: number): LineSnapshot => ({
  name,
  sku: name.toUpperCase(),
  image: null,
  unitPrice: { amount: toMinorUnits(dollars), currency: "USD" },
})
const tee = { productId: "p1", snapshot: snap("Tee", 19.99) }
const hoodie = { productId: "p2", snapshot: snap("Hoodie", 0.1) }

describe("cart domain", () => {
  it("adds lines and merges repeat adds into one line", () => {
    let cart = addLine(emptyCart(id), tee)
    cart = addLine(cart, tee, 2)
    expect(cart.lines).toHaveLength(1)
    expect(cart.lines[0]!.quantity).toBe(3)
    expect(cart.localVersion).toBe(2)
    expect(isDirty(cart)).toBe(true)
  })

  it("keys variants separately", () => {
    let cart = addLine(emptyCart(id), { ...tee, variantId: "red" })
    cart = addLine(cart, { ...tee, variantId: "blue" })
    expect(cart.lines.map((l) => lineKey(l.productId, l.variantId))).toEqual(["p1:red", "p1:blue"])
  })

  it("clamps quantity to 1..99 and removes at 0", () => {
    let cart = addLine(emptyCart(id), tee, 500)
    expect(cart.lines[0]!.quantity).toBe(99)
    cart = setQuantity(cart, "p1", 0)
    expect(cart.lines).toHaveLength(0)
  })

  it("returns the same cart for no-op edits", () => {
    const cart = addLine(emptyCart(id), tee)
    expect(setQuantity(cart, "p1", 1)).toBe(cart)
    expect(removeLine(cart, "missing")).toBe(cart)
    expect(clear(emptyCart(id))).toEqual(emptyCart(id, emptyCart(id).updatedAt))
  })

  it("totals in minor units without float drift", () => {
    let cart = addLine(emptyCart(id), hoodie, 3) // 0.1 * 3 would be 0.30000000000000004 in floats
    cart = addLine(cart, tee, 2)
    expect(totals(cart)).toEqual({ itemCount: 5, subtotal: { amount: 30 + 3998, currency: "USD" } })
  })

  it("adopts server lines when nothing changed since the push", () => {
    const cart = addLine(emptyCart(id), tee, 5)
    const receipt = {
      revision: 1,
      lines: [{ productId: "p1", variantId: null, quantity: 2, snapshot: snap("Tee", 17) }],
      adjustments: [],
    }
    const next = reconcile(cart, receipt, cart.localVersion)
    expect(next.lines[0]!.quantity).toBe(2)
    expect(next.lines[0]!.snapshot.unitPrice.amount).toBe(1700)
    expect(isDirty(next)).toBe(false)
    expect(next.revision).toBe(1)
  })

  it("keeps newer local quantities but refreshes prices when edited mid-sync", () => {
    const pushed = addLine(emptyCart(id), tee, 1)
    const edited = setQuantity(pushed, "p1", 4)
    const receipt = {
      revision: 1,
      lines: [{ productId: "p1", variantId: null, quantity: 1, snapshot: snap("Tee", 15) }],
      adjustments: [],
    }
    const next = reconcile(edited, receipt, pushed.localVersion)
    expect(next.lines[0]!.quantity).toBe(4)
    expect(next.lines[0]!.snapshot.unitPrice.amount).toBe(1500)
    expect(isDirty(next)).toBe(true)
  })

  it("ignores stale receipts", () => {
    const cart = { ...addLine(emptyCart(id), tee), revision: 5 }
    expect(reconcile(cart, { revision: 4, lines: [], adjustments: [] }, cart.localVersion)).toBe(cart)
  })

  it("round-trips through the storage schema", () => {
    const cart = addLine(addLine(emptyCart(id), tee), { ...hoodie, variantId: "xl" }, 2)
    const encoded = Schema.encodeSync(Cart)(cart)
    const decoded = Schema.decodeUnknownSync(Cart)(JSON.parse(JSON.stringify(encoded)))
    expect(decoded).toEqual(cart)
  })

  it("rejects corrupt stored data", () => {
    expect(() => Schema.decodeUnknownSync(Cart)({ version: 1, id, lines: [{ quantity: 0 }] })).toThrow()
  })
})
