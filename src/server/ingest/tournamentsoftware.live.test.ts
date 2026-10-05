import { expect, it } from "vitest";
import { fetchTournament } from "./tournamentsoftware";

it.skipIf(!process.env.LIVE_IMPORT_TEST)(
	"parses the example tournament's public result pages",
	async () => {
		const result = await fetchTournament(
			"ada99113-fa52-47f3-88d0-d4866c344313",
		);
		expect(result.name).toContain("Knockout Badminton");
		expect(result.days.length).toBeGreaterThan(0);
		expect(result.matches.length).toBeGreaterThan(50);
		expect(
			result.matches.some((match) =>
				match.sides.flat().some((player) => player.name.length > 0),
			),
		).toBe(true);
	},
	60_000,
);
