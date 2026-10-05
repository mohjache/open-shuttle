import { createHash } from "node:crypto";
import * as cheerio from "cheerio";

const TOURNAMENT_URL =
	/https?:\/\/(?:(?:www|badminton|ba)\.)?tournamentsoftware\.com\/(?:tournament\/|sport\/(?:tournament|matches|events|draws)(?:\.aspx)?\?id=)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
const ORIGIN = "https://badminton.tournamentsoftware.com";
type TournamentOrigin = typeof ORIGIN | "https://ba.tournamentsoftware.com";

export type ParsedPlayer = {
	sourcePlayerId: string;
	name: string;
	profileUrl: string;
	clubId: string | null;
};

export type ParsedMatch = {
	id: string;
	date: string | null;
	draw: string | null;
	round: string | null;
	venue: string | null;
	score: string | null;
	winnerSide: number | null;
	status: "completed" | "scheduled";
	sides: ParsedPlayer[][];
	sourceUrl: string;
};

export function tournamentIdFromUrl(input: string): string | null {
	try {
		const url = new URL(input);
		if (
			!/^https?:$/.test(url.protocol) ||
			![
				"tournamentsoftware.com",
				"www.tournamentsoftware.com",
				"badminton.tournamentsoftware.com",
				"ba.tournamentsoftware.com",
			].includes(url.hostname)
		)
			return null;
		const id =
			/^\/tournament\/([^/]+)(?:\/|$)/i.exec(url.pathname)?.[1] ??
			(/^\/sport\/(?:tournament|matches|events|draws)(?:\.aspx)?$/i.test(
				url.pathname,
			)
				? url.searchParams.get("id")
				: null);
		return id &&
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
			? id.toLowerCase()
			: null;
	} catch {
		return null;
	}
}

export function canonicalTournamentUrl(
	id: string,
	origin: TournamentOrigin = ORIGIN,
): string {
	return `${origin}/tournament/${id}`;
}

export function extractTournamentIds(text: string): string[] {
	// Posts often contain URL fragments, query strings, and tracking parameters.
	let decoded = text.replaceAll("&amp;", "&").replaceAll("\\/", "/");
	for (let i = 0; i < 2; i++) {
		try {
			decoded = decodeURIComponent(decoded);
		} catch {
			break;
		}
	}
	const ids = new Set<string>();
	for (const match of decoded.matchAll(
		new RegExp(TOURNAMENT_URL.source, "gi"),
	)) {
		if (match[1]) ids.add(match[1].toLowerCase());
	}
	return [...ids];
}

export function parseTournamentName(html: string): string {
	const $ = cheerio.load(html);
	const title = $("title").text().split(" | ")[0]?.trim();
	if (!title || /^(tournamentsoftware\.com|toernooi\.nl)$/i.test(title)) {
		throw new Error("Tournament page returned a consent wall or no title");
	}
	return title;
}

export function parseMatchDays(html: string): string[] {
	const $ = cheerio.load(html);
	const days = new Set<string>();
	$('[data-href*="MatchesInDay?date="], a[href*="MatchesInDay?date="]').each(
		(_, element) => {
			const href =
				$(element).attr("data-href") ?? $(element).attr("href") ?? "";
			const date = new URL(href, ORIGIN).searchParams.get("date");
			if (date && /^\d{8}$/.test(date)) days.add(date);
		},
	);
	$(".js-date-selection-select option[value]").each((_, option) => {
		const date = $(option).attr("value");
		if (date && /^\d{8}$/.test(date)) days.add(date);
	});
	// Single-day events omit the date tabs and expose their selected day in
	// the public match-search initialization instead.
	if (!days.size) {
		const date = html.match(
			/"postParamObject"\s*:\s*\{[^}]*"date"\s*:\s*"(\d{8})"/,
		)?.[1];
		if (date) days.add(date);
	}
	return [...days].sort();
}

function toIsoDate(day: string): string {
	return `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}`;
}

