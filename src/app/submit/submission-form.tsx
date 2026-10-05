"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Spinner } from "~/components/ui/spinner";

export function TournamentSubmission() {
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [result, setResult] = useState<{
		id: string;
		name: string;
		matches: number;
	} | null>(null);

	async function submit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = event.currentTarget;
		const values = new FormData(form);
		const key = String(values.get("key") ?? "").trim();
		setPending(true);
		setError(null);
		setResult(null);
		try {
			const response = await fetch("/api/admin/import", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...(key ? { Authorization: `Bearer ${key}` } : {}),
				},
				body: JSON.stringify({ url: String(values.get("url") ?? "").trim() }),
				signal: AbortSignal.timeout(65_000),
			});
			const data = await response.json();
			if (response.status === 401)
				throw new Error(
					"Enter a valid admin access key, or sign in with an authorized administrator session.",
				);
			if (!response.ok)
				throw new Error(
					typeof data.error === "string"
						? data.error
						: "Import failed. Please try again.",
				);
			if (
				typeof data.id !== "string" ||
				typeof data.name !== "string" ||
				typeof data.matches !== "number"
			)
				throw new Error("The importer returned an unexpected response.");
			setResult({ id: data.id, name: data.name, matches: data.matches });
		} catch (error) {
			setError(
				error instanceof Error
					? error.message
					: "Import failed. Please try again.",
			);
		} finally {
			const keyInput = form.elements.namedItem("key");
			if (keyInput instanceof HTMLInputElement) keyInput.value = "";
			setPending(false);
		}
	}

	return (
		<form className="flex flex-col gap-6" onSubmit={submit}>
			<FieldGroup>
				<Field data-disabled={pending}>
					<FieldLabel htmlFor="tournament-url">
						Tournamentsoftware URL
					</FieldLabel>
					<Input
						disabled={pending}
						id="tournament-url"
						name="url"
						placeholder="https://ba.tournamentsoftware.com/tournament/…"
						required
						type="url"
					/>
					<FieldDescription>
						Australian and international tournament links are supported.
					</FieldDescription>
				</Field>
				<Field data-disabled={pending}>
					<FieldLabel htmlFor="admin-key">Admin access key</FieldLabel>
					<Input
						autoComplete="off"
						disabled={pending}
						id="admin-key"
						name="key"
						type="password"
					/>
					<FieldDescription>
						Optional if you already have an authorized admin session. The key is
						cleared after each attempt.
					</FieldDescription>
				</Field>
			</FieldGroup>
			<Button disabled={pending} type="submit">
				{pending && <Spinner data-icon="inline-start" />}
				{pending ? "Importing results…" : "Import tournament"}
			</Button>
			<div aria-live="polite">
				{error && (
					<Alert variant="destructive">
						<AlertTitle>Import failed</AlertTitle>
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}
				{result && (
					<Alert>
						<AlertTitle>{result.name}</AlertTitle>
						<AlertDescription>
							{result.matches} matches imported.{" "}
							<Link
								className="underline"
								href={`/tournaments/${encodeURIComponent(result.id)}`}
							>
								View tournament
							</Link>
						</AlertDescription>
					</Alert>
				)}
			</div>
		</form>
	);
}
