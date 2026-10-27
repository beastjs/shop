import { Context, type Effect, type Option } from "effect"
import type { CartStorageError } from "../domain/errors"
import type { Cart } from "../domain/schema"

/** Where the local cart lives between visits. */
export class CartStorage extends Context.Service<CartStorage, {
  load: Effect.Effect<Option.Option<Cart>, CartStorageError>
  save(cart: Cart): Effect.Effect<void, CartStorageError>
  /** Notify when another tab/window writes the cart. Returns an unsubscribe. */
  watch(onChange: (cart: Cart) => void): () => void
}>()("shop/cart/CartStorage") {}
