import { z } from "zod";
import { listTournaments } from "~/server/catalog";

export const dynamic = "force-dynamic";

const querySchema = z.object({
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
		data: await listTournaments(parsed.data.limit, parsed.data.offset),
		pagination: parsed.data,
	});
}
