# Effect Schema patterns

This project uses Effect **4.0.6**. Import Schema APIs from the installed
package with `import { Schema } from "effect"`. The examples below are adapted
from the vendored Effect guide and tests. That checkout is reference material
only; never import from it in application code.

## Start with the boundary

A schema describes both the value used by the application (`Type`) and the
serialized/input value (`Encoded`). They are the same for a plain
`Schema.Struct`, but can differ when a field transforms, such as a number
encoded as a string.

```ts
import { Schema } from "effect"

const AccountSchema = Schema.Struct({
  slug: Schema.NonEmptyString,
  seats: Schema.FiniteFromString,
  status: Schema.Literals(["active", "suspended"])
})

type Account = typeof AccountSchema.Type
type AccountInput = typeof AccountSchema.Encoded
// Account.seats is number; AccountInput.seats is string.
```

Keep the schema as the source of both the runtime check and the TypeScript
types. Use `typeof MySchema.Type` or `typeof MySchema.Encoded` instead of
duplicating those shapes by hand.

## Constructors and combinators

- **Primitives:** `Schema.String`, `Schema.Number`, `Schema.Finite`,
  `Schema.Boolean`, `Schema.BigInt`, `Schema.Date`, `Schema.Null`, and
  `Schema.Unknown`.
- **Exact values:** `Schema.Literal("ready")` for one value and
  `Schema.Literals(["ready", "closed"])` for a set of values.
- **Objects:** `Schema.Struct({ ... })` for named fields. A field is required
  unless marked optional.
- **Optional fields:** In a struct, `Schema.optionalKey(S)` allows the
  property to be absent, but does not add `undefined` to the value type.
  `Schema.optional(S)` also allows absence and adds `undefined` to the value
  type. Add `Schema.NullOr(S)` when `null` is valid too.
- **Collections:** `Schema.Array(S)`, `Schema.NonEmptyArray(S)`,
  `Schema.Tuple([A, B])`, and `Schema.Record(keySchema, valueSchema)`.
- **Alternatives:** `Schema.Union([A, B])` accepts a value matching a member;
  prefer `Schema.TaggedUnion({ Created: { ... }, Deleted: { ... } })` for
  discriminated messages.
- **Refinements:** `.check(...)` adds synchronous checks without changing the
  schema's type. Prefer the built-in checks such as `Schema.isMinLength(3)`,
  `Schema.isUUID()`, `Schema.isInt()`, and `Schema.isGreaterThan(0)`.
- **Nominal IDs:** `.pipe(Schema.brand("AccountId"))` distinguishes otherwise
  identical TypeScript values. `brand` is type-level only; use a check or
  `Schema.fromBrand` when a runtime condition is also required.

```ts
const CreateAccount = Schema.Struct({
  name: Schema.NonEmptyString,
  handle: Schema.String.check(Schema.isPattern(/^[a-z0-9-]+$/)),
  seats: Schema.Finite.check(Schema.isInt(), Schema.isGreaterThan(0)),
  website: Schema.optionalKey(Schema.String)
})
```

Use `Schema.Finite` when `NaN` and infinities are invalid. `Schema.Number`
allows them. If the wire format is text, use `Schema.FiniteFromString` rather
than parsing and validating the number manually.

## Decode and encode

Treat data from HTTP, storage, environment variables, and other untyped
boundaries as `unknown`. Decode it before using it. The matching encoder
validates an application value and returns the schema's encoded form.

```ts
const input: unknown = {
  slug: "north-star",
  seats: "12",
  status: "active"
}

const account = Schema.decodeUnknownSync(AccountSchema)(input)
// account.seats === 12

const wireValue = Schema.encodeSync(AccountSchema)(account)
// wireValue.seats === "12"
```

Choose the adapter for the boundary:

| Use | API | Failure behavior |
| --- | --- | --- |
| Unknown input, synchronous and service-free | `Schema.decodeUnknownSync(S)(input)` | Throws `Schema.SchemaError` for schema issues |
| Already typed encoded input | `Schema.decodeSync(S)(input)` | Throws on schema issues |
| Unknown input inside an Effect workflow | `Schema.decodeUnknownEffect(S)(input)` | Fails with `Schema.SchemaError`; supports async work and services |
| Unknown input where a `Result` is convenient | `Schema.decodeUnknownResult(S)(input)` | Returns `Result` with a `Schema.SchemaError` failure |
| Unknown input where only success/failure matters | `Schema.decodeUnknownOption(S)(input)` | Returns `None` for schema issues; details are lost |

