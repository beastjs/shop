const ACCOUNT_SLUG_MAX_LENGTH = 63;
const ACCOUNT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const RESERVED_ACCOUNT_SLUGS = new Set([
  "account",
  "accounts",
  "admin",
  "admin-handoff",
  "admin-overview",
  "admin-snaps",
  "admin-snaps-lab",
  "admin-workspace",
  "admin-settings",
  "api",
  "assets",
  "auth",
  "citadel",
  "favicon",
  "invite",
  "legal",
  "login",
  "logout",
  "pending",
  "robots",
  "settings",
  "signin",
  "signout",
  "signup",
  "snap",
  "snaps",
  "sitemap",
  "static",
]);

export const isAccountSlug = (slug: string) =>
  slug.length > 0 &&
  slug.length <= ACCOUNT_SLUG_MAX_LENGTH &&
  ACCOUNT_SLUG_PATTERN.test(slug);

export const isPublicAccountSlug = (slug: string) =>
  isAccountSlug(slug) && !RESERVED_ACCOUNT_SLUGS.has(slug);
