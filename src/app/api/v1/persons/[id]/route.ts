import { getPerson, listMatches } from "~/server/catalog";

export const dynamic = "force-dynamic";

export async function GET(
	_request: Request,
	context: { params: Promise<{ id: string }> },
) {
	const { id } = await context.params;
	const person = await getPerson(id);
	if (!person)
		return Response.json({ error: "Person not found" }, { status: 404 });
	return Response.json({
		data: {
			...person,
			matches: await listMatches({
				playerIds: person.appearances.map((appearance) => appearance.playerId),
				limit: 100,
			}),
		},
	});
}
