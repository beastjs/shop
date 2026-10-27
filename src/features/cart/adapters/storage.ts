import { Effect, Layer, Option } from "effect"
import { KeyValueStore } from "effect/persistence"
import { CartStorageError } from "../domain/errors"
import { Cart } from "../domain/schema"
import { CartStorage } from "../ports/CartStorage"

export const CART_STORAGE_KEY = "shop.cart.v1"

type Load = CartStorage["Service"]["load"]
type Watch = (onChange: (cart: Cart) => void, load: Load) => () => void

const toStorageError = (error: { readonly message: string }) => new CartStorageError({ message: error.message })

/** CartStorage over any KeyValueStore; corrupt or outdated data loads as "no cart". */
const fromKeyValueStore = (watch: Watch) =>
  Layer.effect(
    CartStorage,
    Effect.gen(function*() {
      const store = KeyValueStore.toSchemaStore(yield* KeyValueStore.KeyValueStore, Cart)

      const load: Load = store.get(CART_STORAGE_KEY).pipe(
        Effect.catchTag("SchemaError", (error) =>
          Effect.logWarning("Discarding unreadable stored cart", error.message).pipe(Effect.as(Option.none<Cart>()))),
        Effect.mapError(toStorageError),
      )
      const save = Effect.fn("CartStorage.save")(function*(cart: Cart) {
        yield* store.set(CART_STORAGE_KEY, cart).pipe(Effect.mapError(toStorageError))
      })

      return CartStorage.of({ load, save, watch: (onChange) => watch(onChange, load) })
    }),
  )

/** Browser localStorage, with cross-tab updates via the `storage` event. */
export const CartStorageLocal = fromKeyValueStore((onChange, load) => {
  const listener = (event: StorageEvent) => {
    if (event.key !== CART_STORAGE_KEY || event.newValue === null) return
    const cart = Effect.runSync(load.pipe(Effect.orElseSucceed(() => Option.none<Cart>())))
    if (Option.isSome(cart)) onChange(cart.value)
  }
  window.addEventListener("storage", listener)
  return () => window.removeEventListener("storage", listener)
}).pipe(Layer.provide(KeyValueStore.layerStorage(() => localStorage)))

/** In-memory storage for tests and non-browser environments. */
export const CartStorageMemory = fromKeyValueStore(() => () => {}).pipe(Layer.provide(KeyValueStore.layerMemory))
