import { env } from "~/env";
import { isCronAuthorized } from "~/server/authz";
import { runIngestion } from "~/server/ingest/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
	if (!env.CRON_SECRET)
		return Response.json(
			{ error: "CRON_SECRET is not configured" },
			{ status: 503 },
		);
	if (!isCronAuthorized(request))
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	const result = await runIngestion({
		facebookToken: env.FACEBOOK_PAGE_ACCESS_TOKEN,
		listingQuery: env.TOURNAMENT_DISCOVERY_QUERY,
	});
	return Response.json(result, { status: result.errors.length ? 207 : 200 });
}
