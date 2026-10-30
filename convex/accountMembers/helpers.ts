import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type Context = QueryCtx | MutationCtx;
type AccountMemberRole = "viewer" | "member" | "admin" | "owner";

const ACCOUNT_MEMBER_ROLE_VALUES: AccountMemberRole[] = [
  "viewer",
  "member",
  "admin",
  "owner",
];

const hasAccountMemberRole = (role: AccountMemberRole, minimum: AccountMemberRole) =>
  ACCOUNT_MEMBER_ROLE_VALUES.indexOf(role) >= ACCOUNT_MEMBER_ROLE_VALUES.indexOf(minimum);

export const getMembershipByTokenIdentifier = async (
  ctx: Context,
  accountId: Id<"accounts">,
  tokenIdentifier: string,
) =>
  await ctx.db
    .query("accountMembers")
    .withIndex("by_accountId_and_tokenIdentifier", (q) =>
      q.eq("accountId", accountId).eq("tokenIdentifier", tokenIdentifier),
    )
    .unique();

export const requireAccountAccess = async (
  ctx: Context,
  accountId: Id<"accounts">,
  minimumRole: AccountMemberRole,
): Promise<{
  tokenIdentifier: string;
  isPlatformAdmin: boolean;
  membership: Doc<"accountMembers"> | null;
}> => {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity) {
    throw new ConvexError("Unauthenticated.");
  }

  if (identity.god === true) {
    return { tokenIdentifier: identity.tokenIdentifier, isPlatformAdmin: true, membership: null };
  }

  const membership = await getMembershipByTokenIdentifier(ctx, accountId, identity.tokenIdentifier);

  if (membership?.status !== "active") {
    throw new ConvexError("Unauthorized.");
  }

  if (!hasAccountMemberRole(membership.role, minimumRole)) {
    throw new ConvexError("Unauthorized.");
  }

  return { tokenIdentifier: identity.tokenIdentifier, isPlatformAdmin: false, membership };
};
