import { Effect, Layer } from "effect"
import { CheckoutUnavailable } from "../domain/errors"
import { CheckoutGateway } from "../ports/CheckoutGateway"

/** Placeholder until a payment provider is wired in. */
export const CheckoutUnavailableLayer = Layer.succeed(
  CheckoutGateway,
  CheckoutGateway.of({
    begin: () => Effect.fail(new CheckoutUnavailable({ message: "Checkout is coming soon." })),
  }),
)
