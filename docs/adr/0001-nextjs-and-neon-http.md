# Next.js with Neon over HTTP, local only, no login

The app runs only on my two computers via `npm run dev` and syncs progress through Neon Postgres. We chose Next.js (App Router) so the UI and a small server API run as one process and the Neon connection string never reaches the browser. Drizzle talks to Neon through its **HTTP driver**, because it uses HTTPS on port 443, which a locked-down work network is far more likely to allow than Postgres's port 5432. There is no login: one profile row with a fixed UUID.

## Considered Options

- **Vite + React + a Hono API server**: lighter, but two processes and hand-rolled routing. Rejected.
- **Plain Postgres driver over TCP (`postgres-js`)**: would let CI spin up a throwaway Postgres container, but port 5432 is often blocked on corporate networks. Rejected in favour of the HTTP driver.

## Consequences

- The database code works only against Neon, so CI cannot run database tests. CI runs lint, typecheck, Vitest on pure functions and `content:check`. Playwright runs locally against a separate Neon `dev` branch, and no database secret lives in GitHub.
- Adding a second user later means adding auth; the schema already carries `user_id` everywhere.
