import "server-only";
import { and, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import { db } from "~/server/db";
import {
	matches,
	matchPlayers,
	players,
	tournaments,
} from "~/server/db/schema";

export async function listTournaments(limit = 30, offset = 0) {
	const [items, matchCounts, playerCounts] = await Promise.all([
		db
			.select({
				id: tournaments.id,
				name: tournaments.name,
				url: tournaments.url,
				startsOn: tournaments.startsOn,
				endsOn: tournaments.endsOn,
				lastImportedAt: tournaments.lastImportedAt,
			})
			.from(tournaments)
			.orderBy(desc(tournaments.startsOn))
			.limit(limit)
			.offset(offset),
		db
			.select({
				tournamentId: matches.tournamentId,
				count: sql<number>`count(*)::int`,
			})
			.from(matches)
			.groupBy(matches.tournamentId),
		db
			.select({
				tournamentId: players.tournamentId,
				count: sql<number>`count(*)::int`,
			})
			.from(players)
			.groupBy(players.tournamentId),
	]);
	const matchMap = new Map(
		matchCounts.map((row) => [row.tournamentId, row.count]),
	);
	const playerMap = new Map(
		playerCounts.map((row) => [row.tournamentId, row.count]),
	);
	return items.map((item) => ({
		...item,
		matchCount: matchMap.get(item.id) ?? 0,
		playerCount: playerMap.get(item.id) ?? 0,
	}));
}

export async function listMatches(
	options: {
		tournamentId?: string;
		playerId?: string;
		limit?: number;
		offset?: number;
	} = {},
) {
	const limit = Math.min(Math.max(options.limit ?? 30, 1), 100);
	const offset = Math.max(options.offset ?? 0, 0);
	const where = options.tournamentId
		? eq(matches.tournamentId, options.tournamentId)
		: undefined;
	const rows = options.playerId
		? await db
				.selectDistinct({ match: matches })
				.from(matches)
				.innerJoin(matchPlayers, eq(matchPlayers.matchId, matches.id))
				.where(and(where, eq(matchPlayers.playerId, options.playerId)))
				.orderBy(desc(matches.matchDate), desc(matches.id))
				.limit(limit)
				.offset(offset)
		: await db
				.select({ match: matches })
				.from(matches)
				.where(where)
				.orderBy(desc(matches.matchDate), desc(matches.id))
				.limit(limit)
				.offset(offset);
	const ids = rows.map((row) => row.match.id);
	if (!ids.length) return [];
	const participants = await db
		.select({
			matchId: matchPlayers.matchId,
			side: matchPlayers.side,
			position: matchPlayers.position,
			id: players.id,
			name: players.name,
			profileUrl: players.profileUrl,
		})
		.from(matchPlayers)
		.innerJoin(players, eq(matchPlayers.playerId, players.id))
		.where(inArray(matchPlayers.matchId, ids));
	const byMatch = new Map<string, typeof participants>();
	for (const person of participants) {
		const group = byMatch.get(person.matchId) ?? [];
		group.push(person);
		byMatch.set(person.matchId, group);
	}
	return rows.map(({ match }) => ({
		...match,
		sides: [1, 2].map((side) =>
			(byMatch.get(match.id) ?? [])
				.filter((person) => person.side === side)
				.sort((a, b) => a.position - b.position)
				.map(({ id, name, profileUrl }) => ({ id, name, profileUrl })),
		),
	}));
}

export async function listPlayers(
	options: {
		q?: string;
		tournamentId?: string;
		limit?: number;
		offset?: number;
	} = {},
) {
	return db
		.select({
			id: players.id,
			name: players.name,
			sourcePlayerId: players.sourcePlayerId,
			tournamentId: players.tournamentId,
			profileUrl: players.profileUrl,
			clubId: players.clubId,
		})
		.from(players)
		.where(
			and(
				options.tournamentId
					? eq(players.tournamentId, options.tournamentId)
					: undefined,
				options.q
					? ilike(
							players.name,
							`%${options.q.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`,
						)
					: undefined,
			),
		)
		.orderBy(players.name)
		.limit(Math.min(Math.max(options.limit ?? 30, 1), 100))
		.offset(Math.max(options.offset ?? 0, 0));
}
