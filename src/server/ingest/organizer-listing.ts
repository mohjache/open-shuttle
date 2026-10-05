import * as cheerio from "cheerio";
import type { ListedTournament } from "./listing";
import {
	canonicalTournamentUrl,
	tournamentIdFromUrl,
} from "./tournamentsoftware";

export const GEN_CORE_SOURCE = {
	id: "gen-core",
	name: "Gen Core tournament listings",
	url: "https://www.tournamentsoftware.com/find.aspx?a=7&q=8ddb46c7-5ed8-405b-bed8-df58de71e671",
};

function calendarDate(year: number, month: number, day: number) {
	const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
	if (new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date)
		throw new Error("Organizer listing contains an invalid calendar date");
	return date;
}

export function parseOrganizerListing(html: string): ListedTournament[] {
	const $ = cheerio.load(html);
	const table = $("table.ruler");
	if (table.length !== 1)
		throw new Error(
			"Organizer listing is unavailable or its structure changed",
		);
	const events = new Map<string, ListedTournament>();
	let year: number | undefined;
	table.find("tbody tr").each((_, row) => {
		const heading = $(row).find("th").text().trim();
		if (/^\d{4}$/.test(heading)) {
			year = Number(heading);
			return;
		}
		const link = $(row).find('a[class*="sporticon_badminton"]');
		if (!link.length) return;
		const sourceUrl = new URL(
			link.attr("href") ?? "",
			GEN_CORE_SOURCE.url,
		).toString();
		const id = tournamentIdFromUrl(sourceUrl);
		const name = link.text().replace(/\s+/g, " ").trim();
		const dates =
			/^(\d{2})([/-])(\d{2})\s+(?:to|t\/m)\s+(\d{2})\2(\d{2})$/.exec(
				$(row).find("td").first().text().trim(),
			);
		if (!year || !id || !name || !dates)
			throw new Error(
				"Organizer listing contains an invalid event; page structure may have changed",
			);
		// Legacy English pages use MM/DD; Dutch pages use DD-MM.
		const slash = dates[2] === "/";
		const startMonth = Number(dates[slash ? 1 : 3]);
		const startDay = Number(dates[slash ? 3 : 1]);
		const endMonth = Number(dates[slash ? 4 : 5]);
		const endDay = Number(dates[slash ? 5 : 4]);
		const startsOn = calendarDate(year, startMonth, startDay);
		let endsOn = calendarDate(year, endMonth, endDay);
		if (endsOn < startsOn) endsOn = calendarDate(year + 1, endMonth, endDay);
		events.set(id, {
			id,
			name,
			sourceUrl,
			url: canonicalTournamentUrl(id),
			startsOn,
			endsOn,
		});
	});
	if (!events.size)
		throw new Error("Organizer listing contained no badminton tournaments");
	return [...events.values()];
}

export async function fetchGenCoreListings() {
	// The public badminton host serves this legacy organizer listing directly.
	// Preserve the user-supplied www URL as the source's identity.
	const url = new URL(GEN_CORE_SOURCE.url);
	url.hostname = "badminton.tournamentsoftware.com";
	const response = await fetch(url, {
		headers: {
			"user-agent": "OpenShuttle/0.1 (+public tournament discovery)",
			"accept-language": "en-AU,en;q=0.9",
		},
		signal: AbortSignal.timeout(20_000),
		cache: "no-store",
	});
	if (!response.ok)
		throw new Error(`Organizer listing returned HTTP ${response.status}`);
	const html = await response.text();
	if (html.length > 3_000_000)
		throw new Error("Organizer listing is too large");
	return { tournaments: parseOrganizerListing(html), truncated: false };
}
