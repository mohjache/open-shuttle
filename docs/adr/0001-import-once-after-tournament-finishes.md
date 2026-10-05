# Import each Tournament once, after it has finished, with manual retries

Open Shuttle's priority is a complete historical archive, not live scores. Each Tournament gets a single Import job that becomes due the day after its last day (Brisbane time). A Failed import is never retried automatically; an administrator retries it. We rejected refresh windows for live events and automatic retries with backoff: they add scheduling and re-enqueue logic, and re-importing the growing archive would compete with the backfill for the one-Tournament-per-minute worker. A Tournament that hasn't finished simply has no results yet.

If live scores become a goal, this decision needs revisiting, along with the import job model that assumes one job per Tournament.
