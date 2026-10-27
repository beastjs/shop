import type { ProductMedia, ProductPrice } from "./types";

export interface ProductCardItem {
  id: string;
  sku: string;
  name: string;
  price: ProductPrice;
  media: ProductMedia[];
}

export interface CategoryProductsResult {
  category: { id: string; name: string; slug: string } | null;
  products: ProductCardItem[];
}
