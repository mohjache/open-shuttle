import { z } from "zod";
import { canIngest } from "~/server/authz";
import { retryImportJobs } from "~/server/ingest/queue";

export const dynamic = "force-dynamic";

const bodySchema = z.union([
	z.object({ tournamentId: z.string().uuid() }),
	z.object({ all: z.literal(true) }),
]);

/** Re-queues failed imports for one Tournament, or every failed import. */
export async function POST(request: Request) {
	if (!(await canIngest(request)))
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	const parsed = bodySchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success)
		return Response.json(
			{ error: "Expected { tournamentId: uuid } or { all: true }" },
			{ status: 400 },
		);
	try {
		return Response.json({ requeued: await retryImportJobs(parsed.data) });
	} catch {
		return Response.json({ error: "Retry unavailable" }, { status: 503 });
	}
}
