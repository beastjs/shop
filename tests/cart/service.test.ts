import { describe, expect, it } from "bun:test"
import { Effect, Layer, Option, Schema, SubscriptionRef } from "effect"
import { CheckoutUnavailableLayer } from "../../src/features/cart/adapters/checkout"
import { CartStorageMemory } from "../../src/features/cart/adapters/storage"
import { CartService } from "../../src/features/cart/CartService"
import { addLine, setQuantity, toMinorUnits } from "../../src/features/cart/domain/cart"
import { CartSyncError } from "../../src/features/cart/domain/errors"
import { CartId, type LineIntent, type ServerCart } from "../../src/features/cart/domain/schema"
import { CartRemote } from "../../src/features/cart/ports/CartRemote"
import { CartStorage } from "../../src/features/cart/ports/CartStorage"

const id = Schema.decodeUnknownSync(CartId)("6f1d2b44-8f0e-4c5a-9a7e-2f3b1c4d5e6f")
const tee = {
  productId: "p1",
  snapshot: { name: "Tee", sku: "TEE", image: null, unitPrice: { amount: toMinorUnits(20), currency: "USD" } },
}

/** A fake server: prices everything at $15, caps quantity at `stock`, can fail N times. */
function fakeRemote(opts: { stock?: number; failures?: number; delay?: number } = {}) {
  const pushes: LineIntent[][] = []
  let revision = 0
  let failures = opts.failures ?? 0
  const respond = (lines: readonly LineIntent[]): ServerCart => ({
    revision: ++revision,
    lines: lines.map((l) => ({
      ...l,
      quantity: Math.min(l.quantity, opts.stock ?? 99),
      snapshot: { ...tee.snapshot, unitPrice: { amount: 1500, currency: "USD" } },
    })),
    adjustments: lines
      .filter((l) => l.quantity > (opts.stock ?? 99))
      .map((l) => ({ productId: l.productId, variantId: l.variantId, kind: "quantity" as const, message: "Only a few left" })),
  })
  const layer = Layer.succeed(
    CartRemote,
    CartRemote.of({
      pull: () => Effect.succeed(Option.none()),
      push: (_cartId, lines) =>
        Effect.gen(function*() {
          if (opts.delay) yield* Effect.sleep(opts.delay)
          if (failures-- > 0) return yield* Effect.fail(new CartSyncError({ message: "offline" }))
          pushes.push([...lines])
          return respond(lines)
        }),
    }),
  )
  return { layer, pushes }
}

const run = <A, E>(
  remote: Layer.Layer<CartRemote>,
  program: Effect.Effect<A, E, CartService | CartStorage>,
) =>
  Effect.runPromise(
    program.pipe(
      Effect.provide(
        CartService.layerWith({ debounce: 20, retryBase: 5, newCartId: () => id }).pipe(
          Layer.provideMerge(Layer.mergeAll(CartStorageMemory, remote, CheckoutUnavailableLayer)),
        ),
      ),
      Effect.scoped,
    ) as Effect.Effect<A, E>,
  )

const settle = (ms = 120) => Effect.sleep(ms)

describe("CartService", () => {
  it("applies edits instantly, persists them, then reconciles with server prices", async () => {
    const remote = fakeRemote()
    const result = await run(remote.layer, Effect.gen(function*() {
      const cart = yield* CartService
      yield* cart.apply((c) => addLine(c, tee, 2))
      const immediate = yield* SubscriptionRef.get(cart.state)
      const stored = yield* (yield* CartStorage).load
      yield* settle()
      return { immediate, stored, final: yield* SubscriptionRef.get(cart.state) }
    }))
    expect(result.immediate.cart.lines[0]!.quantity).toBe(2)
    expect(result.immediate.sync).toBe("pending")
    expect(Option.getOrThrow(result.stored).lines).toHaveLength(1)
    expect(result.final.sync).toBe("idle")
    expect(result.final.cart.lines[0]!.snapshot.unitPrice.amount).toBe(1500)
    expect(remote.pushes).toHaveLength(1)
  })

  it("debounces bursts of edits into one push", async () => {
    const remote = fakeRemote()
    await run(remote.layer, Effect.gen(function*() {
      const cart = yield* CartService
      for (let i = 0; i < 5; i++) yield* cart.apply((c) => addLine(c, tee))
      yield* settle()
    }))
    expect(remote.pushes).toEqual([[{ productId: "p1", variantId: null, quantity: 5 }]])
  })

  it("retries transient failures", async () => {
    const remote = fakeRemote({ failures: 2 })
    const state = await run(remote.layer, Effect.gen(function*() {
      const cart = yield* CartService
      yield* cart.apply((c) => addLine(c, tee))
      yield* settle(200)
      return yield* SubscriptionRef.get(cart.state)
    }))
    expect(state.sync).toBe("idle")
    expect(remote.pushes).toHaveLength(1)
  })

  it("reports an error after retries run out, keeping the local cart", async () => {
    const remote = fakeRemote({ failures: 100 })
    const state = await run(remote.layer, Effect.gen(function*() {
      const cart = yield* CartService
      yield* cart.apply((c) => addLine(c, tee))
      yield* settle(300)
      return yield* SubscriptionRef.get(cart.state)
    }))
    expect(state.sync).toBe("error")
    expect(state.error).toBe("offline")
    expect(state.cart.lines).toHaveLength(1)
  })

  it("adopts server stock limits and surfaces the adjustment", async () => {
    const remote = fakeRemote({ stock: 3 })
    const state = await run(remote.layer, Effect.gen(function*() {
      const cart = yield* CartService
      yield* cart.apply((c) => addLine(c, tee, 10))
      yield* settle()
      return yield* SubscriptionRef.get(cart.state)
    }))
    expect(state.cart.lines[0]!.quantity).toBe(3)
    expect(state.adjustments.map((a) => a.kind)).toEqual(["quantity"])
  })

  it("keeps edits made while a push is in flight and syncs them next", async () => {
    const remote = fakeRemote({ delay: 60 })
    const state = await run(remote.layer, Effect.gen(function*() {
      const cart = yield* CartService
      yield* cart.apply((c) => addLine(c, tee, 1))
      yield* Effect.sleep(40) // debounce elapsed, push in flight
      yield* cart.apply((c) => setQuantity(c, "p1", 7))
      yield* settle(300)
      return yield* SubscriptionRef.get(cart.state)
    }))
    expect(state.cart.lines[0]!.quantity).toBe(7)
    expect(state.sync).toBe("idle")
    expect(remote.pushes.map((p) => p[0]!.quantity)).toEqual([1, 7])
  })

  it("checkout goes through the gateway seam", async () => {
    const remote = fakeRemote()
    const error = await run(remote.layer, Effect.gen(function*() {
      const cart = yield* CartService
      yield* cart.apply((c) => addLine(c, tee))
      return yield* Effect.flip(cart.checkout)
    }))
    expect(error._tag).toBe("CheckoutUnavailable")
    expect(remote.pushes).toHaveLength(1) // synced before checkout
  })
})
