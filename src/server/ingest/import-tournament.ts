import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "~/server/db";
import {
	matches,
	matchPlayers,
	players,
	tournaments,
} from "~/server/db/schema";
import {
	fetchMatchDay,
	fetchTournamentOutline,
	isFinished,
	type ParsedMatch,
} from "./tournamentsoftware";

const BATCH_SIZE = 1000;

function chunks<T>(items: T[], size = BATCH_SIZE): T[][] {
	const result: T[][] = [];
	for (let i = 0; i < items.length; i += size)
		result.push(items.slice(i, i + size));
	return result;
}

function isoDay(day: string): string {
	return `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}`;
}

export type ImportOptions = {
	/** Stop starting new match days once this many milliseconds have passed. */
	deadlineMs?: number;
	/** Today's date in Brisbane (YYYY-MM-DD); unfinished events are refused. */
	today?: string;
};

/** Writes one match day. Upserts, so re-running a day is safe. */
async function saveDay(tournamentId: string, dayMatches: ParsedMatch[]) {
	if (!dayMatches.length) return;
	const now = new Date();
	const playerMap = new Map<string, typeof players.$inferInsert>();
	const matchValues: (typeof matches.$inferInsert)[] = [];
	const participantValues: (typeof matchPlayers.$inferInsert)[] = [];
	for (const match of dayMatches) {
		matchValues.push({
			id: match.id,
			tournamentId,
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
				const playerId = `${tournamentId}:${player.sourcePlayerId}`;
				playerMap.set(playerId, {
					id: playerId,
					tournamentId,
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
		for (const batch of chunks([...playerMap.values()]))
			await tx
				.insert(players)
				.values(batch)
				.onConflictDoUpdate({
					target: players.id,
					set: {
						name: sql.raw('excluded."name"'),
						profileUrl: sql.raw('excluded."profileUrl"'),
						clubId: sql.raw('excluded."clubId"'),
						updatedAt: now,
					},
				});
		for (const batch of chunks(matchValues))
			await tx
				.insert(matches)
				.values(batch)
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
		for (const batch of chunks(participantValues))
			await tx.insert(matchPlayers).values(batch).onConflictDoNothing();
	});
}

/**
 * Imports a Tournament one match day at a time, committing each day, so a
 * timeout leaves the days already fetched in place. Throws on any failure.
 */
export async function importTournament(
	id: string,
	{ deadlineMs, today }: ImportOptions = {},
) {
	const startedAt = Date.now();
	const outline = await fetchTournamentOutline(id);
	const lastDay = outline.days.at(-1) as string;
	if (today && !isFinished(lastDay, today))
		throw new Error(
			`Tournament has not finished yet (last day ${isoDay(lastDay)})`,
		);
	const dates = {
		name: outline.name,
		url: outline.url,
		startsOn: isoDay(outline.days[0] as string),
		endsOn: isoDay(lastDay),
		lastAttemptAt: new Date(),
	};
	await db
		.insert(tournaments)
		.values({ id, ...dates })
		.onConflictDoUpdate({ target: tournaments.id, set: dates });

	let matchCount = 0;
	for (const [index, day] of outline.days.entries()) {
		if (deadlineMs !== undefined && Date.now() - startedAt > deadlineMs)
			throw new Error(
				`Import timed out after ${index} of ${outline.days.length} days`,
			);
		const dayMatches = await fetchMatchDay(outline, id, day);
		await saveDay(id, dayMatches);
		matchCount += dayMatches.length;
	}
	if (!matchCount)
		throw new Error(
			"No player matches parsed; page structure may have changed",
		);
	await db
		.update(tournaments)
		.set({ lastImportedAt: new Date(), lastError: null })
		.where(eq(tournaments.id, id));
	return {
		id,
		name: outline.name,
		days: outline.days.length,
		matches: matchCount,
	};
}
