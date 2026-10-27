import { createApi, type AssetBasic, type AssetFull } from 'unsplash-js'
import { Effect, Schema } from 'effect'

/**
 * The browser talks to our application proxy. The proxy must forward the
 * `/api/unsplash/*` paths to `https://api.unsplash.com/*` and add the private
 * Unsplash access key server-side.
 */
const apiBaseUrl = process.env.PUBLIC_UNSPLASH_API_BASE_URL || '/api/unsplash'

export const unsplash = createApi({ baseUrl: apiBaseUrl })

export type PhotoOrientation = 'landscape' | 'portrait' | 'squarish'
export type PhotoOrder = 'latest' | 'relevant'

export interface SearchPhotosOptions {
  query: string
  page?: number
  perPage?: number
  orientation?: PhotoOrientation
  color?: string
  orderBy?: PhotoOrder
}

export interface ListPhotosOptions {
  page?: number
  perPage?: number
}

export class UnsplashApiError extends Schema.TaggedError<UnsplashApiError>()('UnsplashApiError', {
  message: Schema.String,
  status: Schema.optionalKey(Schema.Int),
  errors: Schema.Array(Schema.String)
}) {}

const SearchPhotosOptionsSchema = Schema.Struct({
  query: Schema.Trim.pipe(Schema.check(Schema.isMinLength(1))),
  page: Schema.optionalKey(Schema.Int.check(Schema.isGreaterThan(0))),
  perPage: Schema.optionalKey(Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 30 }))),
  orientation: Schema.optionalKey(Schema.Literals(['landscape', 'portrait', 'squarish'])),
  color: Schema.optionalKey(Schema.String),
  orderBy: Schema.optionalKey(Schema.Literals(['latest', 'relevant']))
})

const ListPhotosOptionsSchema = Schema.Struct({
  page: Schema.optionalKey(Schema.Int.check(Schema.isGreaterThan(0))),
  perPage: Schema.optionalKey(Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 30 })))
})

function toUnsplashError(error: unknown): UnsplashApiError {
  if (error instanceof UnsplashApiError) return error
  return new UnsplashApiError({
    message: error instanceof Error ? error.message : 'Unsplash request failed',
    errors: []
  })
}

function request<A>(run: (signal: AbortSignal) => Promise<A>): Effect.Effect<A, UnsplashApiError> {
  return Effect.tryPromise({ try: run, catch: toUnsplashError })
}

function decodeOptions<S extends Schema.ConstraintDecoder<unknown>>(
  schema: S,
  input: unknown
): Effect.Effect<S['Type'], UnsplashApiError> {
  return Schema.decodeUnknownEffect(schema)(input).pipe(
    Effect.mapError((error) => new UnsplashApiError({ message: error.message, errors: [] }))
  )
}

/** Search Unsplash photos. Returned image URLs should be used directly. */
export function searchPhotos(
  options: SearchPhotosOptions
): Effect.Effect<AssetBasic[], UnsplashApiError> {
  return decodeOptions(SearchPhotosOptionsSchema, options).pipe(
    Effect.flatMap(({ query, page = 1, perPage = 10, orientation, color, orderBy = 'relevant' }) =>
      request(async (signal) => {
        const result = await unsplash.GET('/search/photos', {
          params: {
            query: {
              query,
              page,
              per_page: perPage,
              orientation,
              color,
              order_by: orderBy
            }
          },
          signal
        })

        if (result.error) {
          throw new UnsplashApiError({
            message: result.error.errors.join(', '),
            status: result.response.status,
            errors: result.error.errors
          })
        }
        return result.data.results
      })
    )
  )
}

/** Fetch a photo by its Unsplash ID or slug. */
export function getPhoto(photoId: string): Effect.Effect<AssetFull, UnsplashApiError> {
  return request(async (signal) => {
    const result = await unsplash.GET('/photos/{assetSlug}', {
      params: { path: { assetSlug: photoId } },
      signal
    })

    if (result.error) {
      throw new UnsplashApiError({
        message: result.error.errors.join(', '),
        status: result.response.status,
        errors: result.error.errors
      })
    }
    return result.data
  })
}

/** List the latest public photos. */
export function listPhotos(
  options: ListPhotosOptions = {}
): Effect.Effect<AssetBasic[], UnsplashApiError> {
  return decodeOptions(ListPhotosOptionsSchema, options).pipe(
    Effect.flatMap(({ page = 1, perPage = 10 }) =>
      request(async (signal) => {
        const result = await unsplash.GET('/photos', {
          params: { query: { page, per_page: perPage } },
          signal
        })

        if (result.error) {
          throw new UnsplashApiError({
            message: result.error.errors.join(', '),
            status: result.response.status,
            errors: result.error.errors
          })
        }
        return result.data
      })
    )
  )
}

/** Track a user action that is equivalent to downloading/selecting a photo. */
export function trackPhotoDownload(photoId: string): Effect.Effect<void, UnsplashApiError> {
  return request(async (signal) => {
    const result = await unsplash.GET('/photos/{id}/download', {
      params: { path: { id: photoId } },
      signal
    })

    if (result.error) {
      throw new UnsplashApiError({
        message: result.error.errors.join(', '),
        status: result.response.status,
        errors: result.error.errors
      })
    }
  })
}

const attributionParams = new URLSearchParams({
  utm_source: 'shop',
  utm_medium: 'referral'
})

/** Build the required Unsplash photographer attribution links. */
export function getPhotoAttribution(photo: Pick<AssetBasic, 'user'>) {
  const profileUrl = new URL(photo.user.links.html)
  attributionParams.forEach((value, key) => profileUrl.searchParams.set(key, value))

  return {
    photographerName: photo.user.name,
    photographerUrl: profileUrl.toString(),
    unsplashUrl: `https://unsplash.com/?${attributionParams.toString()}`
  }
}
