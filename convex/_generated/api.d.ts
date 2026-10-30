/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accountMembers_helpers from "../accountMembers/helpers.js";
import type * as accounts_d from "../accounts/d.js";
import type * as accounts_helpers from "../accounts/helpers.js";
import type * as accounts_q from "../accounts/q.js";
import type * as accounts_slug from "../accounts/slug.js";
import type * as carts from "../carts.js";
import type * as categories from "../categories.js";
import type * as products from "../products.js";
import type * as seed from "../seed.js";
import type * as users_q from "../users/q.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "accountMembers/helpers": typeof accountMembers_helpers;
  "accounts/d": typeof accounts_d;
  "accounts/helpers": typeof accounts_helpers;
  "accounts/q": typeof accounts_q;
  "accounts/slug": typeof accounts_slug;
  carts: typeof carts;
  categories: typeof categories;
  products: typeof products;
  seed: typeof seed;
  "users/q": typeof users_q;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
