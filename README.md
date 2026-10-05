# Open Shuttle

Public Queensland badminton results, with a JSON API and an importer that discovers events from Badminton Australia's Tournamentsoftware listing. Facebook is an optional secondary source. The app uses Next.js, Drizzle, Neon Postgres, Neon Auth for optional human administration, and the requested shadcn preset `b1KQNu3siu`.

## What works

- The [example tournament](https://badminton.tournamentsoftware.com/tournament/ADA99113-FA52-47F3-88D0-D4866C344313) is seeded as an import target. The importer reads every match-day page, extracts players, sides, scores, draw, round and venue, and upserts stable IDs. A repeat import updates scores without duplicating matches.
- The public Australian tournament listing is the primary discovery source. It searches Queensland events from the past 365 days through the next 90 days without a Meta token, follows up to five result pages, and records the listing entry as provenance. New tournament registration and provenance are committed together and repeated discovery does not duplicate events.
- The independent `brisbane-postcode` source uses the public open search with no name keyword, postcode `4000`, distance `50`, country `AUS` and badminton sport `2`. It follows pagination and uses the same rolling 365-day history / 90-day future window. The supplied September 2026-January 2027 search is retained as its source link; scheduled searches roll forward rather than staying fixed to those dates. Distance is passed through in the site's units (the English USA interface displays miles).
- The [Gen Core organizer listing](https://www.tournamentsoftware.com/find.aspx?a=7&q=8ddb46c7-5ed8-405b-bed8-df58de71e671) is an additional discovery source. It registers every listed badminton event across states and years, without the Queensland search or date-window restrictions, and retains separate provenance for overlapping events.
- A daily Vercel Cron invokes `/api/cron/ingest` at 13:00 Brisbane time (03:00 UTC). It discovers events, imports two eligible tournaments per run, prioritizes never-attempted events, then refreshes least-recently-attempted events. Future tournaments wait until their start date in Brisbane.
- `/submit` provides a form for local Tournamentsoftware links. It requires an admin key or authorized Neon Auth session and uses the existing import API. It clears the key after each attempt.
- Three optional Facebook Page sources are configured. When a Graph API token is supplied, the adapter scans their latest three pages of posts and attached links.
- Public JSON endpoints and the landing page read the same normalized tables. Each match retains a source page URL. `/api/admin/status` reports ingestion and source failures to an authorized agent.

## Local setup

1. Run `pnpm install` and copy `.env.example` to `.env`.
2. Create your own Neon project and set `DATABASE_URL` (pooled) plus `DATABASE_URL_UNPOOLED` (direct). The existing `.env` in this checkout points to localhost and is not a usable Neon connection.
3. Run `pnpm db:migrate`, then `pnpm dev`.
4. Set `INGEST_API_KEY` and import the seed tournament with an authorized request:

```powershell
$headers = @{ Authorization = "Bearer $env:INGEST_API_KEY" }
$body = @{ url = "https://www.tournamentsoftware.com/tournament/ADA99113-FA52-47F3-88D0-D4866C344313" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/admin/import -Headers $headers -ContentType 'application/json' -Body $body
```

The importer starts at `badminton.tournamentsoftware.com` and follows the resolved home-page host before fetching matches. Australian events redirect to `ba.tournamentsoftware.com`; their deep match URLs must use that host. The `www` host served a cookie consent wall during development. HTML selectors are covered by fixtures and optional live smoke tests: `$env:LIVE_IMPORT_TEST='1'; $env:LIVE_DISCOVERY_TEST='1'; pnpm test`.

## Tournament discovery

No Facebook credentials are needed for the primary source. `TOURNAMENT_DISCOVERY_QUERY` defaults to `Queensland` and searches tournament names and organizers, so it is a search term rather than a complete geographic filter. Set another term to change coverage. A page-limit warning is stored on the source and reported in ingestion status if the search is too broad. Disable the `badminton-australia` source through the admin sources endpoint to stop that search. The independent `brisbane-postcode` and `gen-core` sources can also be disabled through the same endpoint. Gen Core's legacy listing is fetched from the public badminton host; both English and Dutch date formats are supported.

An agent can discover events immediately with `POST /api/admin/discover` using the ingestion bearer key. The response's `discovered` count is the number of newly registered events. Scheduled ingestion subsequently imports their results; `POST /api/admin/import` imports a particular URL immediately. Events absent from the Australian listing can be added at `/submit`. Completed calendar entries may still have no published matches; those failures remain visible in status and are retried in rotation.

## Facebook discovery

Set `FACEBOOK_PAGE_ACCESS_TOKEN` to a Meta Graph API token with access to the configured Pages. A Page access token obtained through `/me/accounts` covers a Page you manage; it does not automatically grant access to the other public Pages in this list. To use one token for all three sources, the Meta app needs approved Page Public Content Access. Until then, disable inaccessible sources or import Tournamentsoftware URLs directly. See [Facebook access setup](docs/facebook-access.md) for the steps and a permissions check. The seeded `pageId` values are Page handles; replace them with numeric IDs if your Graph API setup requires them:

```powershell
$headers = @{ Authorization = "Bearer $env:INGEST_API_KEY" }
Invoke-RestMethod -Method Patch -Uri http://localhost:3000/api/admin/sources/queenslandbadminton -Headers $headers -ContentType 'application/json' -Body '{"pageId":"YOUR_NUMERIC_PAGE_ID"}'
```

Repeat for `AGBadminton` and `YSBadmintonTraining`. The importer works with manually supplied tournament URLs even without a Facebook token. Source errors are stored and returned by `/api/admin/status` so an agent can diagnose expired permissions without guessing.

## API

All public reads return JSON, use `data` as the payload key, allow browser reads from any origin, and require no credentials. Player IDs are scoped to a source tournament; matching people by name across tournaments would risk merging distinct players.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/v1/tournaments?limit=30&offset=0` | Paginated tournament list with match/player counts |
| `GET /api/v1/tournaments/{uuid}` | Tournament, discovery provenance, first 100 matches |
| `GET /api/v1/matches?tournamentId={uuid}&limit=30&offset=0` | Paginated matches; `playerId` can filter by player |
| `GET /api/v1/players?q=name&tournamentId={uuid}&limit=30&offset=0` | Paginated player search |
| `GET /api/v1/players/{id}` | Player and first 100 matches |

Admin endpoints accept `Authorization: Bearer $INGEST_API_KEY`, or a Neon Auth session for `ADMIN_EMAIL` when Neon Auth is configured. `POST /api/admin/import` accepts `{ "url": "https://www.tournamentsoftware.com/tournament/UUID" }`, including Australian `/sport/tournament?id=UUID` links. `POST /api/admin/discover` discovers Australian keyword and Brisbane postcode search results plus Gen Core organizer events without importing match data. `GET /api/admin/status` returns source states, tournament failures and recent runs. `PATCH /api/admin/sources/{id}` accepts `pageId` and/or `enabled`.

Managed Neon Auth currently does not expose its API Key plugin for machine identities. The service token above is app-owned and scoped to ingestion endpoints; Neon API keys are for managing Neon infrastructure and must never be used as public app tokens. Neon Auth handles a human admin session through `/api/auth/[...path]` if configured. See [Neon's managed plugin matrix](https://neon.com/docs/auth/guides/plugins) and [Neon API key guidance](https://neon.com/docs/manage/api-keys).

## Deploy to Vercel

Create a Vercel project from this repository. Set the variables in `.env.example` in the project settings. Generate independent random values for `CRON_SECRET` and `INGEST_API_KEY`. Run `pnpm db:migrate` against the intended Neon branch before deployment; migrations are committed in `drizzle/`. Vercel uses `vercel.json` for the daily schedule and supplies the cron bearer header automatically. The app does not create a Neon project or connect to your Vercel account by itself.

## Agent runbook

An agent can call `GET /api/admin/status`, inspect failures, update Page IDs, and submit a newly discovered tournament to `POST /api/admin/import`. For source changes, add an adapter under `src/server/ingest/`, keep source URLs and external IDs, and add a parser fixture. For database changes, generate and commit a Drizzle migration. Run `pnpm typecheck`, `pnpm test`, `pnpm check`, and `pnpm build` before deployment.
