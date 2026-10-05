import { auth } from "~/lib/auth/server";

const handler = auth?.handler();
const unavailable = () =>
	Response.json({ error: "Neon Auth is not configured" }, { status: 503 });

export const GET = handler?.GET ?? unavailable;
export const POST = handler?.POST ?? unavailable;
export const PUT = handler?.PUT ?? unavailable;
export const PATCH = handler?.PATCH ?? unavailable;
export const DELETE = handler?.DELETE ?? unavailable;
