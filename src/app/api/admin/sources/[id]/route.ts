import { eq } from "drizzle-orm";
import { z } from "zod";
import { canIngest } from "~/server/authz";
import { db } from "~/server/db";
import { sources } from "~/server/db/schema";

export const dynamic = "force-dynamic";

const bodySchema = z
	.object({
		pageId: z.string().min(1).max(160).optional(),
		enabled: z.boolean().optional(),
	})
	.refine((value) => value.pageId !== undefined || value.enabled !== undefined);

export async function PATCH(
	request: Request,
	context: { params: Promise<{ id: string }> },
) {
	if (!(await canIngest(request)))
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	const parsed = bodySchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success)
		return Response.json(
			{ error: "Expected pageId and/or enabled" },
			{ status: 400 },
		);
	const { id } = await context.params;
	const [source] = await db
		.update(sources)
		.set(parsed.data)
		.where(eq(sources.id, id))
		.returning();
	if (!source)
		return Response.json({ error: "Source not found" }, { status: 404 });
	return Response.json({ data: source });
}
