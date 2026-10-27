import { Effect, Layer, Option, Schema } from "effect"
import { api } from "../../../../convex/_generated/api"
import type { Id } from "../../../../convex/_generated/dataModel"
import { convex } from "@/lib/convex"
import { CartSyncError } from "../domain/errors"
import { ServerCart } from "../domain/schema"
import { CartRemote } from "../ports/CartRemote"

const decodeServerCart = Schema.decodeUnknownEffect(ServerCart)

const call = <A>(run: () => Promise<A>) =>
  Effect.tryPromise({
    try: run,
    catch: (error) => new CartSyncError({ message: error instanceof Error ? error.message : "Cart sync failed" }),
  })

const toSyncError = (error: { readonly message: string }) => new CartSyncError({ message: error.message })

/** Convex-backed cart: the server re-prices lines and checks stock on every sync. */
export const CartRemoteConvex = Layer.succeed(
  CartRemote,
  CartRemote.of({
    pull: Effect.fn("CartRemote.pull")(function*(cartId) {
      const result = yield* call(() => convex.query(api.carts.get, { cartKey: cartId }))
      if (result === null) return Option.none()
      return Option.some(yield* decodeServerCart(result).pipe(Effect.mapError(toSyncError)))
    }),
    push: Effect.fn("CartRemote.push")(function*(cartId, lines) {
      const result = yield* call(() =>
        convex.mutation(api.carts.sync, {
          cartKey: cartId,
          lines: lines.map((line) => ({
            productId: line.productId as Id<"products">,
            variantId: line.variantId as Id<"productVariants"> | null,
            quantity: line.quantity,
          })),
        }))
      return yield* decodeServerCart(result).pipe(Effect.mapError(toSyncError))
    }),
  }),
)

/** No backend: the cart stays local. Useful offline and in tests. */
export const CartRemoteNoop = Layer.succeed(
  CartRemote,
  CartRemote.of({
    pull: () => Effect.succeed(Option.none()),
    push: () => Effect.fail(new CartSyncError({ message: "No cart backend configured" })),
  }),
)
