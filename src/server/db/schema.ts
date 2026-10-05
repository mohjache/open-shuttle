import {
	index,
	pgTableCreator,
	primaryKey,
	uniqueIndex,
} from "drizzle-orm/pg-core";

export const createTable = pgTableCreator((name) => `open-shuttle_${name}`);

export const sources = createTable("source", (d) => ({
	id: d.varchar({ length: 80 }).primaryKey(),
	name: d.varchar({ length: 160 }).notNull(),
	url: d.text().notNull(),
	pageId: d.varchar({ length: 160 }),
	enabled: d.boolean().notNull().default(true),
	lastCheckedAt: d.timestamp({ withTimezone: true }),
	lastError: d.text(),
}));

export const tournaments = createTable("tournament", (d) => ({
	id: d.uuid().primaryKey(),
	name: d.text().notNull(),
	url: d.text().notNull(),
	startsOn: d.date(),
	endsOn: d.date(),
	discoveredAt: d.timestamp({ withTimezone: true }).notNull().defaultNow(),
	lastAttemptAt: d.timestamp({ withTimezone: true }),
	lastImportedAt: d.timestamp({ withTimezone: true }),
	lastError: d.text(),
}));

export const importJobStatuses = [
	"pending",
	"running",
	"done",
	"failed",
] as const;
export type ImportJobStatus = (typeof importJobStatuses)[number];

/** Outbox of Tournament imports; at most one row per Tournament. */
export const importJobs = createTable(
	"import_job",
	(d) => ({
		tournamentId: d
			.uuid()
			.primaryKey()
			.references(() => tournaments.id),
		status: d.varchar({ length: 16 }).notNull().default("pending"),
		runAfter: d.timestamp({ withTimezone: true }).notNull().defaultNow(),
		lockedUntil: d.timestamp({ withTimezone: true }),
		attempts: d.integer().notNull().default(0),
		lastError: d.text(),
		createdAt: d.timestamp({ withTimezone: true }).notNull().defaultNow(),
		updatedAt: d.timestamp({ withTimezone: true }).notNull().defaultNow(),
	}),
	(t) => [index("import_job_status_run_after_idx").on(t.status, t.runAfter)],
);

export const sourcePosts = createTable(
	"source_post",
	(d) => ({
		id: d.text().primaryKey(),
		sourceId: d
			.varchar({ length: 80 })
			.notNull()
			.references(() => sources.id),
		url: d.text().notNull(),
		publishedAt: d.timestamp({ withTimezone: true }),
		text: d.text(),
		discoveredAt: d.timestamp({ withTimezone: true }).notNull().defaultNow(),
	}),
	(t) => [index("source_post_source_idx").on(t.sourceId)],
);

export const tournamentSources = createTable(
	"tournament_source",
	(d) => ({
		tournamentId: d
			.uuid()
			.notNull()
			.references(() => tournaments.id),
		sourcePostId: d
			.text()
			.notNull()
			.references(() => sourcePosts.id),
	}),
	(t) => [primaryKey({ columns: [t.tournamentId, t.sourcePostId] })],
);

export const players = createTable(
	"player",
	(d) => ({
		id: d.text().primaryKey(),
		tournamentId: d
			.uuid()
			.notNull()
			.references(() => tournaments.id),
		sourcePlayerId: d.varchar({ length: 80 }).notNull(),
		name: d.text().notNull(),
		profileUrl: d.text().notNull(),
		clubId: d.varchar({ length: 80 }),
		updatedAt: d.timestamp({ withTimezone: true }).notNull().defaultNow(),
	}),
	(t) => [
		uniqueIndex("player_tournament_source_uidx").on(
			t.tournamentId,
			t.sourcePlayerId,
		),
		index("player_name_idx").on(t.name),
	],
);

export const matches = createTable(
	"match",
	(d) => ({
		id: d.text().primaryKey(),
		tournamentId: d
			.uuid()
			.notNull()
			.references(() => tournaments.id),
		matchDate: d.date(),
		draw: d.text(),
		round: d.text(),
		venue: d.text(),
		score: d.text(),
		winnerSide: d.integer(),
		status: d.varchar({ length: 32 }).notNull().default("scheduled"),
		sourceUrl: d.text().notNull(),
		updatedAt: d.timestamp({ withTimezone: true }).notNull().defaultNow(),
	}),
	(t) => [index("match_tournament_date_idx").on(t.tournamentId, t.matchDate)],
);

export const matchPlayers = createTable(
	"match_player",
	(d) => ({
		matchId: d
			.text()
			.notNull()
			.references(() => matches.id),
		playerId: d
			.text()
			.notNull()
			.references(() => players.id),
		side: d.integer().notNull(),
		position: d.integer().notNull(),
	}),
	(t) => [
		primaryKey({ columns: [t.matchId, t.playerId] }),
		index("match_player_player_idx").on(t.playerId),
	],
);

export const ingestionRuns = createTable("ingestion_run", (d) => ({
	id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
	startedAt: d.timestamp({ withTimezone: true }).notNull().defaultNow(),
	finishedAt: d.timestamp({ withTimezone: true }),
	status: d.varchar({ length: 24 }).notNull().default("running"),
	discovered: d.integer().notNull().default(0),
	imported: d.integer().notNull().default(0),
	matches: d.integer().notNull().default(0),
	error: d.text(),
}));
