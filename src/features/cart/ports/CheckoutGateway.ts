import { Context, type Effect } from "effect"
import type { CheckoutUnavailable } from "../domain/errors"
import type { CartId } from "../domain/schema"

export interface CheckoutSession {
  readonly url: string
}

/**
 * The seam where payments plug in. Implementations must read the server cart
 * (by id), never client-side totals.
 */
export class CheckoutGateway extends Context.Service<CheckoutGateway, {
  begin(cartId: CartId): Effect.Effect<CheckoutSession, CheckoutUnavailable>
}>()("shop/cart/CheckoutGateway") {}
