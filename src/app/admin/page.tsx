import type { Metadata } from "next";
import Link from "next/link";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { IngestionControl } from "./ingestion-control";

export const metadata: Metadata = { title: "Admin — Open Shuttle" };

export default function AdminPage() {
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
					Administration
				</p>
				<h1 className="font-heading text-5xl tracking-tight">
					Refresh the results.
				</h1>
				<p className="text-muted-foreground">
					Run the scheduled ingestion job whenever you need an update.
				</p>
			</header>
			<Card>
				<CardHeader>
					<CardTitle>Run ingestion</CardTitle>
					<CardDescription>
						Discovers tournaments from all enabled sources, then imports up to
						two eligible tournaments. Uses the same job as the daily schedule.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<IngestionControl />
				</CardContent>
			</Card>
			<Link
				className="text-primary text-sm underline underline-offset-4"
				href="/submit"
			>
				Import a specific tournament instead →
			</Link>
		</main>
	);
}
