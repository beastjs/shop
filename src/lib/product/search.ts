import type { ProductCardItem } from "./card-types";

/**
 * A searchable product field. Each whitespace-separated query term must match
 * at least one enabled field, so "tee <30" means name contains "tee" AND price < 30.
 * Add a new field here (e.g. sku, tags) and include its key in `fields` to enable it.
 */
export interface SearchField<T> {
  label: string;
  match: (item: T, term: string) => boolean;
}

const effectivePrice = (item: ProductCardItem) => item.price.salePrice ?? item.price.basePrice;

const parseAmount = (value: string) => {
  const amount = Number(value.replace(/[$,]/g, ""));
  return value.trim() !== "" && Number.isFinite(amount) ? amount : null;
};

/**
 * Price terms: `25` (price starts with 25, so 25, 25.99, 250), `<50`, `<=50`,
 * `>20`, `>=20`, and ranges like `20-50`. A leading `$` is allowed.
 */
export const matchPrice = (price: number, term: string): boolean => {
  const range = term.match(/^\$?([\d.,]+)\s*-\s*\$?([\d.,]+)$/);
  if (range) {
    const min = parseAmount(range[1]);
    const max = parseAmount(range[2]);
    return min !== null && max !== null && price >= min && price <= max;
  }

  const comparison = term.match(/^(<=|>=|<|>)\s*(.+)$/);
  if (comparison) {
    const amount = parseAmount(comparison[2]);
    if (amount === null) return false;
    switch (comparison[1]) {
      case "<": return price < amount;
      case "<=": return price <= amount;
      case ">": return price > amount;
      case ">=": return price >= amount;
    }
  }

  const digits = term.replace(/^\$/, "");
  return parseAmount(digits) !== null && String(price).startsWith(digits);
};

export const productSearchFields = {
  name: {
    label: "Name",
    match: (item, term) => item.name.toLowerCase().includes(term),
  },
  price: {
    label: "Price",
    match: (item, term) => matchPrice(effectivePrice(item), term),
  },
} satisfies Record<string, SearchField<ProductCardItem>>;

export type ProductSearchFieldKey = keyof typeof productSearchFields;

export const defaultProductSearchFields: ProductSearchFieldKey[] = ["name", "price"];

export function filterProducts(
  products: ProductCardItem[],
  query: string,
  fields: readonly ProductSearchFieldKey[] = defaultProductSearchFields,
): ProductCardItem[] {
  // Glue operators to their amounts so "< 50" and "20 - 50" stay single terms.
  const normalized = query
    .replace(/(<=|>=|<|>)\s+/g, "$1")
    .replace(/(\d)\s*-\s*(\$?\d)/g, "$1-$2");
  const terms = normalized.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return products;

  const matchers: SearchField<ProductCardItem>[] = fields.map((key) => productSearchFields[key]);
  return products.filter((product) =>
    terms.every((term) => matchers.some((field) => field.match(product, term))),
  );
}
