import { expect, it } from "vitest";
import { fetchBrisbaneListings, fetchTournamentListings } from "./listing";
import { fetchTournament } from "./tournamentsoftware";

it.skipIf(!process.env.LIVE_DISCOVERY_TEST)(
	"discovers postcode events from the supplied public search and rolling window",
	async () => {
		const supplied = await fetchBrisbaneListings({
			window: { start: "2026-09-01", end: "2027-01-05" },
		});
		expect(supplied.truncated).toBe(false);
		expect(
			supplied.tournaments.some((event) => event.name.includes("YS Badminton")),
		).toBe(true);
		const rolling = await fetchBrisbaneListings({
			now: new Date("2026-10-05T00:00:00Z"),
		});
		expect(rolling.tournaments.length).toBeGreaterThanOrEqual(
			supplied.tournaments.length,
		);
		expect(rolling.truncated).toBe(false);
	},
	60_000,
);

it.skipIf(!process.env.LIVE_DISCOVERY_TEST)(
	"discovers Queensland events and parses one discovered tournament's results",
	async () => {
		const result = await fetchTournamentListings({
			now: new Date("2026-10-05T00:00:00Z"),
		});
		expect(result.tournaments.length).toBeGreaterThan(0);
		expect(result.truncated).toBe(false);
		const event = result.tournaments.find(
			(event) => event.endsOn < "2026-10-05",
		);
		expect(event).toBeDefined();
		if (!event) throw new Error("No completed tournament discovered");
		const tournament = await fetchTournament(event.id);
		expect(tournament.matches.length).toBeGreaterThan(0);
		expect(tournament.days.length).toBeGreaterThan(0);
	},
	60_000,
);
