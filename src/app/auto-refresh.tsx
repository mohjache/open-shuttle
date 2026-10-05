"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Re-runs the page's server component on a timer so new results appear
 * without a reload. Polls only while the tab is visible, and refreshes
 * straight away when the tab becomes visible again.
 */
export function AutoRefresh({ intervalMs = 60_000 }: { intervalMs?: number }) {
	const router = useRouter();

	useEffect(() => {
		let timer: ReturnType<typeof setInterval> | undefined;
		const stop = () => {
			if (timer !== undefined) clearInterval(timer);
			timer = undefined;
		};
		const start = () => {
			stop();
			timer = setInterval(() => router.refresh(), intervalMs);
		};
		const onVisibility = () => {
			if (document.visibilityState === "visible") {
				router.refresh();
				start();
			} else stop();
		};
		if (document.visibilityState === "visible") start();
		document.addEventListener("visibilitychange", onVisibility);
		return () => {
			stop();
			document.removeEventListener("visibilitychange", onVisibility);
		};
	}, [router, intervalMs]);

	return null;
}
