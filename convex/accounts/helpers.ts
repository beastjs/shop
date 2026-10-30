import type { UserIdentity } from "convex/server";
import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";

export const getAccountBySlug = async (ctx: QueryCtx, slug: string) =>
  await ctx.db
    .query("accounts")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();

const isPlatformStaff = (identity: UserIdentity) =>
  identity.admin === true || identity.god === true;

export const requireAdminIdentity = async (ctx: QueryCtx) => {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity || !isPlatformStaff(identity)) {
    throw new ConvexError("Unauthorized.");
  }

  return identity;
};

export const requireGodIdentity = async (ctx: QueryCtx) => {
  const identity = await ctx.auth.getUserIdentity();

  if (identity?.god !== true) {
    throw new ConvexError("Creating an account requires a god account.");
  }

  return identity;
};
