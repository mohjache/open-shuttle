import "server-only";
import { timingSafeEqual } from "node:crypto";
import { env } from "~/env";
import { auth } from "~/lib/auth/server";

function equalSecret(
	received: string | null,
	expected: string | undefined,
): boolean {
	if (!received || !expected) return false;
	const a = Buffer.from(received);
	const b = Buffer.from(`Bearer ${expected}`);
	return a.length === b.length && timingSafeEqual(a, b);
}

export async function canIngest(request: Request): Promise<boolean> {
	if (equalSecret(request.headers.get("authorization"), env.INGEST_API_KEY))
		return true;
	if (!auth || !env.ADMIN_EMAIL) return false;
	const { data } = await auth.getSession();
	return data?.user?.email?.toLowerCase() === env.ADMIN_EMAIL.toLowerCase();
}

export function isCronAuthorized(request: Request): boolean {
	return equalSecret(request.headers.get("authorization"), env.CRON_SECRET);
}
