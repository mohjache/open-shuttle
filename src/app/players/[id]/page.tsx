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
import { players, tournaments } from "~/server/db/schema";

export const dynamic = "force-dynamic";

export default async function PlayerPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const [record] = await db
		.select({ player: players, tournament: tournaments })
		.from(players)
		.innerJoin(tournaments, eq(players.tournamentId, tournaments.id))
		.where(eq(players.id, id))
		.limit(1);
	if (!record) notFound();
	const matches = await listMatches({ playerId: id, limit: 100 });
	return (
		<main className="min-h-screen bg-background px-5 py-8 text-foreground sm:px-8">
			<div className="mx-auto max-w-5xl">
				<Link
					className="mb-12 inline-flex items-center gap-2 text-muted-foreground text-sm hover:text-foreground"
					href={`/tournaments/${record.tournament.id}`}
				>
					<ArrowLeft className="size-4" /> {record.tournament.name}
				</Link>
				<div className="mb-8 flex flex-wrap items-start justify-between gap-5">
					<div>
						<Badge className="mb-4" variant="outline">
							Player record
						</Badge>
						<h1 className="font-heading font-semibold text-4xl tracking-tight sm:text-5xl">
							{record.player.name}
						</h1>
						<p className="mt-3 text-muted-foreground text-sm">
							Source player ID {record.player.sourcePlayerId} ·{" "}
							{record.tournament.name}
						</p>
					</div>
					<a
						className="inline-flex items-center gap-2 text-primary text-sm hover:underline"
						href={record.player.profileUrl}
						rel="noreferrer"
						target="_blank"
					>
						Original player profile <ArrowUpRight className="size-4" />
					</a>
				</div>
				<Card>
					<CardHeader>
						<CardTitle>Match history</CardTitle>
						<CardDescription>
							{matches.length} matches shown from this tournament
						</CardDescription>
					</CardHeader>
					<CardContent className="px-0">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="pl-5">Date</TableHead>
									<TableHead>Draw</TableHead>
									<TableHead>Opponents</TableHead>
									<TableHead>Score</TableHead>
									<TableHead>Result</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{matches.map((match) => {
									const side =
										match.sides.findIndex((team) =>
											team.some((person) => person.id === id),
										) + 1;
									const opponents = match.sides[side === 1 ? 1 : 0] ?? [];
									return (
										<TableRow key={match.id}>
											<TableCell className="pl-5">
												{match.matchDate ?? "—"}
											</TableCell>
											<TableCell>{match.draw ?? "—"}</TableCell>
											<TableCell>
												{opponents.map((person) => person.name).join(" / ") ||
													"TBC"}
											</TableCell>
											<TableCell className="font-mono">
												{match.score ?? "—"}
											</TableCell>
											<TableCell>
												{match.winnerSide === null
													? "Pending"
													: match.winnerSide === side
														? "Won"
														: "Lost"}
											</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
				<p className="mt-5 text-muted-foreground text-sm">
					Explore the{" "}
					<Link
						className="text-primary underline underline-offset-4"
						href={`/api/v1/players/${encodeURIComponent(id)}`}
					>
						player JSON
					</Link>
					.
				</p>
			</div>
		</main>
	);
}
