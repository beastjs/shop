import { Layer, ManagedRuntime } from "effect"
import { CheckoutUnavailableLayer } from "./adapters/checkout"
import { CartRemoteConvex } from "./adapters/remote"
import { CartStorageLocal } from "./adapters/storage"
import { CartService } from "./CartService"

/**
 * The one place cart adapters are chosen. Swap a layer here to change persistence,
 * backend or payment provider; nothing else in the app needs to know.
 */
export const CartLive = CartService.layer.pipe(
  Layer.provide(Layer.mergeAll(CartStorageLocal, CartRemoteConvex, CheckoutUnavailableLayer)),
)

export const cartRuntime = ManagedRuntime.make(CartLive)
