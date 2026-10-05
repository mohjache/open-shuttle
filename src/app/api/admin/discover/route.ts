import { env } from "~/env";
import { canIngest } from "~/server/authz";
import {
	discoverFromTournamentListings,
	ensureSeedData,
} from "~/server/ingest/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
	if (!(await canIngest(request)))
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	try {
		await ensureSeedData();
		const result = await discoverFromTournamentListings(
			env.TOURNAMENT_DISCOVERY_QUERY,
		);
		return Response.json(result, { status: result.errors.length ? 207 : 200 });
	} catch (error) {
		return Response.json(
			{ error: error instanceof Error ? error.message : "Discovery failed" },
			{ status: 502 },
		);
	}
}