The corresponding encoding functions are `encodeUnknownSync`, `encodeSync`,
`encodeUnknownEffect`, `encodeUnknownResult`, and `encodeUnknownOption`.
Use the `Unknown` version when the value is not statically known to match the
schema's encoded or decoded type.

## Transformations

Use the built-in transformation schemas when one exists. For example,
`Schema.FiniteFromString` decodes finite numeric text to a number and encodes
the number back to text. `Schema.NumberFromString` intentionally accepts
`NaN` and infinities, so it is not a substitute when finiteness matters.

For same-type normalization, use `Schema.decode` with a reusable
`SchemaTransformation`:

```ts
import { Schema, SchemaTransformation } from "effect"

const TrimmedName = Schema.String.pipe(
  Schema.decode(SchemaTransformation.trim())
)

Schema.decodeUnknownSync(TrimmedName)("  Ada  ") // "Ada"
```

Use `Schema.decodeTo` when the decoded type differs from the encoded type. A
custom transformation defines both directions; `decode` maps source values to
the target's encoded form, and `encode` maps target values back to the source.

```ts
const MetersFromCentimeters = Schema.Finite.pipe(
  Schema.decodeTo(
    Schema.Finite,
    SchemaTransformation.transform({
      decode: (centimeters) => centimeters / 100,
      encode: (meters) => meters * 100
    })
  )
)

Schema.decodeSync(MetersFromCentimeters)(250) // 2.5
Schema.encodeSync(MetersFromCentimeters)(2.5) // 250
```

For a transformation that can fail or needs asynchronous work, use
`SchemaTransformation.transformEffect` or a `SchemaGetter` effectful getter,
and call an Effect or Promise decoder. Do not put I/O inside `.check(...)`:
checks are synchronous.

## Error handling

For human-readable synchronous validation, narrow thrown values with
`Schema.isSchemaError` and preserve unrelated errors:

```ts
try {
  return Schema.decodeUnknownSync(CreateAccount)(input)
} catch (error) {
  if (Schema.isSchemaError(error)) {
    return { ok: false, message: error.message }
  }
  throw error
}
```

For explicit branching without exceptions, use the `Result` adapter:

```ts
import { Result, Schema } from "effect"

const result = Schema.decodeUnknownResult(CreateAccount)(input)
if (Result.isFailure(result)) {
  console.error(result.failure.message)
} else {
  console.log(result.success.name)
}
```

In Effect code, keep schema failures in the typed error channel:

```ts
import { Effect, Schema } from "effect"

const program = Schema.decodeUnknownEffect(CreateAccount)(input).pipe(
  Effect.map((account) => account.name)
)
```

Use `{ errors: "all" }` when a form or API response should report every
independent check failure. The default is focused reporting. Use
`Schema.catchDecoding` only for an intentional recovery rule; it can replace a
bad input with a fallback and can hide corrupt or malicious data. Return
`Option.none()` from a recovery handler only when omitting that value is the
intended behavior.

## Avoid

- Do not use a type assertion or a hand-written predicate as a replacement for
  decoding untrusted input.
- Do not confuse `Type` with `Encoded`; a schema may transform between them.
- Do not use `Schema.Number` when only finite numbers are valid.
- Do not treat `optionalKey`, `optional`, `NullOr`, and `UndefinedOr` as
  interchangeable; each describes a different wire shape.
- Do not use sync adapters when a schema needs services or asynchronous
  transformations; use the Effect or Promise adapter.
- Do not use `decodeUnknownOption` when callers need useful validation errors.
- Do not make checks or transformation functions depend on side effects.
- Do not silently recover from validation failures unless the domain explicitly
  defines that fallback.
- Do not import from `repos/effect` or an alias to it. Application code must use
  the installed `effect` dependency.

## Source references

These examples and guidance follow the vendored Effect 4.0.6 implementation and
tests:

- `repos/effect/packages/effect/src/Schema.ts` — constructors, codecs,
  transformation and error adapters.
- `repos/effect/packages/effect/src/SchemaTransformation.ts` and
  `SchemaGetter.ts` — bidirectional and effectful transformation primitives.
- `repos/effect/packages/effect/test/schema/Schema.test.ts` — decoding,
  encoding, checks, and recovery behavior.
- `repos/effect/packages/effect/test/schema/SchemaTransformation.test.ts` —
  transformation behavior and round trips.
- `repos/effect/packages/effect/SCHEMA.md` — full Schema guide, including
  composites, optional fields, errors, and codecs.
