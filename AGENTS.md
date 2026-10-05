# Open Shuttle agent guidance

The public API and site are read-only. Ingestion is the only writer. Preserve source URLs, external player IDs, and tournament UUIDs so every record can be traced and repeat imports remain idempotent. Never fabricate a result when a source is unavailable.

Discover events through the public Badminton Australia tournament search in `src/server/ingest/listing.ts`. It submits the site's search form, paginates using response headers, and defaults to the past year of Queensland events plus 90 days ahead. The independent `brisbane-postcode` source submits the public www search with postcode 4000, distance 50, country AUS and sport 2, without a name keyword; it uses the same rolling window and pagination. The additional Gen Core organizer source in `organizer-listing.ts` discovers its complete cross-state archive without the Queensland search window. Preserve listing provenance; report page limits and failed parsing through source status. Run the opt-in `LIVE_DISCOVERY_TEST=1` smoke test after adapter changes.

Use the current public badminton Tournamentsoftware pages under `badminton.tournamentsoftware.com` for results. Resolve the home-page redirect first: Australian events live on `ba.tournamentsoftware.com` and deep paths are lost when using the generic host. The `www` host may return a consent wall. Keep result parsing in `src/server/ingest/tournamentsoftware.ts`, validate changes with parser fixtures and the opt-in live smoke test, and record errors in the ingestion run and source/tournament rows.

Facebook discovery uses the Graph API. It needs a token and Page access permissions; do not attempt to bypass login, rate limits, or access controls. If Page discovery is unavailable, use the manual tournament URL endpoint and report the permission error through the status API.

For schema edits, run `pnpm db:generate` and commit the generated migration with the schema. Apply migrations to a development Neon branch before production. Do not use `db:push` on a shared or production database. Check `pnpm typecheck`, `pnpm test`, `pnpm check`, and `pnpm build` after changes.

Do not put `DATABASE_URL`, `CRON_SECRET`, `INGEST_API_KEY`, Facebook tokens, or Neon Auth secrets in source, fixtures, logs, or client components. The public API intentionally does not expose raw Facebook post text.
