# Octane signals & Hydrate — findings for this app (octane 0.16, client-only `createRoot`)

Verified by spike while building the cart (2026-10-27).

## Explicit scopes work as app stores
- `createScope({ scopeKey })` + `scope.signal$(key, initial)` / `scope.derived$(key, compute)` work at module scope, outside any component.
- Write with `signal$.set(v | fn)` or `scope.set(handle, …)`; read with `handle.get()` / `scope.get(handle)`.
- `scope.serialize()` returns a `ScopeSeed`; it can be passed back as `createScope({ seed })`. It's kept for future SSR; persist domain data with Effect Schema instead.

## Reading signals in `.btsx`
- Templates read handles natively and update reactively: `span #{count$}` and `span #{count$.get()}` both re-render on writes.
- `setup` code that needs a plain value outside the template can use `useSyncExternalStore((cb) => handle[SIGNAL_BINDING_SUBSCRIBE](cb), () => handle.get())` (`SIGNAL_BINDING_SUBSCRIBE` is exported from `octane/signals`).

## `optimistic$` / `action$`
- Module-level `optimistic$` / `action$` throw "A module signal needs an active signal owner" outside a render owner, and owners don't carry across `await`.
- For store-style state (the cart), keep optimistic/reconcile logic in the Effect service and write results into explicit-scope signals.

## `Hydrate` under client-only `createRoot`
- `Hydrate(when=… prefetch=…)` compiles its child into a separate chunk (`*_octane-hydrate_N.js`), but with no server HTML it mounts immediately; `when`/`prefetch` gates only apply when hydrating SSR markup.
- Use it as a code-split boundary today, and gate expensive UI with your own state (e.g. render the drawer body only while open).
