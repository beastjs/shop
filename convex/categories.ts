import { mutation } from "./_generated/server";

const seedCategories = [
  { name: "Apparels", slug: "apparel" },
  { name: "Bags", slug: "bags" },
  { name: "Perfumes", slug: "perfumes" },
  { name: "Phones", slug: "phones" },
  { name: "Audio", slug: "audio" },
  { name: "Gaming", slug: "gaming" },
  { name: "Software", slug: "software" },
] as const;

export const seedCategoriesTable = mutation({
  args: {},
  handler: async (ctx) => {
    const results = [];

    for (const category of seedCategories) {
      let existing = await ctx.db
        .query("categories")
        .withIndex("by_slug", (q) => q.eq("slug", category.slug))
        .unique();

      // Older local seed runs used "apparels" before the storefront route settled on "apparel".
      if (!existing && category.slug === "apparel") {
        existing = await ctx.db
          .query("categories")
          .withIndex("by_slug", (q) => q.eq("slug", "apparels"))
          .unique();
      }

      if (existing) {
        if (existing.slug !== category.slug) {
          await ctx.db.patch(existing._id, {
            externalId: category.slug,
            name: category.name,
            slug: category.slug,
          });
        }
        results.push({ slug: category.slug, id: existing._id, created: false });
        continue;
      }

      const id = await ctx.db.insert("categories", {
        externalId: category.slug,
        name: category.name,
        slug: category.slug,
      });
      results.push({ slug: category.slug, id, created: true });
    }

    return results;
  },
});
