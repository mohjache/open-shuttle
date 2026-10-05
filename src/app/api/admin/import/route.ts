import { z } from "zod";
import { canIngest } from "~/server/authz";
import { registerTournament } from "~/server/ingest/pipeline";
import { enqueueTournamentNow } from "~/server/ingest/queue";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ url: z.string().url() });

export async function POST(request: Request) {
	if (!(await canIngest(request)))
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	const parsed = bodySchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success)
		return Response.json(
			{ error: "Expected { url: tournamentsoftware.com URL }" },
			{ status: 400 },
		);
	try {
		const id = await registerTournament(parsed.data.url);
		await enqueueTournamentNow(id);
		return Response.json({ id, queued: true }, { status: 202 });
	} catch (error) {
		return Response.json(
			{ error: error instanceof Error ? error.message : "Queueing failed" },
			{ status: 502 },
		);
	}
}
