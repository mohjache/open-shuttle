import { env } from "~/env";
import { canIngest } from "~/server/authz";
import { runIngestion } from "~/server/ingest/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
	if (!(await canIngest(request)))
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	try {
		const result = await runIngestion({
			facebookToken:
				env.FACEBOOK_DISCOVERY_ENABLED === "true"
					? env.FACEBOOK_PAGE_ACCESS_TOKEN
					: undefined,
			listingQuery: env.TOURNAMENT_DISCOVERY_QUERY,
		});
		return Response.json(result, { status: result.errors.length ? 207 : 200 });
	} catch {
		return Response.json(
			{
				error:
					"Could not start ingestion. Check the database connection and migrations.",
			},
			{ status: 503 },
		);
	}
}