export function parseMatches(
	html: string,
	tournamentId: string,
	day: string,
	origin: TournamentOrigin = ORIGIN,
): ParsedMatch[] {
	const $ = cheerio.load(html);
	const occurrences = new Map<string, number>();
	const parsed: ParsedMatch[] = [];
	const sourceUrl = `${canonicalTournamentUrl(tournamentId, origin)}/Matches/MatchesInDay?date=${day}`;
	$(".match.match--list").each((_, element) => {
		const match = $(element);
		const sides = match
			.find(".match__row")
			.slice(0, 2)
			.toArray()
			.map((row) => {
				const result: ParsedPlayer[] = [];
				$(row)
					.find("a[data-player-id]")
					.each((_, anchor) => {
						const a = $(anchor);
						const sourcePlayerId = a.attr("data-player-id")?.trim();
						const name = a.text().replace(/\s+/g, " ").trim();
						if (!sourcePlayerId || !name) return;
						result.push({
							sourcePlayerId,
							name,
							profileUrl: new URL(a.attr("href") ?? "", origin).toString(),
							clubId: a.attr("data-club-id") || null,
						});
					});
				return result;
			});
		if (sides.length !== 2 || sides.some((side) => side.length === 0)) return;
		const draw =
			match.find(".match__header-title-item").eq(0).text().trim() || null;
		const round =
			match.find(".match__header-title-item").eq(1).text().trim() || null;
		const venue =
			match
				.find(".match__footer-list-item")
				.first()
				.text()
				.replace(/\s+/g, " ")
				.trim() || null;
		const points = match
			.find(".match__result .points__cell")
			.map((_, cell) => $(cell).text().trim())
			.get()
			.filter(Boolean);
		const score = points.length ? points.join("–") : null;
		const winnerSide = match.find(".match__row").eq(0).hasClass("has-won")
			? 1
			: match.find(".match__row").eq(1).hasClass("has-won")
				? 2
				: null;
		const key = [
			tournamentId,
			day,
			draw,
			round,
			...sides.map((side) => side.map((p) => p.sourcePlayerId).join(",")),
		].join("|");
		const occurrence = occurrences.get(key) ?? 0;
		occurrences.set(key, occurrence + 1);
		const id = createHash("sha256")
			.update(`${key}|${occurrence}`)
			.digest("hex");
		parsed.push({
			id,
			date: toIsoDate(day),
			draw,
			round,
			venue,
			score,
			winnerSide,
			status: winnerSide || score ? "completed" : "scheduled",
			sides,
			sourceUrl,
		});
	});
	return parsed;
}

export type RetryOptions = { attempts?: number; baseDelayMs?: number };

/** Thrown for responses that retrying cannot fix. */
class PermanentFetchError extends Error {}

/** Fetches a public page, retrying rate limits, 5xx responses and network blips. */
export async function getHtml(
	url: string,
	{ attempts = 3, baseDelayMs = 500 }: RetryOptions = {},
): Promise<{ html: string; url: string }> {
	let lastError: unknown;
	for (let attempt = 0; attempt < attempts; attempt++) {
		if (attempt > 0)
			await new Promise((resolve) =>
				setTimeout(resolve, baseDelayMs * 2 ** (attempt - 1)),
			);
		try {
			const response = await fetch(url, {
				headers: {
					"user-agent": "OpenShuttle/0.1 (+public results importer)",
					"accept-language": "en-AU,en;q=0.9",
				},
				signal: AbortSignal.timeout(20_000),
				cache: "no-store",
			});
			if (!response.ok) {
				const message = `Tournamentsoftware returned HTTP ${response.status}`;
				throw response.status === 429 || response.status >= 500
					? new Error(message)
					: new PermanentFetchError(message);
			}
			const length = Number(response.headers.get("content-length") ?? 0);
			if (length > 3_000_000)
				throw new PermanentFetchError("Tournament page is too large");
			const html = await response.text();
			if (html.length > 3_000_000)
				throw new PermanentFetchError("Tournament page is too large");
			return { html, url: response.url };
		} catch (error) {
			if (error instanceof PermanentFetchError) throw error;
			lastError = error;
		}
	}
	throw lastError instanceof Error
		? lastError
		: new Error("Tournamentsoftware request failed");
}

export type TournamentOutline = {
	name: string;
	url: string;
	host: TournamentOrigin;
	days: string[];
};

export async function fetchTournamentOutline(
	id: string,
): Promise<TournamentOutline> {
	const home = await getHtml(canonicalTournamentUrl(id));
	const name = parseTournamentName(home.html);
	// The generic badminton host redirects Australian events to ba, dropping
	// deep paths. Resolve the host from the home page before requesting matches.
	const host = new URL(home.url).origin;
	if (host !== ORIGIN && host !== "https://ba.tournamentsoftware.com")
		throw new Error("Tournament redirected to an unsupported host");
	const url = canonicalTournamentUrl(id, host);
	const index = await getHtml(`${url}/Matches`);
	const days = parseMatchDays(index.html);
	if (!days.length)
		throw new Error("No match days found; page structure may have changed");
	return { name, url, host, days };
}

export async function fetchMatchDay(
	outline: Pick<TournamentOutline, "url" | "host">,
	id: string,
	day: string,
): Promise<ParsedMatch[]> {
	const html = await getHtml(`${outline.url}/Matches/MatchesInDay?date=${day}`);
	return parseMatches(html.html, id, day, outline.host);
}

/** A Tournament is Finished once its last day is before today in Brisbane. */
export function isFinished(lastDay: string, today: string): boolean {
	return toIsoDate(lastDay) < today;
}

export async function fetchTournament(id: string) {
	const outline = await fetchTournamentOutline(id);
	const matches: ParsedMatch[] = [];
	for (const day of outline.days)
		matches.push(...(await fetchMatchDay(outline, id, day)));
	return { name: outline.name, url: outline.url, days: outline.days, matches };
}
