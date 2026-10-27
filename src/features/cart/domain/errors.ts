import { Schema } from "effect"

export class CartStorageError extends Schema.TaggedError<CartStorageError>()("CartStorageError", {
  message: Schema.String,
}) {}

export class CartSyncError extends Schema.TaggedError<CartSyncError>()("CartSyncError", {
  message: Schema.String,
}) {}

export class CheckoutUnavailable extends Schema.TaggedError<CheckoutUnavailable>()("CheckoutUnavailable", {
  message: Schema.String,
}) {}
