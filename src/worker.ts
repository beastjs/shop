import { dispatchConsoleRequest, type ConsoleWorkerEnv } from './server/console-routes'

type AssetsBinding = {
  fetch(request: Request): Promise<Response>
}

type WorkerEnv = ConsoleWorkerEnv & {
  ASSETS: AssetsBinding
  UNSPLASH_ACCESS_KEY?: string
}

const UNSPLASH_PREFIX = '/api/unsplash'
const UNSPLASH_ORIGIN = 'https://api.unsplash.com'

function isUnsplashRequest(pathname: string): boolean {
  return pathname === UNSPLASH_PREFIX || pathname.startsWith(`${UNSPLASH_PREFIX}/`)
}

async function proxyUnsplash(request: Request, accessKey: string | undefined): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed.', {
      status: 405,
      headers: { allow: 'GET, HEAD' }
    })
  }

  if (!accessKey) {
    return Response.json({ error: 'Unsplash is not configured.' }, { status: 503 })
  }

  const requestUrl = new URL(request.url)
  const suffix = requestUrl.pathname.slice(UNSPLASH_PREFIX.length).replace(/^\/+/, '')
  const upstreamUrl = new URL(suffix, UNSPLASH_ORIGIN)
  upstreamUrl.search = requestUrl.search

  const headers = new Headers()
  const accept = request.headers.get('accept')
  if (accept) headers.set('accept', accept)
  headers.set('authorization', `Client-ID ${accessKey}`)
  headers.set('accept-version', 'v1')

  try {
    return await fetch(new Request(upstreamUrl, { method: request.method, headers, signal: request.signal }))
  } catch {
    return Response.json({ error: 'Unsplash is unavailable.' }, { status: 502 })
  }
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const consoleResponse = await dispatchConsoleRequest(request)
    if (consoleResponse) return consoleResponse

    const { pathname } = new URL(request.url)
    if (isUnsplashRequest(pathname)) return await proxyUnsplash(request, env.UNSPLASH_ACCESS_KEY)

    if (pathname.startsWith('/api/')) {
      return Response.json({ error: 'Not found.' }, { status: 404 })
    }

    return await env.ASSETS.fetch(request)
  }
}
