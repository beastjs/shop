import { Context, Effect, Fiber, Layer, Option, Ref, Schedule, Schema, Semaphore, SubscriptionRef } from "effect"
import { emptyCart, isDirty, reconcile, toIntents } from "./domain/cart"
import type { CheckoutUnavailable } from "./domain/errors"
import { type Cart, CartId, type LineAdjustment } from "./domain/schema"
import { CartRemote } from "./ports/CartRemote"
import { CartStorage } from "./ports/CartStorage"
import { CheckoutGateway, type CheckoutSession } from "./ports/CheckoutGateway"

export type SyncStatus = "idle" | "pending" | "syncing" | "error"

export interface CartState {
  readonly cart: Cart
  readonly sync: SyncStatus
  readonly error: string | null
  /** Server-side changes the shopper should hear about (price changed, out of stock, …). */
  readonly adjustments: readonly LineAdjustment[]
}

export interface CartServiceOptions {
  /** Wait for edits to settle before syncing. */
  readonly debounce?: number
  readonly retryBase?: number
  readonly retryTimes?: number
  readonly newCartId?: () => CartId
}

const decodeCartId = Schema.decodeUnknownSync(CartId)

const createCartUuid = () => {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID()

  // randomUUID is unavailable on HTTP LAN origins; getRandomValues also works there.
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/**
 * Orchestrates the cart: local edits apply instantly and persist, then sync to the
 * remote in the background. The remote is authoritative for prices and stock.
 */
export class CartService extends Context.Service<CartService, {
  readonly state: SubscriptionRef.SubscriptionRef<CartState>
  /** Apply a pure domain operation (see domain/cart.ts) and schedule a sync. */
  apply(op: (cart: Cart) => Cart): Effect.Effect<void>
  readonly syncNow: Effect.Effect<void>
  readonly dismissAdjustments: Effect.Effect<void>
  readonly checkout: Effect.Effect<CheckoutSession, CheckoutUnavailable>
}>()("shop/cart/CartService") {
  static readonly layerWith = (options: CartServiceOptions = {}) =>
    Layer.effect(
      CartService,
      Effect.gen(function*() {
        const storage = yield* CartStorage
        const remote = yield* CartRemote
        const checkoutGateway = yield* CheckoutGateway
        const debounce = options.debounce ?? 400
        const newCartId = options.newCartId ?? (() => decodeCartId(createCartUuid()))

        const stored = yield* storage.load.pipe(Effect.orElseSucceed(() => Option.none<Cart>()))
        const initial = Option.getOrElse(stored, () => emptyCart(newCartId()))
        const state = yield* SubscriptionRef.make<CartState>({
          cart: initial,
          sync: isDirty(initial) ? "pending" : "idle",
          error: null,
          adjustments: [],
        })
        const pushLock = yield* Semaphore.make(1)
        const timer = yield* Ref.make<Fiber.Fiber<void> | undefined>(undefined)

        const persist = (cart: Cart) =>
          storage.save(cart).pipe(Effect.catchTag("CartStorageError", (e) => Effect.logWarning("Cart not saved", e.message)))

        const retry = Schedule.exponential(options.retryBase ?? 500)

        // One push at a time, so the server always sees intents in order.
        const pushOnce = pushLock.withPermit(
          Effect.gen(function*() {
            const { cart } = yield* SubscriptionRef.get(state)
            if (!isDirty(cart)) return
            const pushedVersion = cart.localVersion
            yield* SubscriptionRef.update(state, (s) => ({ ...s, sync: "syncing" as const, error: null }))

            const receipt = yield* remote.push(cart.id, toIntents(cart)).pipe(
              Effect.retry({ schedule: retry, times: options.retryTimes ?? 4 }),
            )

            const next = yield* SubscriptionRef.modify(state, (s): [Cart, CartState] => {
              const merged = reconcile(s.cart, receipt, pushedVersion)
              return [merged, {
                cart: merged,
                sync: isDirty(merged) ? "pending" : "idle",
                error: null,
                adjustments: [...s.adjustments, ...receipt.adjustments],
              }]
            })
            yield* persist(next)
          }),
        ).pipe(
          Effect.catchTag("CartSyncError", (e) =>
            SubscriptionRef.update(state, (s) => ({ ...s, sync: "error" as const, error: e.message }))),
          Effect.withSpan("CartService.push"),
        )

        // Keep pushing while edits landed during a push.
        const syncUntilClean: Effect.Effect<void> = Effect.gen(function*() {
          yield* pushOnce
          const s = yield* SubscriptionRef.get(state)
          if (s.sync === "pending") yield* syncUntilClean
        })

        // Only the debounce timer is cancelled by new edits; a push already in flight finishes.
        const schedule = Effect.gen(function*() {
          const previous = yield* Ref.get(timer)
          if (previous) yield* Fiber.interrupt(previous)
          const fiber = yield* Effect.sleep(debounce).pipe(
            Effect.andThen(Effect.forkDetach(syncUntilClean)),
            Effect.asVoid,
            Effect.forkDetach,
          )
          yield* Ref.set(timer, fiber)
        })

        const apply = Effect.fn("CartService.apply")(function*(op: (cart: Cart) => Cart) {
          const changed = yield* SubscriptionRef.modify(state, (s): [Cart | null, CartState] => {
            const next = op(s.cart)
            return next === s.cart ? [null, s] : [next, { ...s, cart: next, sync: "pending" }]
          })
          if (changed === null) return
          yield* persist(changed)
          yield* schedule
        })

        // Another tab wrote the cart: adopt it if it is newer than ours.
        const adoptExternal = (incoming: Cart) =>
          SubscriptionRef.update(state, (s): CartState =>
            incoming.id === s.cart.id && incoming.updatedAt <= s.cart.updatedAt
              ? s
              : { ...s, cart: incoming, sync: isDirty(incoming) ? "pending" : "idle" })
        const unwatch = storage.watch((cart) => Effect.runFork(adoptExternal(cart)))
        yield* Effect.addFinalizer(() =>
          Effect.gen(function*() {
            unwatch()
            const fiber = yield* Ref.get(timer)
            if (fiber) yield* Fiber.interrupt(fiber)
          }))

        // Initial sync: push unsynced local edits, otherwise refresh prices/stock from the server.
        const initialSync = isDirty(initial)
          ? syncUntilClean
          : remote.pull(initial.id).pipe(
            Effect.flatMap(Option.match({
              onNone: () => Effect.void,
              onSome: (receipt) =>
                SubscriptionRef.modify(state, (s): [Cart, CartState] => {
                  const merged = reconcile(s.cart, receipt, s.cart.localVersion)
                  return [merged, { ...s, cart: merged, adjustments: [...s.adjustments, ...receipt.adjustments] }]
                }).pipe(Effect.flatMap(persist)),
            })),
            Effect.catchTag("CartSyncError", (e) => Effect.logWarning("Cart refresh failed", e.message)),
          )
        yield* Effect.forkScoped(initialSync)

        return CartService.of({
          state,
          apply,
          syncNow: syncUntilClean,
          dismissAdjustments: SubscriptionRef.update(state, (s) => ({ ...s, adjustments: [] })),
          checkout: Effect.gen(function*() {
            yield* syncUntilClean
            const { cart } = yield* SubscriptionRef.get(state)
            return yield* checkoutGateway.begin(cart.id)
          }),
        })
      }),
    )

  static readonly layer = CartService.layerWith()
}
