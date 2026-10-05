import { z } from "zod";
import { listMatches } from "~/server/catalog";

export const dynamic = "force-dynamic";

const querySchema = z.object({
	tournamentId: z.string().uuid().optional(),
	playerId: z.string().optional(),
	limit: z.coerce.number().int().min(1).max(100).default(30),
	offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(request: Request) {
	const parsed = querySchema.safeParse(
		Object.fromEntries(new URL(request.url).searchParams),
	);
	if (!parsed.success)
		return Response.json(
			{ error: "Invalid query parameters" },
			{ status: 400 },
		);
	return Response.json({
		data: await listMatches(parsed.data),
		pagination: { limit: parsed.data.limit, offset: parsed.data.offset },
	});
}
