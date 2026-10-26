# Effect Schema patterns

Use Effect `Schema` as the source of truth for both runtime validation and TypeScript types. Define schemas at module scope, decode untrusted input at system boundaries, and pass decoded domain values through the application.

Examples below follow the Effect v4 API in `repos/effect/packages/effect/src/Schema.ts`. They are adapted from `SCHEMA.md`, `ai-docs/src/01_effect/02_schema/10_schema-basics.ts`, and `test/schema/Schema.test.ts` in the vendored Effect repository. Application code should import the published `effect` package, never from `repos/effect`.

## Common constructors and combinators

```ts
import { Schema } from "effect"

export const UserId = Schema.String.pipe(Schema.brand("UserId"))

export const User = Schema.Struct({
  id: UserId,
  name: Schema.NonEmptyString,
  role: Schema.Literals(["admin", "member"]),
  // optionalKey means the property may be absent
  nickname: Schema.optionalKey(Schema.String)
})

export const UserList = Schema.Array(User)
export const ScoresByName = Schema.Record(Schema.String, Schema.Finite)
export const Status = Schema.Union([
  Schema.Literal("pending"),
  Schema.Literal("complete")
])

export type User = typeof User.Type
export type UserInput = typeof User.Encoded
```

Use `Schema.Struct` for object shapes, `Schema.Array` for homogeneous arrays, `Schema.Tuple` for positional values, `Schema.Record` for dynamic keys, and `Schema.Union` / `Schema.Literals` for alternatives. Add constraints with `.check`, for example `Schema.Number.check(Schema.isGreaterThan(0))` or `Schema.String.check(Schema.isMinLength(3))`.

`Schema.optionalKey(S)` makes an object key optional. `Schema.optional(S)` makes `undefined` part of a value schema; it does not make a `Struct` key optional. Use `Schema.NullOr(S)` when `null` is part of the data format.

For nominal distinctions, `Schema.brand("UserId")` changes the TypeScript type but does not add runtime validation. Pair it with a check if the value needs runtime constraints.

## Decoding and encoding

`Type` is the decoded/domain representation; `Encoded` is the representation accepted by the schema at the boundary. Prefer the effect-returning APIs inside Effect programs so validation errors stay in the typed error channel.

```ts
import { Effect, Schema } from "effect"

export class User extends Schema.Class<User>("app/User")({
  id: Schema.String,
  name: Schema.NonEmptyString,
  role: Schema.Literals(["admin", "member"])
}) {}

export const decodeUser = Schema.decodeUnknownEffect(User)
export const encodeUser = Schema.encodeEffect(User)

export const loadUser = (payload: unknown) =>
  decodeUser(payload).pipe(
    Effect.flatMap((user) => encodeUser(user))
  )
```

Use `decodeUnknownEffect` when the input is `unknown`, and `decodeEffect` when it is already typed as the schema's `Encoded` representation. Use the matching `encodeEffect` / `encodeUnknownEffect` direction to serialize a decoded value. For synchronous boundaries, use `decodeUnknownSync` when throwing `SchemaError` on invalid input is appropriate, or `decodeUnknownExit` when the caller needs an explicit `Exit`. `decodeUnknownSync` returns the decoded value on success and throws on schema failure. Reuse module-level schemas and parser functions instead of rebuilding them for each request.

## Transformations

Prefer built-in transformation schemas for common representation changes. They keep the source and destination types explicit and preserve the reverse encoding direction where supported.

```ts
import { Schema } from "effect"

export const Port = Schema.FiniteFromString
export const CreatedAt = Schema.DateFromString

// Encoded: string; Type: number
const port: typeof Port.Type = Schema.decodeUnknownSync(Port)("8080")
// Encodes back to the string representation
const encoded: typeof Port.Encoded = Schema.encodeSync(Port)(port)
```

For a custom conversion, compose schemas with `Schema.decodeTo` and an explicit transformation rather than parsing by hand. The Effect tests demonstrate trimming then decoding a finite number:

```ts
import { Schema, SchemaTransformation } from "effect"

const TrimmedFinite = Schema.Trim.pipe(
  Schema.decodeTo(
    Schema.FiniteFromString,
    SchemaTransformation.passthrough()
  )
)
```

The decoded value is a number and the encoded representation is a string. Test both directions whenever a schema transforms data: a decoder that works does not by itself prove the value can be encoded back correctly.

## Error handling

Schema decoding reports structured `SchemaError` failures. Keep those failures in the Effect error channel, then map them to an application error only where the application needs a different public error type.

```ts
import { Effect, Schema } from "effect"

export class InvalidUserPayload extends Schema.TaggedError<InvalidUserPayload>()(
  "InvalidUserPayload",
  { message: Schema.String }
) {}

export const parseUserPayload = (input: unknown) =>
  Schema.decodeUnknownEffect(User)(input).pipe(
    Effect.mapError((error) =>
      new InvalidUserPayload({ message: error.message })
    )
  )
```

Use `decodeUnknownResult` or `decodeUnknownExit` when a synchronous caller needs an explicit success/failure value. Avoid swallowing parse failures or replacing them with unchecked casts. Error messages include paths into nested input; preserve them when translating errors if they help callers fix invalid data.

## What to avoid

- Do not validate untrusted data with ad hoc predicates, assertions, or manual parsing when a Schema can describe the input and transformation.
- Do not use `Schema.optional` to make an object property optional; use `Schema.optionalKey` in a struct.
- Do not confuse `Type` with `Encoded`, especially for dates, branded values, and string-to-number transformations.
- Do not assume synchronous decoding cannot fail: `decodeUnknownSync` throws `SchemaError`; use `decodeUnknownExit` or `decodeUnknownResult` to represent failure as a value.
- Do not put side effects in `.check` predicates. Checks should be deterministic validations, not application workflows.
- Do not import implementation details from the vendored `repos/effect` tree. It is reference material; app code imports from `effect`.
- Do not assume a transformation is reversible without checking its encoding semantics and testing both directions.
