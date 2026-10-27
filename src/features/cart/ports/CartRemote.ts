import { Context, type Effect, type Option } from "effect"
import type { CartSyncError } from "../domain/errors"
import type { CartId, LineIntent, ServerCart } from "../domain/schema"

/** The authoritative backend: prices, stock and the cart that follows the shopper. */
export class CartRemote extends Context.Service<CartRemote, {
  pull(cartId: CartId): Effect.Effect<Option.Option<ServerCart>, CartSyncError>
  push(cartId: CartId, lines: readonly LineIntent[]): Effect.Effect<ServerCart, CartSyncError>
}>()("shop/cart/CartRemote") {}
