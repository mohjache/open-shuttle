import { afterEach, describe, expect, it, vi } from "vitest";
import {
	extractTournamentIds,
	getHtml,
	isFinished,
	parseMatchDays,
	parseMatches,
	parseTournamentName,
} from "./tournamentsoftware";

const id = "ada99113-fa52-47f3-88d0-d4866c344313";

describe("tournamentsoftware importer", () => {
	it("finds and deduplicates links in post text", () => {
		const text = `Results: https://www.tournamentsoftware.com/tournament/${id}?utm_source=facebook and https://badminton.tournamentsoftware.com/tournament/${id}`;
		expect(extractTournamentIds(text)).toEqual([id]);
	});
	it("finds single-day events and compact date selectors", () => {
		expect(
			parseMatchDays(
				'<script>visualreality.app.tournament.matches.init({"postParamObject":{"code":"example","date":"20251019","location":""}});</script>',
			),
		).toEqual(["20251019"]);
		expect(
			parseMatchDays(
				'<select class="js-date-selection-select"><option value="20251025">Saturday</option><option value="20251024">Friday</option></select>',
			),
		).toEqual(["20251024", "20251025"]);
	});

	it("rejects the consent wall and discovers every match day", () => {
		expect(() =>
			parseTournamentName("<title>Tournamentsoftware.com</title>"),
		).toThrow();
		expect(
			parseMatchDays(
				`<a data-href="/tournament/${id}/Matches/MatchesInDay?date=20261004">4 Oct</a><a data-href="/tournament/${id}/Matches/MatchesInDay?date=20261011">11 Oct</a>`,
			),
		).toEqual(["20261004", "20261011"]);
	});

	it("normalizes teams, winner, score and a stable match id", () => {
		const html = `<div class="match match--list"><div class="match__header-title-item">MD A</div><div class="match__header-title-item">Round 1</div><div class="match__row has-won"><a data-player-id="45" data-club-id="35" href="/sport/player.aspx?id=${id}&player=45">Shi Hong Kong</a><a data-player-id="122" href="/sport/player.aspx?id=${id}&player=122">Seng Hao Yeoh</a></div><div class="match__row"><a data-player-id="60" href="/sport/player.aspx?id=${id}&player=60">Jyun Yu Liao</a><a data-player-id="208" href="/sport/player.aspx?id=${id}&player=208">Richard Liu</a></div><div class="match__result"><span class="points__cell">30</span><span class="points__cell">27</span></div></div>`;
		const [match] = parseMatches(html, id, "20261004");
		expect(match).toMatchObject({
			date: "2026-10-04",
			draw: "MD A",
			round: "Round 1",
			score: "30–27",
			winnerSide: 1,
			status: "completed",
		});
		expect(match?.sides.map((side) => side.map((p) => p.name))).toEqual([
			["Shi Hong Kong", "Seng Hao Yeoh"],
			["Jyun Yu Liao", "Richard Liu"],
		]);
		expect(parseMatches(html.replace("30", "31"), id, "20261004")[0]?.id).toBe(
			match?.id,
		);
	});
});

describe("tournamentsoftware fetching", () => {
	afterEach(() => vi.unstubAllGlobals());
	const page = (status: number, body = "<html></html>") =>
		new Response(body, { status });

	it("retries rate limits and server errors before succeeding", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(page(429))
			.mockRejectedValueOnce(new TypeError("fetch failed"))
			.mockResolvedValueOnce(page(200, "<p>ok</p>"));
		vi.stubGlobal("fetch", fetchMock);
		const result = await getHtml("https://example.test/", { baseDelayMs: 0 });
		expect(result.html).toBe("<p>ok</p>");
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it("gives up after the last attempt and reports the failure", async () => {
		const fetchMock = vi.fn().mockImplementation(async () => page(503));
		vi.stubGlobal("fetch", fetchMock);
		await expect(
			getHtml("https://example.test/", { attempts: 2, baseDelayMs: 0 }),
		).rejects.toThrow("HTTP 503");
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("does not retry permanent client errors", async () => {
		const fetchMock = vi.fn().mockImplementation(async () => page(404));
		vi.stubGlobal("fetch", fetchMock);
		await expect(
			getHtml("https://example.test/", { baseDelayMs: 0 }),
		).rejects.toThrow("HTTP 404");
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});

describe("isFinished", () => {
	it("is true only once the last day is before today in Brisbane", () => {
		expect(isFinished("20260913", "2026-09-14")).toBe(true);
		expect(isFinished("20260913", "2026-09-13")).toBe(false);
		expect(isFinished("20260913", "2026-09-12")).toBe(false);
	});
});
