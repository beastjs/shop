/** Public cart API. UI and pages import from here, never from internals. */
export { cartActions, cartCount$, cartDrawerOpen$, cartState$, cartTotals$ } from "./state"
export { formatMoney, lineKey } from "./domain/cart"
export type { CartState, SyncStatus } from "./CartService"
export type { Cart, CartLine, LineAdjustment, Money } from "./domain/schema"
