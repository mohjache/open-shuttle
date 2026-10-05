import { ArrowRight, ArrowUpRight, Database, ShieldCheck } from "lucide-react";
import { unstable_cache } from "next/cache";
import Link from "next/link";
import { AutoRefresh } from "~/app/auto-refresh";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import { listMatches, listTournaments } from "~/server/catalog";

export const dynamic = "force-dynamic";

function formatDate(date: string | null): string {
	if (!date) return "Date TBC";
	return new Intl.DateTimeFormat("en-AU", {
		day: "numeric",
		month: "short",
		year: "numeric",
		timeZone: "Australia/Brisbane",
	}).format(new Date(`${date}T12:00:00Z`));
}

// Shared across visitors, so many open tabs polling cost one query per window.
const loadCatalog = unstable_cache(
	() => Promise.all([listTournaments(1000), listMatches({ limit: 8 })]),
	["landing-catalog"],
	{ revalidate: 30 },
);

export default async function HomePage() {
	const catalog = await loadCatalog().catch(() => null);
	const tournaments = catalog?.[0] ?? [];
	const matches = catalog?.[1] ?? [];
	const matchCount = tournaments.reduce(
		(sum, item) => sum + item.matchCount,
		0,
	);
	const playerCount = tournaments.reduce(
		(sum, item) => sum + item.playerCount,
		0,
	);
	return (
		<main className="min-h-screen bg-background text-foreground">
			<AutoRefresh />
			<div className="mx-auto max-w-7xl px-5 sm:px-8">
				<header className="flex items-center justify-between border-border/70 border-b py-5">
					<Link
						className="flex items-center gap-3 font-semibold tracking-tight"
						href="/"
					>
						<span className="flex size-9 items-center justify-center rounded-xl bg-primary font-bold font-mono text-lg text-primary-foreground">
							S
						</span>
						<span>OPEN SHUTTLE</span>
					</Link>
					<nav className="flex items-center gap-5 text-muted-foreground text-sm">
						<a
							className="transition-colors hover:text-foreground"
							href="#tournaments"
						>
							Tournaments
						</a>
						<a
							className="transition-colors hover:text-foreground"
							href="#matches"
						>
							Results
						</a>
						<a className="transition-colors hover:text-foreground" href="#api">
							API
						</a>
					</nav>
				</header>
			</div>

			<section className="relative overflow-hidden">
				<div className="pointer-events-none absolute inset-x-0 top-0 h-full bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,color-mix(in_oklab,var(--primary)_14%,transparent),transparent)]" />
				<div className="relative mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
					<div className="max-w-4xl">
						<h1 className="font-heading font-semibold text-5xl leading-[1.02] tracking-[-0.06em] sm:text-7xl">
							Every rally has
							<br />
							<span className="text-primary">a data trail.</span>
						</h1>
						<p className="mt-7 max-w-2xl text-lg text-muted-foreground leading-relaxed">
							Tournament results, players, and matches gathered from public
							sources and made available through one clean API.
						</p>
						<div className="mt-9 flex flex-wrap gap-3">
							<Link
								className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 font-medium text-primary-foreground text-sm transition-opacity hover:opacity-80"
								href="#tournaments"
							>
								Explore tournaments <ArrowRight className="size-4" />
							</Link>
							<Link
								className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-4 font-medium text-sm transition-colors hover:bg-muted"
								href="#api"
							>
								View API endpoints <ArrowUpRight className="size-4" />
							</Link>
						</div>
					</div>
				</div>
			</section>

			<div className="mx-auto max-w-7xl px-5 pb-20 sm:px-8">
				<section className="grid grid-cols-1 gap-3 border-border/70 border-y py-5 sm:grid-cols-3">
					{[
						["TOURNAMENTS", tournaments.length],
						["MATCHES", matchCount],
						["PLAYERS", playerCount],
					].map(([label, value]) => (
						<div className="flex items-baseline gap-3" key={label}>
							<strong className="font-medium font-mono text-3xl tabular-nums">
								{value}
							</strong>
							<span className="font-mono text-muted-foreground text-xs tracking-widest">
								{label}
							</span>
						</div>
					))}
				</section>

				<section className="py-16" id="tournaments">
					<div className="mb-7 flex items-end justify-between gap-5">
						<div>
							<p className="mb-2 font-mono text-primary text-xs tracking-[0.2em]">
								01 / THE CIRCUIT
							</p>
							<h2 className="font-heading font-semibold text-3xl tracking-tight sm:text-4xl">
								Tournaments
							</h2>
						</div>
						<Link
							className="text-muted-foreground text-sm hover:text-foreground"
							href="/api/v1/tournaments"
						>
							JSON <ArrowUpRight className="inline size-4" />
						</Link>
					</div>
					{tournaments.length ? (
						<div className="grid gap-3 md:grid-cols-2">
							{tournaments.slice(0, 8).map((tournament, index) => (
								<Link
									className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/50 hover:bg-muted/30"
									href={`/tournaments/${tournament.id}`}
									key={tournament.id}
								>
									<div className="mb-8 flex items-start justify-between">
										<span className="font-mono text-muted-foreground text-xs">
											{String(index + 1).padStart(2, "0")} / TOURNAMENT
										</span>
										<ArrowUpRight className="size-4 text-muted-foreground transition-colors group-hover:text-primary" />
									</div>
									<h3 className="min-h-16 font-heading font-medium text-xl leading-snug">
										{tournament.name}
									</h3>
									<Separator className="my-5" />
									<div className="flex items-center justify-between gap-3 text-muted-foreground text-sm">
										<span>{formatDate(tournament.startsOn)}</span>
										{(tournament.matchCount > 0 ||
											tournament.playerCount > 0) && (
											<span className="font-mono">
												{tournament.matchCount} matches ·{" "}
												{tournament.playerCount} players
											</span>
										)}
									</div>
								</Link>
							))}
						</div>
					) : (
						<Card>
							<CardHeader>
								<CardTitle>
									{catalog
										? "The first tournament is queued"
										: "Database connection needed"}
								</CardTitle>
								<CardDescription>
									{catalog
										? "Run the ingestion job to populate results for the example tournament."
										: "Set DATABASE_URL to a migrated Neon database to show live data."}
								</CardDescription>
							</CardHeader>
							<CardContent>
								<a
									className="text-primary underline underline-offset-4"
									href="https://badminton.tournamentsoftware.com/tournament/ADA99113-FA52-47F3-88D0-D4866C344313"
									rel="noreferrer"
									target="_blank"
								>
									View the example source tournament ↗
								</a>
							</CardContent>
						</Card>
					)}
				</section>

				<section className="py-8" id="matches">
					<div className="mb-7">
						<p className="mb-2 font-mono text-primary text-xs tracking-[0.2em]">
							02 / ON COURT
						</p>
						<h2 className="font-heading font-semibold text-3xl tracking-tight sm:text-4xl">
							Recent matches
						</h2>
					</div>
					<Card>
						<CardContent className="px-0">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className="pl-5">Date / draw</TableHead>
										<TableHead>Side one</TableHead>
										<TableHead>Side two</TableHead>
										<TableHead>Score</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{matches.length ? (
										matches.map((match) => (
											<TableRow key={match.id}>
												<TableCell className="pl-5 text-muted-foreground">
													<span className="block whitespace-nowrap">
														{formatDate(match.matchDate)}
													</span>
													<span className="font-mono text-xs">
														{match.draw ?? "—"}
													</span>
												</TableCell>
												<TableCell
													className={
														match.winnerSide === 1
															? "font-medium text-primary"
															: ""
													}
												>
													{match.sides[0]
														?.map((player) => player.name)
														.join(" / ") || "TBC"}
												</TableCell>
												<TableCell
													className={
														match.winnerSide === 2
															? "font-medium text-primary"
															: ""
													}
												>
													{match.sides[1]
														?.map((player) => player.name)
														.join(" / ") || "TBC"}
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
												colSpan={4}
											>
												Results appear here after the first import.
											</TableCell>
										</TableRow>
									)}
								</TableBody>
							</Table>
						</CardContent>
					</Card>
				</section>

				<section className="grid gap-6 py-16 lg:grid-cols-[1.2fr_1fr]" id="api">
					<Card className="bg-primary text-primary-foreground">
						<CardHeader>
							<Database className="mb-3 size-6" />
							<CardTitle className="font-heading text-3xl">
								Built to be queried.
							</CardTitle>
							<CardDescription className="text-primary-foreground/75">
								Public, read-only JSON endpoints for tournaments, matches,
								players, and persons.
							</CardDescription>
						</CardHeader>
						<CardContent className="flex flex-col gap-3 font-mono text-sm">
							{[
								"/api/v1/tournaments",
								"/api/v1/matches?limit=30",
								"/api/v1/players?q=lee",
								"/api/v1/persons?q=lee",
							].map((path) => (
								<Link
									className="flex items-center justify-between rounded-lg bg-black/15 p-3 hover:bg-black/25"
									href={path}
									key={path}
								>
									<span className="truncate">GET {path}</span>
									<ArrowUpRight className="size-4 shrink-0" />
								</Link>
							))}
						</CardContent>
					</Card>
					<Card>
						<CardHeader>
							<ShieldCheck className="mb-3 size-6 text-primary" />
							<CardTitle className="font-heading text-3xl">
								Traceable sources.
							</CardTitle>
							<CardDescription>
								Every result links back to where it came from.
							</CardDescription>
						</CardHeader>
						<CardContent className="flex flex-col gap-3">
							<a
								className="flex items-center justify-between border-border border-b pb-3 text-sm hover:text-primary"
								href="https://www.tournamentsoftware.com"
								rel="noreferrer"
								target="_blank"
							>
								<span>Tournamentsoftware</span>
								<ArrowUpRight className="size-4" />
							</a>
							<div className="flex items-center justify-between border-border border-b pb-3 text-sm">
								<span>BYO spreadsheet</span>
							</div>
							<Link
								className="flex items-center justify-between text-sm hover:text-primary"
								href="/submit"
							>
								<span>Add a local tournament</span>
								<ArrowRight className="size-4" />
							</Link>
						</CardContent>
					</Card>
				</section>
				<footer className="flex flex-wrap items-center justify-between gap-3 border-border border-t py-7 font-mono text-muted-foreground text-xs">
					<span>OPEN SHUTTLE / COMMUNITY DATA</span>
					<span>Public results · Source attributed</span>
				</footer>
			</div>
		</main>
	);
}
