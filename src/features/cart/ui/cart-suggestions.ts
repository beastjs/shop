import type { FunctionReturnType } from "convex/server";
import { api } from "../../../../convex/_generated/api";
import { convex } from "@/lib/convex";

export type CartSuggestions = FunctionReturnType<typeof api.products.cartSuggestions>;

let pending: Promise<CartSuggestions | null> | null = null;

/**
 * Empty-cart suggestions over the same HTTP client the route loaders use — they don't need to be
 * live. One request per session; a failure clears the cache so the next open retries, and the
 * drawer simply falls back to its plain empty message.
 */
export function loadCartSuggestions(): Promise<CartSuggestions | null> {
  pending ??= convex.query(api.products.cartSuggestions, {}).catch((error: unknown) => {
    console.error("Failed to load cart suggestions.", error);
    pending = null;
    return null;
  });
  return pending;
}
