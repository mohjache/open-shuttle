import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	refresh: vi.fn(),
	cleanups: [] as (() => void)[],
}));
vi.mock("next/navigation", () => ({
	useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("react", () => ({
	useEffect: (effect: () => (() => void) | undefined) => {
		const cleanup = effect();
		if (cleanup) mocks.cleanups.push(cleanup);
	},
}));

import { AutoRefresh } from "./auto-refresh";

let visibility: "visible" | "hidden";
let listeners: Map<string, () => void>;

function setVisibility(next: "visible" | "hidden") {
	visibility = next;
	listeners.get("visibilitychange")?.();
}

beforeEach(() => {
	vi.useFakeTimers();
	visibility = "visible";
	listeners = new Map();
	mocks.refresh.mockReset();
	mocks.cleanups.length = 0;
	vi.stubGlobal("document", {
		get visibilityState() {
			return visibility;
		},
		addEventListener: (type: string, fn: () => void) => listeners.set(type, fn),
		removeEventListener: (type: string) => listeners.delete(type),
	});
});
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

it("refreshes once per interval while the tab is visible", () => {
	AutoRefresh({ intervalMs: 60_000 });
	vi.advanceTimersByTime(59_999);
	expect(mocks.refresh).not.toHaveBeenCalled();
	vi.advanceTimersByTime(1);
	expect(mocks.refresh).toHaveBeenCalledTimes(1);
	vi.advanceTimersByTime(120_000);
	expect(mocks.refresh).toHaveBeenCalledTimes(3);
});

it("stops polling while hidden and refreshes immediately when shown again", () => {
	AutoRefresh({ intervalMs: 60_000 });
	setVisibility("hidden");
	vi.advanceTimersByTime(300_000);
	expect(mocks.refresh).not.toHaveBeenCalled();
	setVisibility("visible");
	expect(mocks.refresh).toHaveBeenCalledTimes(1);
	vi.advanceTimersByTime(60_000);
	expect(mocks.refresh).toHaveBeenCalledTimes(2);
});

it("does not start polling when mounted in a hidden tab", () => {
	visibility = "hidden";
	AutoRefresh({ intervalMs: 60_000 });
	vi.advanceTimersByTime(300_000);
	expect(mocks.refresh).not.toHaveBeenCalled();
});

it("cleans up its timer and listener on unmount", () => {
	AutoRefresh({ intervalMs: 60_000 });
	for (const cleanup of mocks.cleanups) cleanup();
	vi.advanceTimersByTime(300_000);
	expect(mocks.refresh).not.toHaveBeenCalled();
	expect(listeners.has("visibilitychange")).toBe(false);
});
