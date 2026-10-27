import { createRoot } from 'octane'
import { createRootRoute, createRoute, createRouter, RouterProvider } from '@octanejs/tanstack-router'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../convex/_generated/api'
import App from './App.btsx'
import CategoryPage from './pages/CategoryPage.btsx'
import HomePage from './pages/HomePage.btsx'
import './style.css'

const container = document.getElementById('app')
if (container === null) throw new Error('Missing #app container.')
const convexUrl = process.env.PUBLIC_CONVEX_URL
if (!convexUrl) throw new Error('Missing CONVEX_URL. Set it in .env.local before starting the storefront.')

const convex = new ConvexHttpClient(convexUrl)

function loadProducts(categorySlug: string) {
  return convex.query(api.products.listByCategory, { categorySlug })
}

const rootRoute = createRootRoute({ component: App })
const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
})

const categoryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/$slug",
  loader: ({ params }) => loadProducts(params.slug),
  component: CategoryPage,
})

const router = createRouter({ routeTree: rootRoute.addChildren([homeRoute, categoryRoute]) })

createRoot(container).render(RouterProvider, { router })
