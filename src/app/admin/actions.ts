"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "~/lib/auth/server";

export type SignInState = { error: string | null };

const credentials = z.object({
	email: z.string().trim().email(),
	password: z.string().min(1),
});

export async function signIn(
	_previous: SignInState,
	formData: FormData,
): Promise<SignInState> {
	if (!auth) return { error: "Sign-in is not configured for this deployment." };
	const parsed = credentials.safeParse({
		email: formData.get("email"),
		password: formData.get("password"),
	});
	if (!parsed.success) return { error: "Enter your email and password." };
	const { error } = await auth.signIn.email(parsed.data);
	if (error) return { error: "Incorrect email or password." };
	redirect("/admin");
}

export async function signOut() {
	await auth?.signOut();
	redirect("/admin/sign-in");
}
