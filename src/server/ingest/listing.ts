import * as cheerio from "cheerio";
import {
	canonicalTournamentUrl,
	tournamentIdFromUrl,
} from "./tournamentsoftware";

export const LISTING_SOURCE = {
	id: "badminton-australia",
	name: "Badminton Australia tournament listings",
	url: "https://ba.tournamentsoftware.com/tournaments",
};
const ORIGIN = "https://ba.tournamentsoftware.com";
const PUBLIC_ORIGIN = "https://www.tournamentsoftware.com";
export const BRISBANE_SOURCE = {
	id: "brisbane-postcode",
	name: "Brisbane postcode tournament search",
	url: "https://www.tournamentsoftware.com/find?DateFilterType=0&StartDate=2026-09-01&EndDate=2027-01-05&Distance=50&SportID=2&page=1&PostalCode=4000&CountryCode=AUS",
};

export type ListedTournament = {
	id: string;
	name: string;
	url: string;
	sourceUrl: string;
	startsOn: string;
	endsOn: string;
};

export function brisbaneToday(now = new Date()): string {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: "Australia/Brisbane",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(now);
}

export function listingWindow(now = new Date()) {
	const today = brisbaneToday(now);
	const date = new Date(`${today}T00:00:00Z`);
	const shifted = (days: number) =>
		new Date(date.getTime() + days * 86_400_000).toISOString().slice(0, 10);
	return { start: shifted(-365), end: shifted(90) };
}

export function parseTournamentListing(
	html: string,
	origin = ORIGIN,
): ListedTournament[] {
	const $ = cheerio.load(html);
	const results = new Map<string, ListedTournament>();
	$(".media__title a").each((_, element) => {
		const a = $(element);
		const sourceUrl = new URL(a.attr("href") ?? "", origin).toString();
		const id = tournamentIdFromUrl(sourceUrl);
		const name = a.text().replace(/\s+/g, " ").trim();
		const dates = a
			.closest(".media__content")
			.find("time[datetime]")
			.toArray()
			.map((time) => $(time).attr("datetime")?.slice(0, 10));
		const startsOn = dates[0];
		const endsOn = dates.at(-1);
		if (
			!id ||
			!name ||
			!startsOn ||
			!endsOn ||
			![startsOn, endsOn].every(
				(date) =>
					/^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)),
			)
		) {
			throw new Error(
				"Tournament listing contains an invalid event; page structure may have changed",
			);
		}
		results.set(id, {
			id,
			name,
			url: canonicalTournamentUrl(id, ORIGIN),
			sourceUrl,
			startsOn,
			endsOn,
		});
	});
	return [...results.values()];
}

type SearchOptions = {
	query?: string;
	now?: Date;
	maxPages?: number;
	window?: { start: string; end: string };
};

export function fetchTournamentListings(options: SearchOptions = {}) {
	return fetchSearch(ORIGIN, {
		...options,
		query: options.query ?? "Queensland",
	});
}

export function fetchBrisbaneListings(
	options: Omit<SearchOptions, "query"> = {},
) {
	return fetchSearch(
		PUBLIC_ORIGIN,
		{ ...options, query: "" },
		{
			"TournamentFilter.PostalCode": "4000",
			"TournamentFilter.Distance": "50",
			"TournamentExtendedFilter.CountryCode": "AUS",
		},
	);
}

async function fetchSearch(
	origin: string,
	options: SearchOptions,
	filters: Record<string, string> = {},
) {
	const query = options.query ?? "";
	const window = options.window ?? listingWindow(options.now);
	const maxPages = Math.min(Math.max(options.maxPages ?? 5, 1), 10);
	const results = new Map<string, ListedTournament>();
	const signal = AbortSignal.timeout(20_000);
	let hasMore = false;
	let pages = 0;
	for (let page = 1; page <= maxPages; page++) {
		// Same public form submission used by the site's tournament search.
		const response = await fetch(`${origin}/find/tournament/DoSearch`, {
			method: "POST",
			headers: {
				"content-type": "application/x-www-form-urlencoded",
				"X-Requested-With": "XMLHttpRequest",
				"user-agent": "OpenShuttle/0.1 (+public tournament discovery)",
				"accept-language": "en-AU,en;q=0.9",
			},
			body: new URLSearchParams({
				"TournamentFilter.Q": query,
				"TournamentFilter.StartDate": window.start,
				"TournamentFilter.EndDate": window.end,
				"TournamentFilter.DateFilterType": "0",
				"TournamentExtendedFilter.SportID": "2",
				...filters,
				Page: String(page),
			}),
			signal,
			cache: "no-store",
		});
		if (!response.ok)
			throw new Error(`Tournament search returned HTTP ${response.status}`);
		const more = response.headers.get("HasMoreResults");
		const total = response.headers.get("TotalResultCount");
		if (!/^(true|false)$/i.test(more ?? "") || !/^\d+$/.test(total ?? ""))
			throw new Error(
				"Tournament search returned an unexpected response; page structure may have changed",
			);
		const html = await response.text();
		if (html.length > 3_000_000)
			throw new Error("Tournament listing is too large");
		const entries = parseTournamentListing(html, origin);
		const countBefore = results.size;
		for (const entry of entries) results.set(entry.id, entry);
		hasMore = more?.toLowerCase() === "true";
		pages = page;
		if (
			(!entries.length && Number(total) > 0) ||
			(hasMore && results.size === countBefore)
		)
			throw new Error(
				"Tournament search returned no new events despite reporting results",
			);
		if (!hasMore) break;
	}
	return {
		tournaments: [...results.values()],
		pages,
		truncated: hasMore,
		query,
		window,
	};
}
