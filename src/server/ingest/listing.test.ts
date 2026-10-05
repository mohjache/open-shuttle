import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	brisbaneToday,
	fetchBrisbaneListings,
	fetchTournamentListings,
	listingWindow,
	parseTournamentListing,
} from "./listing";
import { tournamentIdFromUrl } from "./tournamentsoftware";

const fixture = readFileSync(
	new URL("./fixtures/australian-listing.html", import.meta.url),
	"utf8",
);
afterEach(() => vi.restoreAllMocks());

describe("Australian tournament discovery", () => {
	it("uses the postcode search without a name keyword and preserves its host", async () => {
		const localFixture = readFileSync(
			new URL("./fixtures/brisbane-listing.html", import.meta.url),
			"utf8",
		);
		const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(localFixture, {
				headers: { HasMoreResults: "false", TotalResultCount: "3" },
			}),
		);
		const result = await fetchBrisbaneListings({
			now: new Date("2026-10-05T00:00:00Z"),
		});
		expect(result.tournaments).toHaveLength(3);
		expect(
			result.tournaments.some((event) => event.name.includes("YS Badminton")),
		).toBe(true);
		expect(fetcher.mock.calls[0]?.[0]).toBe(
			"https://www.tournamentsoftware.com/find/tournament/DoSearch",
		);
		const body = fetcher.mock.calls[0]?.[1]?.body as URLSearchParams;
		expect(Object.fromEntries(body)).toMatchObject({
			"TournamentFilter.Q": "",
			"TournamentFilter.PostalCode": "4000",
			"TournamentFilter.Distance": "50",
			"TournamentExtendedFilter.CountryCode": "AUS",
			"TournamentExtendedFilter.SportID": "2",
			"TournamentFilter.StartDate": "2025-10-05",
			"TournamentFilter.EndDate": "2027-01-03",
		});
		expect(
			result.tournaments.every((event) =>
				event.sourceUrl.startsWith("https://www.tournamentsoftware.com/"),
			),
		).toBe(true);
	});
	it("reads real listing names, dates, relative URLs and single-day events", () => {
		const events = parseTournamentListing(fixture);
		expect(events).toHaveLength(2);
		expect(events[0]).toMatchObject({
			id: "51f90621-abee-4d83-ab59-c28c560865d1",
			name: "2025 QLD Spring Junior Festival",
			startsOn: "2025-10-19",
			endsOn: "2025-10-19",
			sourceUrl:
				"https://ba.tournamentsoftware.com/sport/tournament?id=51F90621-ABEE-4D83-AB59-C28C560865D1",
		});
		expect(events[1]).toMatchObject({
			startsOn: "2025-10-24",
			endsOn: "2025-10-26",
		});
		expect(parseTournamentListing(fixture + fixture)).toHaveLength(2);
	});
	it("accepts Australian links without accepting unrelated hosts", () => {
		const id = "51F90621-ABEE-4D83-AB59-C28C560865D1";
		expect(
			tournamentIdFromUrl(
				`https://ba.tournamentsoftware.com/sport/tournament?id=${id}`,
			),
		).toBe(id.toLowerCase());
		expect(
			tournamentIdFromUrl(
				`https://ba.tournamentsoftware.com/sport/tournament.aspx?id=${id}&draw=2`,
			),
		).toBe(id.toLowerCase());
		expect(
			tournamentIdFromUrl(`https://evil.example/tournament/${id}`),
		).toBeNull();
		expect(
			tournamentIdFromUrl(
				`https://evil.example/https://ba.tournamentsoftware.com/tournament/${id}`,
			),
		).toBeNull();
	});
	it("uses Brisbane's calendar day across the UTC day boundary", () => {
		const now = new Date("2026-10-04T15:00:00Z");
		expect(brisbaneToday(now)).toBe("2026-10-05");
		expect(listingWindow(now)).toEqual({
			start: "2025-10-05",
			end: "2027-01-03",
		});
	});
	it("follows public search pagination and deduplicates overlapping pages", async () => {
		const fetcher = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(
				new Response(fixture, {
					headers: { HasMoreResults: "true", TotalResultCount: "2" },
				}),
			)
			.mockResolvedValueOnce(
				new Response(fixture, {
					headers: { HasMoreResults: "false", TotalResultCount: "2" },
				}),
			);
		const result = await fetchTournamentListings({
			now: new Date("2026-10-05T00:00:00Z"),
		});
		expect(result.tournaments).toHaveLength(2);
		expect(result.truncated).toBe(false);
		expect(result.pages).toBe(2);
		const first = fetcher.mock.calls[0]?.[1]?.body as URLSearchParams;
		expect(first.get("TournamentFilter.Q")).toBe("Queensland");
		expect(first.get("TournamentFilter.StartDate")).toBe("2025-10-05");
		const second = fetcher.mock.calls[1]?.[1]?.body as URLSearchParams;
		expect(second.get("Page")).toBe("2");
	});
	it("reports truncation instead of silently dropping remaining pages", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(fixture, {
				headers: { HasMoreResults: "true", TotalResultCount: "200" },
			}),
		);
		expect((await fetchTournamentListings({ maxPages: 1 })).truncated).toBe(
			true,
		);
	});
	it("rejects a consent wall or changed markup instead of treating it as no results", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response("<title>Tournamentsoftware.com</title>"),
		);
		await expect(fetchTournamentListings()).rejects.toThrow(
			"unexpected response",
		);
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response("<div>changed markup</div>", {
				headers: { HasMoreResults: "false", TotalResultCount: "1" },
			}),
		);
		await expect(fetchTournamentListings()).rejects.toThrow("no new events");
	});
	it("accepts an empty search result", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response("", {
				headers: { HasMoreResults: "false", TotalResultCount: "0" },
			}),
		);
		expect((await fetchTournamentListings()).tournaments).toEqual([]);
	});
});
