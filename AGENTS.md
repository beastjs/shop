## Vendored Repositories

This project vendors external repositories under @repos/

- Use vendored repositories as read-only reference material when working with related libraries
- Prefer examples and patterns from the vendored source code over generated guesses or web search results
- Do not edit files under @repos/ unless explicitly asked
- Never import from the vendored repository in application code, including through aliases such as `@/repos/effect`; use the installed package dependency (`effect`) instead
- Keep application tests under `tests/` and scope test commands to that directory; never discover or run tests from the vendored `repos/effect` checkout
- Treat vendored Effect source as agent-only reference; do not direct the user to include it with an `@` mention

When writing Effect code, inspect @repos/effect/ for examples of idiomatic usage, tests, module structure, and API design. Treat it as the source of truth for Effect patterns.

Review the implementation, tests, and documentation for `Schema` in `@repos/effect`.

Create a file at `agent-patterns/effect-schema.md` that illustrates the most important patterns an agent should follow when writing Schema code in this project.

Include:

- Common constructors and combinators
- Encoding and decoding examples
- Transformation patterns
- Error handling patterns
- Examples copied or adapted from the Effect codebase
- Notes about what to avoid

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
