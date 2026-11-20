import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../convex/_generated/api";

/** Loader result for the product item page; null when the product isn't listed in that category. */
export type ProductDetailResult = FunctionReturnType<typeof api.products.getBySku>;
export type ProductDetail = NonNullable<ProductDetailResult>["product"];
export type ProductDetailCategory = NonNullable<ProductDetailResult>["category"];
