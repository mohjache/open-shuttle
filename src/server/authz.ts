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

export type AdminSession =
	| { status: "unconfigured" }
	| { status: "anonymous" }
	| { status: "forbidden"; email: string }
	| { status: "admin"; email: string };

/** Resolves the Neon Auth browser session against the single ADMIN_EMAIL. */
export async function getAdminSession(): Promise<AdminSession> {
	if (!auth || !env.ADMIN_EMAIL) return { status: "unconfigured" };
	const { data } = await auth.getSession();
	const email = data?.user?.email;
	if (!email) return { status: "anonymous" };
	return email.toLowerCase() === env.ADMIN_EMAIL.toLowerCase()
		? { status: "admin", email }
		: { status: "forbidden", email };
}

export async function canIngest(request: Request): Promise<boolean> {
	if (equalSecret(request.headers.get("authorization"), env.INGEST_API_KEY))
		return true;
	return (await getAdminSession()).status === "admin";
}

export function isCronAuthorized(request: Request): boolean {
	return equalSecret(request.headers.get("authorization"), env.CRON_SECRET);
}
