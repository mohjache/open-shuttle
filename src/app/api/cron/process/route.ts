import { env } from "~/env";
import { isCronAuthorized } from "~/server/authz";
import { processNextImportJob } from "~/server/ingest/queue";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Called every minute by Vercel Cron; imports at most one due Tournament. */
export async function GET(request: Request) {
	if (!env.CRON_SECRET)
		return Response.json(
			{ error: "CRON_SECRET is not configured" },
			{ status: 503 },
		);
	if (!isCronAuthorized(request))
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	try {
		return Response.json(await processNextImportJob());
	} catch {
		return Response.json({ error: "Worker unavailable" }, { status: 503 });
	}
}
