import { desc, eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { getAdminSession } from "~/server/authz";
import { db } from "~/server/db";
import { importJobs, tournaments } from "~/server/db/schema";
import { signOut } from "./actions";
import { IngestionControl } from "./ingestion-control";
import { RetryControl } from "./retry-control";

export const metadata: Metadata = { title: "Admin — Open Shuttle" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
	const session = await getAdminSession();
	if (session.status === "unconfigured" || session.status === "anonymous")
		redirect("/admin/sign-in");
	if (session.status === "forbidden")
		return (
			<main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-5 py-12 sm:px-8">
				<h1 className="font-heading text-4xl tracking-tight">No access.</h1>
				<p className="text-muted-foreground">
					{session.email} is not the administrator account for this site.
				</p>
				<form action={signOut}>
					<Button type="submit" variant="outline">
						Sign out
					</Button>
				</form>
			</main>
		);

	const [queueCounts, failed] = await Promise.all([
		db
			.select({
				status: importJobs.status,
				count: sql<number>`count(*)::int`,
			})
			.from(importJobs)
			.groupBy(importJobs.status),
		db
			.select({
				tournamentId: importJobs.tournamentId,
				name: tournaments.name,
				lastError: importJobs.lastError,
			})
			.from(importJobs)
			.innerJoin(tournaments, eq(tournaments.id, importJobs.tournamentId))
			.where(eq(importJobs.status, "failed"))
			.orderBy(desc(importJobs.updatedAt))
			.limit(50),
	]).catch(() => [[], []] as const);
	const counts = Object.fromEntries(
		queueCounts.map((r) => [r.status, r.count]),
	);

	return (
		<main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-10 px-5 py-12 sm:px-8">
			<div className="flex items-center justify-between">
				<Link
					className="font-mono text-muted-foreground text-sm hover:text-primary"
					href="/"
				>
					← OPEN SHUTTLE
				</Link>
				<form action={signOut}>
					<Button size="sm" type="submit" variant="ghost">
						Sign out
					</Button>
				</form>
			</div>
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
						Discovers tournaments from all enabled sources and queues an import
						for each new one. Uses the same job as the daily schedule; a worker
						then imports one finished tournament per minute.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<IngestionControl />
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle>Import queue</CardTitle>
					<CardDescription>
						{counts.pending ?? 0} pending · {counts.running ?? 0} running ·{" "}
						{counts.done ?? 0} done · {counts.failed ?? 0} failed. Failed
						imports are never retried automatically.
					</CardDescription>
				</CardHeader>
				{failed.length > 0 && (
					<CardContent className="flex flex-col gap-4">
						<RetryControl label="Retry all failed" />
						<ul className="flex flex-col gap-4">
							{failed.map((job) => (
								<li
									className="flex items-start justify-between gap-4 border-border border-t pt-4"
									key={job.tournamentId}
								>
									<div className="flex min-w-0 flex-col gap-1">
										<span className="font-medium text-sm">{job.name}</span>
										<span className="break-words text-muted-foreground text-xs">
											{job.lastError}
										</span>
									</div>
									<RetryControl label="Retry" tournamentId={job.tournamentId} />
								</li>
							))}
						</ul>
					</CardContent>
				)}
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
