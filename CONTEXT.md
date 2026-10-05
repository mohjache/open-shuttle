# Open Shuttle

A read-only public record of Australian badminton tournament results, gathered from public Tournamentsoftware pages. Ingestion is the only writer; every record stays traceable to its source.

## Language

**Tournament**:
A badminton event published on Tournamentsoftware, identified by its source UUID.
_Avoid_: Event, competition

**Source**:
A place we find Tournaments (a search listing, an organizer listing, or a Facebook Page). A Source says a Tournament exists; it never supplies results.
_Avoid_: Feed, provider

**Discovery**:
Registering Tournaments found through a Source, without fetching their results.
_Avoid_: Crawl, scrape, sync

**Import**:
Fetching a Tournament's results from Tournamentsoftware and storing its Matches and Players.
_Avoid_: Ingest (reserved for the whole discover-then-import job), sync

**Import job**:
A single queued request to Import one Tournament. A Tournament has at most one at a time.
_Avoid_: Task, work item

**Finished**:
A Tournament whose last day has passed in Brisbane time. Only a Finished Tournament is imported automatically.
_Avoid_: Completed, ended

**Awaiting results**:
The state of a Tournament that is not yet Finished, or is Finished but not yet imported.
_Avoid_: Empty, pending

**Failed import**:
An Import job that did not complete and holds its error. It stays failed until an administrator retries it.
_Avoid_: Errored, broken

**Match**:
One contest between two sides within a Tournament, belonging to a draw and round.
_Avoid_: Game, fixture

**Player**:
A competitor as they appear within one Tournament. The same Person in two Tournaments is two Players.
_Avoid_: Competitor, athlete, member

**Person**:
One real competitor across Tournaments, identified by an organisation's member ID. Players without a usable member ID have no Person; we never link on name alone.
_Avoid_: Athlete, profile, account

**Member ID**:
The code a Tournament's organiser assigns a competitor within an organisation. Placeholders such as `000` or `N.A.` are not usable.
_Avoid_: Player ID (that is the per-Tournament number)
