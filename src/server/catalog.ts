import "server-only";
import { and, desc, eq, ilike, inArray, ne, sql } from "drizzle-orm";
import { db } from "~/server/db";
import {
	matches,
	matchPlayers,
	persons,
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
		/** Matches involving any of these Players (a Person's appearances). */
		playerIds?: string[];
		limit?: number;
		offset?: number;
	} = {},
) {
	const limit = Math.min(Math.max(options.limit ?? 30, 1), 100);
	const playerIds =
		options.playerIds ?? (options.playerId ? [options.playerId] : undefined);
	const offset = Math.max(options.offset ?? 0, 0);
	const where = options.tournamentId
		? eq(matches.tournamentId, options.tournamentId)
		: undefined;
	const rows = playerIds
		? await db
				.selectDistinct({ match: matches })
				.from(matches)
				.innerJoin(matchPlayers, eq(matchPlayers.matchId, matches.id))
				.where(and(where, inArray(matchPlayers.playerId, playerIds)))
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

/**
 * Players matching the filters. Without a tournament filter, Players linked to
 * the same Person collapse into one row (the most recently updated) carrying
 * how many Tournaments that Person appears in.
 */
export async function listPlayers(
	options: {
		q?: string;
		tournamentId?: string;
		limit?: number;
		offset?: number;
	} = {},
) {
	const where = and(
		options.tournamentId
			? eq(players.tournamentId, options.tournamentId)
			: undefined,
		options.q
			? ilike(
					players.name,
					`%${options.q.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`,
				)
			: undefined,
	);
	const identity = sql`coalesce(${players.personId}, ${players.id})`;
	const distinctPlayers = db
		.selectDistinctOn([identity], {
			id: players.id,
			name: players.name,
			sourcePlayerId: players.sourcePlayerId,
			tournamentId: players.tournamentId,
			profileUrl: players.profileUrl,
			clubId: players.clubId,
			personId: players.personId,
			tournamentCount:
				sql<number>`count(*) over (partition by ${identity})::int`.as(
					"tournament_count",
				),
		})
		.from(players)
		.where(where)
		.orderBy(identity, desc(players.updatedAt))
		.as("distinct_players");
	return db
		.select()
		.from(distinctPlayers)
		.orderBy(distinctPlayers.name, distinctPlayers.id)
		.limit(Math.min(Math.max(options.limit ?? 30, 1), 100))
		.offset(Math.max(options.offset ?? 0, 0));
}

/** The other Players (one per Tournament) that belong to the same Person. */
export async function listOtherAppearances(player: {
	id: string;
	personId: string | null;
}) {
	if (!player.personId) return [];
	return db
		.select({
			id: players.id,
			tournamentId: tournaments.id,
			tournamentName: tournaments.name,
			startsOn: tournaments.startsOn,
		})
		.from(players)
		.innerJoin(tournaments, eq(players.tournamentId, tournaments.id))
		.where(
			and(eq(players.personId, player.personId), ne(players.id, player.id)),
		)
		.orderBy(desc(tournaments.startsOn));
}

/** Persons with the number of Tournaments they appear in, filtered by name. */
export async function listPersons(
	options: { q?: string; limit?: number; offset?: number } = {},
) {
	return db
		.select({
			id: persons.id,
			organizationCode: persons.organizationCode,
			memberId: persons.memberId,
			name: persons.name,
			tournamentCount: sql<number>`count(distinct ${players.tournamentId})::int`,
		})
		.from(persons)
		.innerJoin(players, eq(players.personId, persons.id))
		.where(
			options.q
				? ilike(
						persons.name,
						`%${options.q.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`,
					)
				: undefined,
		)
		.groupBy(persons.id)
		.orderBy(persons.name, persons.id)
		.limit(Math.min(Math.max(options.limit ?? 30, 1), 100))
		.offset(Math.max(options.offset ?? 0, 0));
}

/** A Person with one appearance (Player) per Tournament, newest first. */
export async function getPerson(id: string) {
	const [person] = await db
		.select()
		.from(persons)
		.where(eq(persons.id, id))
		.limit(1);
	if (!person) return null;
	const appearances = await db
		.select({
			playerId: players.id,
			sourcePlayerId: players.sourcePlayerId,
			name: players.name,
			profileUrl: players.profileUrl,
			tournamentId: tournaments.id,
			tournamentName: tournaments.name,
			startsOn: tournaments.startsOn,
		})
		.from(players)
		.innerJoin(tournaments, eq(players.tournamentId, tournaments.id))
		.where(eq(players.personId, id))
		.orderBy(desc(tournaments.startsOn), players.id);
	return { ...person, appearances };
}
