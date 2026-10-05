import { eq } from "drizzle-orm";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "~/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import { listMatches } from "~/server/catalog";
import { db } from "~/server/db";
import { tournaments } from "~/server/db/schema";

export const dynamic = "force-dynamic";

export default async function TournamentPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const [tournament] = await db
		.select()
		.from(tournaments)
		.where(eq(tournaments.id, id))
		.limit(1);
	if (!tournament) notFound();
	const matches = await listMatches({ tournamentId: id, limit: 100 });
	return (
		<main className="min-h-screen bg-background px-5 py-8 text-foreground sm:px-8">
			<div className="mx-auto max-w-6xl">
				<Link
					className="mb-12 inline-flex items-center gap-2 text-muted-foreground text-sm hover:text-foreground"
					href="/"
				>
					<ArrowLeft className="size-4" /> Open Shuttle
				</Link>
				<div className="mb-8 flex flex-wrap items-start justify-between gap-5">
					<div>
						<Badge className="mb-4" variant="outline">
							Tournament
						</Badge>
						<h1 className="max-w-4xl font-heading font-semibold text-4xl tracking-tight sm:text-5xl">
							{tournament.name}
						</h1>
						<p className="mt-3 text-muted-foreground text-sm">
							{tournament.startsOn ?? "Date TBC"} —{" "}
							{tournament.endsOn ?? "Date TBC"}
						</p>
					</div>
					<a
						className="inline-flex items-center gap-2 text-primary text-sm hover:underline"
						href={tournament.url}
						rel="noreferrer"
						target="_blank"
					>
						Original results <ArrowUpRight className="size-4" />
					</a>
				</div>
				<Card>
					<CardHeader>
						<CardTitle>Matches</CardTitle>
						<CardDescription>
							{matches.length} shown ·{" "}
							{tournament.lastImportedAt
								? `Last imported ${tournament.lastImportedAt.toLocaleString("en-AU", { timeZone: "Australia/Brisbane" })}`
								: "Awaiting first import"}
						</CardDescription>
					</CardHeader>
					<CardContent className="px-0">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="pl-5">Date</TableHead>
									<TableHead>Draw / round</TableHead>
									<TableHead>Side one</TableHead>
									<TableHead>Side two</TableHead>
									<TableHead>Score</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{matches.length ? (
									matches.map((match) => (
										<TableRow key={match.id}>
											<TableCell className="pl-5">
												{match.matchDate ?? "—"}
											</TableCell>
											<TableCell>
												<span className="block">{match.draw ?? "—"}</span>
												<span className="text-muted-foreground text-xs">
													{match.round}
												</span>
											</TableCell>
											<TableCell
												className={
													match.winnerSide === 1
														? "font-medium text-primary"
														: ""
												}
											>
												{match.sides[0]?.map((player) => (
													<Link
														className="block hover:underline"
														href={`/players/${encodeURIComponent(player.id)}`}
														key={player.id}
													>
														{player.name}
													</Link>
												))}
											</TableCell>
											<TableCell
												className={
													match.winnerSide === 2
														? "font-medium text-primary"
														: ""
												}
											>
												{match.sides[1]?.map((player) => (
													<Link
														className="block hover:underline"
														href={`/players/${encodeURIComponent(player.id)}`}
														key={player.id}
													>
														{player.name}
													</Link>
												))}
											</TableCell>
											<TableCell className="font-mono">
												{match.score ?? "—"}
											</TableCell>
										</TableRow>
									))
								) : (
									<TableRow>
										<TableCell
											className="py-12 text-center text-muted-foreground"
											colSpan={5}
										>
											No results have been imported yet.
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
				<p className="mt-5 text-muted-foreground text-sm">
					Explore the{" "}
					<Link
						className="text-primary underline underline-offset-4"
						href={`/api/v1/tournaments/${id}`}
					>
						tournament JSON
					</Link>
					.
				</p>
			</div>
		</main>
	);
}
