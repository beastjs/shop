import { createRoot } from 'octane'
import { createRootRoute, createRouter, RouterProvider } from '@octanejs/tanstack-router'
import App from './App.btsx'
import './style.css'

const container = document.getElementById('app')
if (container === null) throw new Error('Missing #app container.')

const rootRoute = createRootRoute({ component: App })
const router = createRouter({ routeTree: rootRoute })

createRoot(container).render(RouterProvider, { router })
