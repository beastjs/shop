import { Effect, Stream, SubscriptionRef } from "effect"
import { createScope } from "octane/signals"
import type { ProductCardItem } from "@/lib/product/card-types"
import { CartService, type CartState } from "./CartService"
import * as Cart from "./domain/cart"
import type { Cart as CartData } from "./domain/schema"
import { cartRuntime } from "./runtime"

/**
 * Octane signals bridge. The Effect CartService owns the cart; this module mirrors its
 * state into signals that templates read natively (e.g. `span #{cartCount$}`).
 */
const scope = createScope({ scopeKey: "cart" })

const service = cartRuntime.runSync(CartService)

export const cartState$ = scope.signal$<CartState>("state", cartRuntime.runSync(SubscriptionRef.get(service.state)))
export const cartTotals$ = scope.derived$("totals", () => Cart.totals(scope.get(cartState$).cart))
export const cartCount$ = scope.derived$("count", () => scope.get(cartTotals$).itemCount)
export const cartDrawerOpen$ = scope.signal$("drawerOpen", false)

const mirror = () => cartState$.set(cartRuntime.runSync(SubscriptionRef.get(service.state)))

// Background changes (server receipts, other tabs, sync status) flow into the signal.
cartRuntime.runFork(
  Stream.runForEach(SubscriptionRef.changes(service.state), (state) => Effect.sync(() => cartState$.set(state))),
)

const apply = (op: (cart: CartData) => CartData) => {
  cartRuntime.runSync(service.apply(op))
  mirror() // update synchronously so the UI never waits on the stream
}

const snapshotOf = (product: ProductCardItem) => {
  const image = product.media.find((m) => m.isPrimary && m.type === "image") ?? product.media.find((m) => m.type === "image")
  return {
    name: product.name,
    sku: product.sku,
    image: image?.url ?? null,
    unitPrice: {
      amount: Cart.toMinorUnits(product.price.salePrice ?? product.price.basePrice),
      currency: product.price.currency,
    },
  }
}

export const cartActions = {
  add(product: ProductCardItem, quantity = 1) {
    apply((cart) => Cart.addLine(cart, { productId: product.id, snapshot: snapshotOf(product) }, quantity))
  },
  setQuantity(key: string, quantity: number) {
    apply((cart) => Cart.setQuantity(cart, key, quantity))
  },
  remove(key: string) {
    apply((cart) => Cart.removeLine(cart, key))
  },
  clear() {
    apply(Cart.clear)
  },
  retrySync() {
    cartRuntime.runFork(service.syncNow)
  },
  dismissAdjustments() {
    cartRuntime.runSync(service.dismissAdjustments)
    mirror()
  },
  /** Resolves to a checkout URL, or a message explaining why checkout can't start. */
  checkout(): Promise<{ readonly url: string } | { readonly message: string }> {
    return cartRuntime.runPromise(
      service.checkout.pipe(
        Effect.map((session) => ({ url: session.url })),
        Effect.catchTag("CheckoutUnavailable", (e) => Effect.succeed({ message: e.message })),
      ),
    )
  },
  open() {
    cartDrawerOpen$.set(true)
  },
  close() {
    cartDrawerOpen$.set(false)
  },
  toggle() {
    cartDrawerOpen$.set((open) => !open)
  },
}
