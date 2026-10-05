import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "~/server/db";
import { importJobs, tournaments } from "~/server/db/schema";
import { importTournament } from "./import-tournament";
import { brisbaneToday } from "./listing";

/** Time budget for one import; the worker route allows 60 seconds. */
export const IMPORT_DEADLINE_MS = 50_000;
const LOCK_SECONDS = 120;

type Executor = Pick<typeof db, "execute">;

/**
 * Queues every Tournament that was never imported, or was imported before it
 * finished. A job becomes due the day after the last day in Brisbane time
 * (immediately when the dates are unknown). Idempotent: one job per Tournament.
 * The migration backfill in drizzle/0002 mirrors this statement.
 */
export async function enqueueMissingImportJobs(
	executor: Executor = db,
): Promise<number> {
	const rows = await executor.execute(sql`
		INSERT INTO "open-shuttle_import_job" ("tournamentId", "runAfter")
		SELECT t."id", COALESCE((t."endsOn" + 1)::timestamp AT TIME ZONE 'Australia/Brisbane', now())
		FROM "open-shuttle_tournament" t
		WHERE t."lastImportedAt" IS NULL
			OR (t."endsOn" IS NOT NULL AND t."lastImportedAt" < (t."endsOn" + 1)::timestamp AT TIME ZONE 'Australia/Brisbane')
		ON CONFLICT DO NOTHING
		RETURNING "tournamentId"
	`);
	return rows.length;
}

/** Queues one Tournament for an immediate (manual) import. */
export async function enqueueTournamentNow(id: string): Promise<void> {
	await db
		.insert(importJobs)
		.values({ tournamentId: id })
		.onConflictDoUpdate({
			target: importJobs.tournamentId,
			set: {
				status: "pending",
				runAfter: sql`now()`,
				lastError: null,
				updatedAt: sql`now()`,
			},
			// A running import already holds the Tournament.
			setWhere: sql`${importJobs.status} <> 'running'`,
		});
}

/** Puts failed jobs back in the queue: one Tournament, or all failed jobs. */
export async function retryImportJobs(
	target: { tournamentId: string } | { all: true },
): Promise<number> {
	const where =
		"all" in target
			? sql`${importJobs.status} = 'failed'`
			: sql`${importJobs.tournamentId} = ${target.tournamentId} AND ${importJobs.status} IN ('failed', 'done')`;
	const rows = await db
		.update(importJobs)
		.set({
			status: "pending",
			runAfter: sql`now()`,
			lastError: null,
			updatedAt: sql`now()`,
		})
		.where(where)
		.returning({ tournamentId: importJobs.tournamentId });
	return rows.length;
}

/** A lock that outlived its worker means the import died mid-run. */
async function failLostJobs(): Promise<void> {
	const lost = await db
		.update(importJobs)
		.set({
			status: "failed",
			lastError: "Worker lost mid-import (lock expired)",
			lockedUntil: null,
			updatedAt: sql`now()`,
		})
		.where(
			sql`${importJobs.status} = 'running' AND ${importJobs.lockedUntil} < now()`,
		)
		.returning({ tournamentId: importJobs.tournamentId });
	for (const { tournamentId } of lost)
		await db
			.update(tournaments)
			.set({ lastAttemptAt: new Date(), lastError: "Worker lost mid-import" })
			.where(eq(tournaments.id, tournamentId));
}

async function claimNextJob(): Promise<string | null> {
	const rows = await db.execute<{ tournamentId: string }>(sql`
		UPDATE "open-shuttle_import_job"
		SET "status" = 'running',
			"lockedUntil" = now() + make_interval(secs => ${LOCK_SECONDS}),
			"attempts" = "attempts" + 1,
			"updatedAt" = now()
		WHERE "tournamentId" = (
			SELECT "tournamentId" FROM "open-shuttle_import_job"
			WHERE "status" = 'pending' AND "runAfter" <= now()
			ORDER BY "runAfter", "tournamentId"
			FOR UPDATE SKIP LOCKED
			LIMIT 1
		)
		RETURNING "tournamentId"
	`);
	return rows[0]?.tournamentId ?? null;
}

export type WorkerResult =
	| { status: "idle" }
	| { status: "done"; tournamentId: string; days: number; matches: number }
	| { status: "failed"; tournamentId: string; error: string };

/** Processes at most one due import job. Called once a minute by cron. */
export async function processNextImportJob(): Promise<WorkerResult> {
	await failLostJobs();
	const tournamentId = await claimNextJob();
	if (!tournamentId) return { status: "idle" };
	try {
		const result = await importTournament(tournamentId, {
			deadlineMs: IMPORT_DEADLINE_MS,
			today: brisbaneToday(),
		});
		await db
			.update(importJobs)
			.set({
				status: "done",
				lastError: null,
				lockedUntil: null,
				updatedAt: sql`now()`,
			})
			.where(eq(importJobs.tournamentId, tournamentId));
		return {
			status: "done",
			tournamentId,
			days: result.days,
			matches: result.matches,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		await db
			.update(importJobs)
			.set({
				status: "failed",
				lastError: message,
				lockedUntil: null,
				updatedAt: sql`now()`,
			})
			.where(eq(importJobs.tournamentId, tournamentId));
		await db
			.update(tournaments)
			.set({ lastAttemptAt: new Date(), lastError: message })
			.where(eq(tournaments.id, tournamentId));
		return { status: "failed", tournamentId, error: message };
	}
}
