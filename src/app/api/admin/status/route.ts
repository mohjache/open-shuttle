import { desc, eq, sql } from "drizzle-orm";
import { canIngest } from "~/server/authz";
import { db } from "~/server/db";
import {
	importJobs,
	ingestionRuns,
	sources,
	tournaments,
} from "~/server/db/schema";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
	if (!(await canIngest(request)))
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	const [sourceRows, tournamentRows, runs, queueCounts, oldestDue, failed] =
		await Promise.all([
			db.select().from(sources),
			db
				.select({
					id: tournaments.id,
					name: tournaments.name,
					lastAttemptAt: tournaments.lastAttemptAt,
					lastImportedAt: tournaments.lastImportedAt,
					lastError: tournaments.lastError,
				})
				.from(tournaments)
				.orderBy(desc(tournaments.lastAttemptAt))
				.limit(50),
			db
				.select()
				.from(ingestionRuns)
				.orderBy(desc(ingestionRuns.startedAt))
				.limit(10),
			db
				.select({
					status: importJobs.status,
					count: sql<number>`count(*)::int`,
				})
				.from(importJobs)
				.groupBy(importJobs.status),
			db
				.select({ runAfter: sql<Date | null>`min(${importJobs.runAfter})` })
				.from(importJobs)
				.where(
					sql`${importJobs.status} = 'pending' AND ${importJobs.runAfter} <= now()`,
				),
			db
				.select({
					tournamentId: importJobs.tournamentId,
					name: tournaments.name,
					attempts: importJobs.attempts,
					lastError: importJobs.lastError,
					updatedAt: importJobs.updatedAt,
				})
				.from(importJobs)
				.innerJoin(tournaments, eq(tournaments.id, importJobs.tournamentId))
				.where(eq(importJobs.status, "failed"))
				.orderBy(desc(importJobs.updatedAt))
				.limit(100),
		]);
	const oldest = oldestDue[0]?.runAfter;
	return Response.json({
		sources: sourceRows,
		tournaments: tournamentRows,
		recentRuns: runs,
		queue: {
			counts: Object.fromEntries(queueCounts.map((r) => [r.status, r.count])),
			// A growing age with an idle worker means the per-minute cron is stalled.
			oldestDueAgeSeconds: oldest
				? Math.round((Date.now() - new Date(oldest).getTime()) / 1000)
				: null,
			failed,
		},
	});
}
