import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import { Effect } from 'effect'

type MockResponse = {
  status?: number
  body: unknown
}

let respond: (url: URL, init?: RequestInit) => MockResponse

const originalFetch = globalThis.fetch
const originalBaseUrl = process.env.PUBLIC_UNSPLASH_API_BASE_URL

process.env.PUBLIC_UNSPLASH_API_BASE_URL = 'https://shop.test/api/unsplash'
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const requestUrl = input instanceof Request ? input.url : String(input)
  const response = respond(new URL(requestUrl), init)
  return new Response(JSON.stringify(response.body), {
    status: response.status ?? 200,
    headers: { 'Content-Type': 'application/json' }
  })
}) as typeof fetch

const unsplashApi = await import('../src/lib/unsplash/index.ts')

afterAll(() => {
  globalThis.fetch = originalFetch
  if (originalBaseUrl === undefined) delete process.env.PUBLIC_UNSPLASH_API_BASE_URL
  else process.env.PUBLIC_UNSPLASH_API_BASE_URL = originalBaseUrl
})

beforeEach(() => {
  respond = () => ({ body: {} })
})

describe('Unsplash Effect API', () => {
  it('searches photos and trims/validates the query before making the request', async () => {
    let requestedUrl: URL | undefined
    respond = (url) => {
      requestedUrl = url
      return {
        body: {
          total: 1,
          total_pages: 1,
          results: [{ id: 'photo-1', urls: { regular: 'https://images.unsplash.com/photo-1' } }]
        }
      }
    }

    const photos = await Effect.runPromise(unsplashApi.searchPhotos({ query: '  cotton  ', perPage: 2 }))

    expect(photos).toHaveLength(1)
    expect(requestedUrl?.pathname).toBe('/api/unsplash/search/photos')
    expect(requestedUrl?.searchParams.get('query')).toBe('cotton')
    expect(requestedUrl?.searchParams.get('per_page')).toBe('2')
  })

  it('fails invalid search options in the Effect error channel without making a request', async () => {
    let requestCount = 0
    respond = () => {
      requestCount += 1
      return { body: { results: [] } }
    }

    const error = await Effect.runPromiseExit(unsplashApi.searchPhotos({ query: '   ' }))

    expect(error._tag).toBe('Failure')
    expect(requestCount).toBe(0)
    if (error._tag === 'Failure') {
      expect(error.cause.reasons[0]?._tag).toBe('Fail')
      expect(String(error.cause.reasons[0])).toContain('UnsplashApiError')
    }
  })

  it('maps API failures to a tagged error with status and details', async () => {
    respond = () => ({ status: 429, body: { errors: ['Rate Limit Exceeded'] } })

    const error = await Effect.runPromiseExit(unsplashApi.getPhoto('photo-1'))

    expect(error._tag).toBe('Failure')
    if (error._tag === 'Failure') {
      const failure = error.cause.reasons[0]
      expect(failure?._tag).toBe('Fail')
      if (failure?._tag === 'Fail') {
        expect(failure.error).toMatchObject({
          _tag: 'UnsplashApiError',
          status: 429,
          errors: ['Rate Limit Exceeded']
        })
      }
    }
  })

  it('validates list pagination and tracks download actions', async () => {
    const paths: string[] = []
    respond = (url) => {
      paths.push(url.pathname)
      return { body: url.pathname.endsWith('/photos') ? [] : { url: 'https://images.unsplash.com/photo-1' } }
    }

    const invalidList = await Effect.runPromiseExit(unsplashApi.listPhotos({ perPage: 31 }))
    expect(invalidList._tag).toBe('Failure')
    expect(paths).toHaveLength(0)

    await Effect.runPromise(unsplashApi.trackPhotoDownload('photo-1'))
    expect(paths).toEqual(['/api/unsplash/photos/photo-1/download'])
  })

  it('creates photographer and Unsplash attribution links with referral parameters', () => {
    const attribution = unsplashApi.getPhotoAttribution({
      user: { name: 'Photographer', links: { html: 'https://unsplash.com/@photographer' } }
    } as Parameters<typeof unsplashApi.getPhotoAttribution>[0])

    expect(attribution.photographerName).toBe('Photographer')
    expect(attribution.photographerUrl).toContain('utm_source=shop')
    expect(attribution.photographerUrl).toContain('utm_medium=referral')
    expect(attribution.unsplashUrl).toBe('https://unsplash.com/?utm_source=shop&utm_medium=referral')
  })
})
