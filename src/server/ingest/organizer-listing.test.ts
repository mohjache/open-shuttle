import { readFileSync } from "node:fs";
import { afterEach, expect, it, vi } from "vitest";
import {
	fetchGenCoreListings,
	GEN_CORE_SOURCE,
	parseOrganizerListing,
} from "./organizer-listing";

const fixture = readFileSync(
	new URL("./fixtures/gen-core-listing.html", import.meta.url),
	"utf8",
);
afterEach(() => vi.restoreAllMocks());

it("reads the full live organizer archive, dates and source IDs across states", () => {
	const events = parseOrganizerListing(fixture);
	expect(events.length).toBeGreaterThan(50);
	expect(
		events.find((event) => event.id === "ada99113-fa52-47f3-88d0-d4866c344313"),
	).toMatchObject({
		startsOn: "2026-10-04",
		endsOn: "2026-10-11",
		sourceUrl:
			"https://www.tournamentsoftware.com/sport/tournament.aspx?id=ADA99113-FA52-47F3-88D0-D4866C344313",
	});
	expect(events.some((event) => event.name.includes("NSW"))).toBe(true);
	expect(events.at(-1)?.startsOn).toBe("2016-11-01");
	expect(new Set(events.map((event) => event.id)).size).toBe(events.length);
});

it("handles English dates and events spanning New Year without merging names", () => {
	const html =
		'<table class="ruler"><tbody><tr><th>2026</th></tr><tr><td>12/31 to 01/02</td><td><a class="sporticon_badminton" href="sport/tournament.aspx?id=ADA99113-FA52-47F3-88D0-D4866C344313">Event</a></td></tr></tbody></table>';
	expect(parseOrganizerListing(html)[0]).toMatchObject({
		startsOn: "2026-12-31",
		endsOn: "2027-01-02",
	});
	expect(() => parseOrganizerListing(html.replace("12/31", "02/31"))).toThrow();
	expect(() =>
		parseOrganizerListing(html.replace("<th>2026</th>", "<th>unknown</th>")),
	).toThrow("invalid event");
});

it("rejects a consent wall or empty archive instead of silently succeeding", () => {
	expect(() => parseOrganizerListing("<title>Cookie consent</title>")).toThrow(
		"unavailable",
	);
	expect(() =>
		parseOrganizerListing('<table class="ruler"><tbody></tbody></table>'),
	).toThrow("no badminton tournaments");
});

it("fetches the public legacy host while retaining the supplied source identity", async () => {
	const fetcher = vi
		.spyOn(globalThis, "fetch")
		.mockResolvedValue(new Response(fixture));
	expect((await fetchGenCoreListings()).tournaments.length).toBeGreaterThan(50);
	expect(String(fetcher.mock.calls[0]?.[0])).toBe(
		GEN_CORE_SOURCE.url.replace("www.", "badminton."),
	);
});

it.skipIf(!process.env.LIVE_DISCOVERY_TEST)(
	"fetches the Gen Core archive live",
	async () => {
		const result = await fetchGenCoreListings();
		expect(result.tournaments.length).toBeGreaterThan(50);
		expect(
			result.tournaments.some(
				(event) => event.id === "ada99113-fa52-47f3-88d0-d4866c344313",
			),
		).toBe(true);
	},
	30_000,
);
