import { desc } from "drizzle-orm";
import { canIngest } from "~/server/authz";
import { db } from "~/server/db";
import { ingestionRuns, sources, tournaments } from "~/server/db/schema";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
	if (!(await canIngest(request)))
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	const [sourceRows, tournamentRows, runs] = await Promise.all([
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
	]);
	return Response.json({
		sources: sourceRows,
		tournaments: tournamentRows,
		recentRuns: runs,
	});
}
