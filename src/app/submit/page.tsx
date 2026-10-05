import type { Metadata } from "next";
import Link from "next/link";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { TournamentSubmission } from "./submission-form";

export const metadata: Metadata = { title: "Add a tournament — Open Shuttle" };

export default function SubmitPage() {
	return (
		<main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-10 px-5 py-12 sm:px-8">
			<Link
				className="font-mono text-muted-foreground text-sm hover:text-primary"
				href="/"
			>
				← OPEN SHUTTLE
			</Link>
			<header className="flex flex-col gap-4">
				<p className="font-mono text-primary text-xs uppercase tracking-widest">
					Community results
				</p>
				<h1 className="font-heading text-5xl tracking-tight">
					Add a tournament.
				</h1>
				<p className="max-w-lg text-muted-foreground">
					Found a local event? Import its public Tournamentsoftware results
					here. Imports are queued and processed one at a time.
				</p>
			</header>
			<Card>
				<CardHeader>
					<CardTitle>Tournament link</CardTitle>
					<CardDescription>
						Imports require administrator access. Results become available in
						the public catalog, with links to their source.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<TournamentSubmission />
				</CardContent>
			</Card>
		</main>
	);
}
