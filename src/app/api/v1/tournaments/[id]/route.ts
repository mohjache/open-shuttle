import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { listMatches } from "~/server/catalog";
import { db } from "~/server/db";
import {
	sourcePosts,
	sources,
	tournamentSources,
	tournaments,
} from "~/server/db/schema";

export const dynamic = "force-dynamic";

export async function GET(
	_request: Request,
	context: { params: Promise<{ id: string }> },
) {
	const { id } = await context.params;
	if (!z.string().uuid().safeParse(id).success)
		return Response.json({ error: "Invalid tournament ID" }, { status: 400 });
	const [tournament] = await db
		.select()
		.from(tournaments)
		.where(eq(tournaments.id, id))
		.limit(1);
	if (!tournament)
		return Response.json({ error: "Tournament not found" }, { status: 404 });
	const [matchList, discoveredFrom] = await Promise.all([
		listMatches({ tournamentId: id, limit: 100 }),
		db
			.select({
				source: sources.name,
				sourceUrl: sources.url,
				postUrl: sourcePosts.url,
				publishedAt: sourcePosts.publishedAt,
			})
			.from(tournamentSources)
			.innerJoin(
				sourcePosts,
				eq(tournamentSources.sourcePostId, sourcePosts.id),
			)
			.innerJoin(sources, eq(sourcePosts.sourceId, sources.id))
			.where(eq(tournamentSources.tournamentId, id))
			.orderBy(desc(sourcePosts.publishedAt)),
	]);
	return Response.json({
		data: { ...tournament, discoveredFrom, matches: matchList },
		pagination: {
			matchesLimit: 100,
			next:
				matchList.length === 100
					? `/api/v1/matches?tournamentId=${id}&offset=100`
					: null,
		},
	});
}
