import { createRoot } from 'octane'
import { createRootRoute, createRoute, createRouter, RouterProvider } from '@octanejs/tanstack-router'
import { api } from '../convex/_generated/api'
import { convex } from './lib/convex'
import { warmProductImages } from './lib/product/gallery'
import App from './App.btsx'
import CategoryPage from './pages/CategoryPage.btsx'
import CategoryPending from './pages/CategoryPending.btsx'
import HomePage from './pages/HomePage.btsx'
import ProductPage from './pages/ProductPage.btsx'
import ProductPending from './pages/ProductPending.btsx'
import { createConsoleFallbackRoutes, selectConsoleRouteTree } from './lib/consoles/route-trees'
import './style.css'

const container = document.getElementById('app')
if (container === null) throw new Error('Missing #app container.')

function loadProducts(categorySlug: string) {
  return convex.query(api.products.listByCategory, { categorySlug })
}

// Runs on hover/focus too (defaultPreload: 'intent'), so by click time both the data and the
// gallery images are usually already in memory and the page paints complete on first frame.
// Only a preload waits for the main image; a direct click renders at once over the cached
// card-size placeholder while the sharp images stream in.
async function loadProduct(categorySlug: string, sku: string, preload: boolean) {
  const result = await convex.query(api.products.getBySku, { categorySlug, sku })
  if (result) {
    const warming = warmProductImages(result.product.media)
    if (preload) await warming
  }
  return result
}

function createStorefrontRouteTree() {
  const rootRoute = createRootRoute({ component: App })
  const homeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: HomePage,
  })

  const categoryRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/$slug',
    loader: ({ params }) => loadProducts(params.slug),
    component: CategoryPage,
    pendingComponent: CategoryPending,
  })

  const productRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/$slug/$sku',
    loader: ({ params, preload }) => loadProduct(params.slug, params.sku, preload),
    component: ProductPage,
    pendingComponent: ProductPending,
  })

  return rootRoute.addChildren([
    homeRoute,
    categoryRoute,
    productRoute,
    ...createConsoleFallbackRoutes(rootRoute),
  ])
}

const router = createRouter({
  routeTree: selectConsoleRouteTree() ?? createStorefrontRouteTree(),
  // New navigations (e.g. opening a product) start at the top; Back/Forward restore the old position.
  scrollRestoration: true,
  // Start loading a category on hover/focus so the round trip is mostly done by click time.
  defaultPreload: 'intent',
  // Reuse loaded categories for a minute instead of refetching on every visit.
  defaultStaleTime: 60_000,
  defaultPreloadStaleTime: 60_000,
  // Show the skeleton quickly if data isn't ready, and keep it long enough to avoid a flash.
  defaultPendingMs: 150,
  defaultPendingMinMs: 300,
})

createRoot(container).render(RouterProvider, { router })
