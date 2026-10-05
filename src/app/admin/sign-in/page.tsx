import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { getAdminSession } from "~/server/authz";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in — Open Shuttle" };
export const dynamic = "force-dynamic";

export default async function SignInPage() {
	const session = await getAdminSession();
	if (session.status === "admin") redirect("/admin");

	return (
		<main className="mx-auto flex min-h-screen max-w-md flex-col gap-10 px-5 py-12 sm:px-8">
			<Link
				className="font-mono text-muted-foreground text-sm hover:text-primary"
				href="/"
			>
				← OPEN SHUTTLE
			</Link>
			<header className="flex flex-col gap-4">
				<p className="font-mono text-primary text-xs uppercase tracking-widest">
					Administration
				</p>
				<h1 className="font-heading text-5xl tracking-tight">Sign in.</h1>
			</header>
			<Card>
				<CardHeader>
					<CardTitle>Administrator login</CardTitle>
					<CardDescription>
						{session.status === "unconfigured"
							? "Neon Auth is not configured for this deployment."
							: "Only the configured administrator account can open the admin page."}
					</CardDescription>
				</CardHeader>
				<CardContent>
					{session.status !== "unconfigured" && <SignInForm />}
				</CardContent>
			</Card>
		</main>
	);
}
