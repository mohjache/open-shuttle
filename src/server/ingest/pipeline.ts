import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "~/server/db";
import {
	ingestionRuns,
	sourcePosts,
	sources,
	tournamentSources,
	tournaments,
} from "~/server/db/schema";
import { DEFAULT_SOURCES, discoverFacebookPosts } from "./facebook";
import type { ListedTournament } from "./listing";
import {
	BRISBANE_SOURCE,
	fetchBrisbaneListings,
	fetchTournamentListings,
	LISTING_SOURCE,
} from "./listing";
import { fetchGenCoreListings, GEN_CORE_SOURCE } from "./organizer-listing";
import { enqueueMissingImportJobs } from "./queue";
import {
	canonicalTournamentUrl,
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

export async function runIngestion(
	options: { facebookToken?: string; listingQuery?: string } = {},
) {
	await ensureSeedData();
	const [run] = await db
		.insert(ingestionRuns)
		.values({})
		.returning({ id: ingestionRuns.id });
	if (!run) throw new Error("Could not start ingestion run");
	const errors: string[] = [];
	let discovered = 0;
	let queued = 0;
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
		// Safety net: queue anything that reached the tournament table without a
		// job (Facebook posts, manual registration, the seeded example).
		queued = await enqueueMissingImportJobs();
	} catch (error) {
		errors.push(error instanceof Error ? error.message : String(error));
	}
	await db
		.update(ingestionRuns)
		.set({
			finishedAt: new Date(),
			status: errors.length ? "partial" : "success",
			discovered,
			error: errors.join("\n") || null,
		})
		.where(eq(ingestionRuns.id, run.id));
	return { runId: run.id, discovered, queued, errors };
}
