import { z } from "zod";
import { canIngest } from "~/server/authz";
import { importTournament, registerTournament } from "~/server/ingest/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
		return Response.json(await importTournament(id));
	} catch (error) {
		return Response.json(
			{ error: error instanceof Error ? error.message : "Import failed" },
			{ status: 502 },
		);
	}
}
