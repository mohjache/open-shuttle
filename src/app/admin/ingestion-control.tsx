"use client";

import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";

type Result = {
	runId: number;
	discovered: number;
	imported: number;
	matches: number;
	errors: string[];
};

function isResult(value: unknown): value is Result {
	if (!value || typeof value !== "object") return false;
	const data = value as Record<string, unknown>;
	return (
		["runId", "discovered", "imported", "matches"].every(
			(key) => typeof data[key] === "number",
		) &&
		Array.isArray(data.errors) &&
		data.errors.every((error) => typeof error === "string")
	);
}

export function IngestionControl() {
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [result, setResult] = useState<Result | null>(null);

	async function run(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setPending(true);
		setError(null);
		setResult(null);
		try {
			const response = await fetch("/api/admin/ingest", {
				method: "POST",
				signal: AbortSignal.timeout(65_000),
			});
			if (response.status === 401)
				throw new Error("Your session has expired. Sign in again to continue.");
			const data = await response.json();
			if (!response.ok)
				throw new Error(
					typeof data.error === "string"
						? data.error
						: "The job could not be started.",
				);
			if (!isResult(data))
				throw new Error(
					"The job returned an unexpected response. Check ingestion status before retrying.",
				);
			setResult(data);
		} catch (error) {
			setError(
				error instanceof Error && error.name !== "TimeoutError"
					? error.message
					: "No completion response was received. The job may still be running; check ingestion status before retrying.",
			);
		} finally {
			setPending(false);
		}
	}

	return (
		<form className="flex flex-col gap-6" onSubmit={run}>
			<Button disabled={pending} type="submit">
				{pending && <Spinner data-icon="inline-start" />}
				{pending ? "Running ingestion…" : "Run ingestion now"}
			</Button>
			<div aria-live="polite">
				{error && (
					<Alert variant="destructive">
						<AlertTitle>Unable to confirm completion</AlertTitle>
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}
				{result && (
					<Alert variant={result.errors.length ? "destructive" : "default"}>
						<AlertTitle>
							{result.errors.length
								? "Completed with issues"
								: "Ingestion complete"}{" "}
							· Run {result.runId}
						</AlertTitle>
						<AlertDescription>
							<p>
								{result.discovered} new tournaments discovered ·{" "}
								{result.imported} tournaments imported · {result.matches}{" "}
								matches processed.
							</p>
							{result.errors.length > 0 && (
								<ul className="list-disc pl-4">
									{[...new Set(result.errors)].map((message) => (
										<li key={message}>{message}</li>
									))}
								</ul>
							)}
						</AlertDescription>
					</Alert>
				)}
			</div>
		</form>
	);
}
