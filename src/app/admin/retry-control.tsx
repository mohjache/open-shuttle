"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";

export function RetryControl({
	tournamentId,
	label,
}: {
	tournamentId?: string;
	label: string;
}) {
	const router = useRouter();
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function retry() {
		setPending(true);
		setError(null);
		try {
			const response = await fetch("/api/admin/retry", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(tournamentId ? { tournamentId } : { all: true }),
			});
			if (!response.ok)
				throw new Error(
					response.status === 401
						? "Your session has expired. Sign in again to continue."
						: "The retry could not be queued.",
				);
			router.refresh();
		} catch (error) {
			setError(error instanceof Error ? error.message : "Retry failed.");
		} finally {
			setPending(false);
		}
	}

	return (
		<div className="flex flex-col items-start gap-1">
			<Button
				disabled={pending}
				onClick={retry}
				size="sm"
				type="button"
				variant="outline"
			>
				{pending && <Spinner data-icon="inline-start" />}
				{label}
			</Button>
			{error && (
				<p className="text-destructive text-xs" role="alert">
					{error}
				</p>
			)}
		</div>
	);
}
