import "server-only";
import { asc, eq, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "~/server/db";
import {
	ingestionRuns,
	matches,
	matchPlayers,
	players,
	sourcePosts,
	sources,
	tournamentSources,
	tournaments,
} from "~/server/db/schema";
import { DEFAULT_SOURCES, discoverFacebookPosts } from "./facebook";
import type { ListedTournament } from "./listing";
import {
	BRISBANE_SOURCE,
	brisbaneToday,
	fetchBrisbaneListings,
	fetchTournamentListings,
	LISTING_SOURCE,
} from "./listing";
import { fetchGenCoreListings, GEN_CORE_SOURCE } from "./organizer-listing";
import {
	canonicalTournamentUrl,
	fetchTournament,
	tournamentIdFromUrl,
} from "./tournamentsoftware";

const EXAMPLE_ID = "ada99113-fa52-47f3-88d0-d4866c344313";

export async function ensureSeedData() {
	for (const source of [
		LISTING_SOURCE,
		BRISBANE_SOURCE,
		GEN_CORE_SOURCE,
		...DEFAULT_SOURCES,
	]) {
		await db.insert(sources).values(source).onConflictDoNothing();
	}
	await db
		.insert(tournaments)
		.values({
			id: EXAMPLE_ID,
			name: "2026 Knockout Badminton Graded Seasonal Series - QLD FINAL SERIES",
			url: canonicalTournamentUrl(EXAMPLE_ID),
		})
		.onConflictDoNothing();
}

export async function discoverFromTournamentListings(query?: string) {
	const results = [];
	for (const [source, fetchListing] of [
		[LISTING_SOURCE, () => fetchTournamentListings({ query })],
		[GEN_CORE_SOURCE, fetchGenCoreListings],
		[BRISBANE_SOURCE, fetchBrisbaneListings],
	] as const) {
		results.push(await discoverListing(source, fetchListing));
	}
	return {
		discovered: results.reduce((sum, result) => sum + result.discovered, 0),
		errors: results.flatMap((result) => result.errors),
	};
}

async function discoverListing(
	config: { id: string; name: string; url: string },
	fetchListing: () => Promise<{
		tournaments: ListedTournament[];
		truncated: boolean;
	}>,
) {
	const [source] = await db
		.select()
		.from(sources)
		.where(eq(sources.id, config.id));
	if (!source?.enabled) return { discovered: 0, errors: [] as string[] };
	try {
		const result = await fetchListing();
		const warning = result.truncated
			? "Tournament search reached its page limit; narrow the search filters or increase its page limit to avoid missing events"
			: null;
		const discovered = await db.transaction(async (tx) => {
			if (!result.tournaments.length) return 0;
			const added = await tx
				.insert(tournaments)
				.values(
					result.tournaments.map(({ id, name, url, startsOn, endsOn }) => ({
						id,
						name,
						url,
						startsOn,
						endsOn,
					})),
				)
				.onConflictDoNothing()
				.returning({ id: tournaments.id });
			await tx
				.insert(sourcePosts)
				.values(
					result.tournaments.map((event) => ({
						id: `${config.id}:${event.id}`,
						sourceId: config.id,
						url: event.sourceUrl,
						text: event.name,
					})),
				)
				.onConflictDoUpdate({
					target: sourcePosts.id,
					set: {
						text: sql.raw('excluded."text"'),
						url: sql.raw('excluded."url"'),
					},
				});
			await tx
				.insert(tournamentSources)
				.values(
					result.tournaments.map((event) => ({
						tournamentId: event.id,
						sourcePostId: `${config.id}:${event.id}`,
					})),
				)
				.onConflictDoNothing();
			return added.length;
		});
		await db
			.update(sources)
			.set({ lastCheckedAt: new Date(), lastError: warning })
			.where(eq(sources.id, source.id));
		return {
			discovered,
			errors: warning ? [`${source.name}: ${warning}`] : [],
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		await db
			.update(sources)
			.set({ lastCheckedAt: new Date(), lastError: message })
			.where(eq(sources.id, source.id));
		return { discovered: 0, errors: [`${source.name}: ${message}`] };
	}
}

export async function discoverFromFacebook(token: string) {
	const configuredSources = await db
		.select()
		.from(sources)
		.where(eq(sources.enabled, true));
	let discovered = 0;
	const errors: string[] = [];
	const fetched = await Promise.all(
		configuredSources
			.filter((source): source is typeof source & { pageId: string } =>
				Boolean(source.pageId),
			)
			.map(async (source) => {
				try {
					return {
						source,
						posts: await discoverFacebookPosts(
							{ id: source.id, pageId: source.pageId },
							token,
						),
						error: null,
					};
				} catch (error) {
					return {
						source,
						posts: [],
						error: error instanceof Error ? error.message : String(error),
					};
				}
			}),
	);
	for (const { source, posts, error } of fetched) {
		if (error) {
			errors.push(`${source.name}: ${error}`);
			await db
				.update(sources)
				.set({ lastCheckedAt: new Date(), lastError: error })
				.where(eq(sources.id, source.id));
			continue;
		}
		try {
			if (posts.length) {
				await db
					.insert(sourcePosts)
					.values(
						posts.map((post) => ({
							id: post.id,
							sourceId: source.id,
							url: post.url,
							text: post.text,
							publishedAt: post.publishedAt,
						})),
					)
					.onConflictDoUpdate({
						target: sourcePosts.id,
						set: {
							text: sql.raw('excluded."text"'),
							url: sql.raw('excluded."url"'),
						},
					});
				const ids = [...new Set(posts.flatMap((post) => post.tournamentIds))];
				await db
					.insert(tournaments)
					.values(
						ids.map((id) => ({
							id,
							name: `Tournament ${id}`,
							url: canonicalTournamentUrl(id),
						})),
					)
					.onConflictDoNothing();
				const links = posts.flatMap((post) =>
					post.tournamentIds.map((id) => ({
						tournamentId: id,
						sourcePostId: post.id,
					})),
				);
				await db.insert(tournamentSources).values(links).onConflictDoNothing();
				discovered += links.length;
			}
			await db
				.update(sources)
				.set({ lastCheckedAt: new Date(), lastError: null })
				.where(eq(sources.id, source.id));
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			errors.push(`${source.name}: ${message}`);
			await db
				.update(sources)
				.set({ lastCheckedAt: new Date(), lastError: message })
				.where(eq(sources.id, source.id));
		}
	}
	return { discovered, errors };
}

export async function registerTournament(input: string) {
	const id = tournamentIdFromUrl(input);
	if (!id) throw new Error("Expected a tournamentsoftware.com tournament URL");
	await db
		.insert(tournaments)
		.values({ id, name: `Tournament ${id}`, url: canonicalTournamentUrl(id) })
		.onConflictDoNothing();
	return id;
}

export async function importTournament(id: string) {
	const result = await fetchTournament(id);
	if (!result.matches.length)
		throw new Error(
			"No player matches parsed; page structure may have changed",
		);
	const now = new Date();
	const playerMap = new Map<string, typeof players.$inferInsert>();
	const matchValues: (typeof matches.$inferInsert)[] = [];
	const participantValues: (typeof matchPlayers.$inferInsert)[] = [];
	for (const match of result.matches) {
		matchValues.push({
			id: match.id,
			tournamentId: id,
			matchDate: match.date,
			draw: match.draw,
			round: match.round,
			venue: match.venue,
			score: match.score,
			winnerSide: match.winnerSide,
			status: match.status,
			sourceUrl: match.sourceUrl,
			updatedAt: now,
		});
		for (const [sideIndex, side] of match.sides.entries()) {
			for (const [position, player] of side.entries()) {
				const playerId = `${id}:${player.sourcePlayerId}`;
				playerMap.set(playerId, {
					id: playerId,
					tournamentId: id,
					sourcePlayerId: player.sourcePlayerId,
					name: player.name,
					profileUrl: player.profileUrl,
					clubId: player.clubId,
					updatedAt: now,
				});
				participantValues.push({
					matchId: match.id,
					playerId,
					side: sideIndex + 1,
					position: position + 1,
				});
			}
		}
	}
	await db.transaction(async (tx) => {
		await tx
			.insert(tournaments)
			.values({
				id,
				name: result.name,
				url: result.url,
				startsOn: `${result.days[0]?.slice(0, 4)}-${result.days[0]?.slice(4, 6)}-${result.days[0]?.slice(6, 8)}`,
				endsOn: `${result.days.at(-1)?.slice(0, 4)}-${result.days.at(-1)?.slice(4, 6)}-${result.days.at(-1)?.slice(6, 8)}`,
				lastImportedAt: now,
				lastAttemptAt: now,
				lastError: null,
			})
			.onConflictDoUpdate({
				target: tournaments.id,
				set: {
					name: result.name,
					url: result.url,
					startsOn: `${result.days[0]?.slice(0, 4)}-${result.days[0]?.slice(4, 6)}-${result.days[0]?.slice(6, 8)}`,
					endsOn: `${result.days.at(-1)?.slice(0, 4)}-${result.days.at(-1)?.slice(4, 6)}-${result.days.at(-1)?.slice(6, 8)}`,
					lastImportedAt: now,
					lastAttemptAt: now,
					lastError: null,
				},
			});
		await tx
			.insert(players)
			.values([...playerMap.values()])
			.onConflictDoUpdate({
				target: players.id,
				set: {
					name: sql.raw('excluded."name"'),
					profileUrl: sql.raw('excluded."profileUrl"'),
					clubId: sql.raw('excluded."clubId"'),
					updatedAt: now,
				},
			});
		await tx
			.insert(matches)
			.values(matchValues)
			.onConflictDoUpdate({
				target: matches.id,
				set: {
					matchDate: sql.raw('excluded."matchDate"'),
					draw: sql.raw('excluded."draw"'),
					round: sql.raw('excluded."round"'),
					venue: sql.raw('excluded."venue"'),
					score: sql.raw('excluded."score"'),
					winnerSide: sql.raw('excluded."winnerSide"'),
					status: sql.raw('excluded."status"'),
					sourceUrl: sql.raw('excluded."sourceUrl"'),
					updatedAt: now,
				},
			});
		await tx
			.insert(matchPlayers)
			.values(participantValues)
			.onConflictDoNothing();
	});
	return {
		id,
		name: result.name,
		days: result.days.length,
		matches: result.matches.length,
	};
}

export async function runIngestion(
	options: {
		facebookToken?: string;
		listingQuery?: string;
		limit?: number;
	} = {},
) {
	await ensureSeedData();
	const [run] = await db
		.insert(ingestionRuns)
		.values({})
		.returning({ id: ingestionRuns.id });
	if (!run) throw new Error("Could not start ingestion run");
	const errors: string[] = [];
	let discovered = 0;
	let imported = 0;
	let matchCount = 0;
	try {
		const listingDiscovery = await discoverFromTournamentListings(
			options.listingQuery,
		);
		discovered += listingDiscovery.discovered;
		errors.push(...listingDiscovery.errors);
		if (options.facebookToken) {
			const discovery = await discoverFromFacebook(options.facebookToken);
			discovered += discovery.discovered;
			errors.push(...discovery.errors);
		}
		const pending = await db
			.select({ id: tournaments.id })
			.from(tournaments)
			.where(
				or(
					isNull(tournaments.startsOn),
					lte(tournaments.startsOn, brisbaneToday()),
				),
			)
			.orderBy(
				sql`${tournaments.lastAttemptAt} asc nulls first`,
				asc(tournaments.discoveredAt),
				asc(tournaments.id),
			)
			.limit(options.limit ?? 2);
		for (const tournament of pending) {
			try {
				const result = await importTournament(tournament.id);
				imported++;
				matchCount += result.matches;
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				errors.push(`${tournament.id}: ${message}`);
				await db
					.update(tournaments)
					.set({ lastAttemptAt: new Date(), lastError: message })
					.where(eq(tournaments.id, tournament.id));
			}
		}
	} catch (error) {
		errors.push(error instanceof Error ? error.message : String(error));
	}
	await db
		.update(ingestionRuns)
		.set({
			finishedAt: new Date(),
			status: errors.length ? "partial" : "success",
			discovered,
			imported,
			matches: matchCount,
			error: errors.join("\n") || null,
		})
		.where(eq(ingestionRuns.id, run.id));
	return { runId: run.id, discovered, imported, matches: matchCount, errors };
}
