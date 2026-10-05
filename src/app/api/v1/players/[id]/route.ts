import { eq } from "drizzle-orm";
import { listMatches, listOtherAppearances } from "~/server/catalog";
import { db } from "~/server/db";
import { players } from "~/server/db/schema";

export const dynamic = "force-dynamic";

export async function GET(
	_request: Request,
	context: { params: Promise<{ id: string }> },
) {
	const { id } = await context.params;
	const [player] = await db
		.select()
		.from(players)
		.where(eq(players.id, id))
		.limit(1);
	if (!player)
		return Response.json({ error: "Player not found" }, { status: 404 });
	return Response.json({
		data: {
			...player,
			matches: await listMatches({ playerId: id, limit: 100 }),
			otherAppearances: await listOtherAppearances(player),
		},
	});
}
