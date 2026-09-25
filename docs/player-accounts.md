# Player accounts

Open **Sign in** in the header to register or sign in. Accounts use a username,
player name, and a 15–128 character passphrase. No email service is required.
Registration displays a recovery code once; save or download it. Password recovery
uses that code, rotates it, and invalidates all earlier sessions.

The profile contains:

- **Saved decks:** create, name, edit, remove, and use up to 30 decks. The builder
  starts with a complete starter deck. Validation enforces 40–50 cards, all 15
  hero cards, one aspect plus basic cards, and individual copy limits. Mission
  setup loads the actual card list for the selected hero seat. Replay retains it.
- **Continue playing:** up to five separate unfinished missions. Automatic saves
  preserve pending opening hands, prompts, payments, and action reviews. Reload,
  sign in, and select Resume to open a saved mission. Starting another mission
  does not remove an earlier account save.
- **Mission history:** the latest 100 completed missions, including hero team,
  villain, difficulty, round, result, and date. Win rate uses these retained results.
  Completed results do not retain a playable snapshot. This is personal game
  history, not a server-authoritative competitive leaderboard.

Guest play remains available. Its browser save is never automatically uploaded to
an account. **Save guest mission** explicitly imports an unfinished guest game.
Account saves are not written into the guest localStorage slot. Logout clears the
open account mission from the UI. Authentication changes propagate between tabs.

## Local development

Run `npm run dev` using Node 22.13 or later. Vite serves `/api/account` alongside
the UI, with SQLite storage at `.accounts/accounts.sqlite`. The directory is
private to the OS user, excluded from Git, and denied by Vite's file server.
`ACCOUNTS_DB_PATH` can override the local database location; keep it in `.accounts/`
so the file server deny rule applies. Local accounts are separate from live accounts.

The Vite static preview command previews the frontend only; use the development
server or Vercel for account API verification.

## Vercel production setup

The server function is `api/account.ts`. Production never falls back to filesystem
or in-memory account storage. Until a durable database is connected, the account
page explains that accounts are unavailable; guest play continues to work.

1. Connect an Upstash Redis database to this Vercel project.
2. Configure server-only `UPSTASH_REDIS_REST_URL` and
   `UPSTASH_REDIS_REST_TOKEN` in the intended deployment environment. Vercel's
   `KV_REST_API_URL` and `KV_REST_API_TOKEN` names are supported as aliases.
3. Optionally set `ACCOUNTS_ORIGIN` to the exact public origin. Otherwise the
   request host supplies the same-origin check, allowing Vercel preview URLs.
4. Redeploy, then verify registration, logout/login, deck save, mission resume,
   and completed history against that deployment. Production storage has not
   been provisioned by this change.

Never prefix storage credentials with `VITE_`, commit them, or send them to the
browser. Redis keys use the `marvel-champions:accounts:v1:` namespace. Preview and
production should use separate databases or environment-scoped credentials.
Back up the account database; there is no automatic migration from local accounts.

## Security and concurrency

Passwords use asynchronous Node scrypt (N=32768, r=8, p=3) with random per-user
salts. Recovery codes and random session tokens are stored only as SHA-256 hashes.
Sessions expire after 14 days and use HttpOnly, SameSite=Strict cookies with Secure
in Vercel. Logout revokes the current session; recovery invalidates all sessions.
Responses have no-store headers, and mutations require the matching origin,
JSON content type, and custom request header. Login/registration/recovery attempts
are rate-limited in the shared store, and private mutations verify the session
account instead of accepting a client-specified owner.

Account writes use atomic compare-and-swap operations (SQLite or Redis Lua).
Per-item revisions reject stale deck/mission updates rather than overwriting a
newer save from another device. Unrelated concurrent changes are merged through
bounded retries. API input has size limits, deck legality checks, and structural
snapshot validation. A failed autosave leaves the table open with a visible Retry
save action. The browser warns before leaving with unsaved changes. Starting a
new mission or signing out first flushes pending saves.

Implementation references: [Node crypto](https://nodejs.org/api/crypto.html),
[Node SQLite](https://nodejs.org/api/sqlite.html),
[Upstash REST API](https://upstash.com/docs/redis/features/restapi),
[Vercel Node functions](https://vercel.com/docs/functions/runtimes/node-js).

## Verification

`npm test` includes account isolation, session revocation, password recovery,
origin checks, rate limiting, deck validation, custom deck use, pending-save
round trips, result deduplication, save limits, and revision conflicts.

For browser verification use a separate test database and local port:

```sh
ACCOUNTS_DB_PATH=.accounts/browser-check.sqlite npm run dev -- --host 127.0.0.1 --port 5186
npm run test:accounts
```

The browser test creates a disposable local account, builds and uses a 41-card
deck, reloads/resumes an opening hand, finishes a near-victory fixture using a real
engine attack, checks history and re-login, and audits account screens at desktop,
390px, and 320px. Screenshots and the report are written to `output/accounts/`.
It does not claim an entire mission was played from its original setup.
