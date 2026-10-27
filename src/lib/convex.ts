import { ConvexHttpClient } from 'convex/browser'

const convexUrl = process.env.PUBLIC_CONVEX_URL
if (!convexUrl) throw new Error('Missing CONVEX_URL. Set it in .env.local before starting the storefront.')

/** One HTTP client for the app: route loaders and the cart remote share it. */
export const convex = new ConvexHttpClient(convexUrl)
