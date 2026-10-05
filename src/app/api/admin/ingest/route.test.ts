import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ canIngest: vi.fn(), runIngestion: vi.fn() }));
vi.mock("~/env", () => ({
	env: {
		FACEBOOK_PAGE_ACCESS_TOKEN: "test-token",
		TOURNAMENT_DISCOVERY_QUERY: "Queensland",
	},
}));
vi.mock("~/server/authz", () => ({ canIngest: mocks.canIngest }));
vi.mock("~/server/ingest/pipeline", () => ({
	runIngestion: mocks.runIngestion,
}));

import { POST } from "./route";

beforeEach(() => vi.resetAllMocks());

it("rejects unauthorized callers before invoking ingestion", async () => {
	mocks.canIngest.mockResolvedValue(false);
	const response = await POST(
		new Request("http://localhost/api/admin/ingest", { method: "POST" }),
	);
	expect(response.status).toBe(401);
	expect(mocks.runIngestion).not.toHaveBeenCalled();
});

it("runs the cron ingestion function with server-side options and reports partial results", async () => {
	mocks.canIngest.mockResolvedValue(true);
	const result = {
		runId: 1,
		discovered: 3,
		imported: 1,
		matches: 20,
		errors: ["Source unavailable"],
	};
	mocks.runIngestion.mockResolvedValue(result);
	const response = await POST(
		new Request("http://localhost/api/admin/ingest", { method: "POST" }),
	);
	expect(mocks.runIngestion).toHaveBeenCalledWith({
		facebookToken: "test-token",
		listingQuery: "Queensland",
	});
	expect(response.status).toBe(207);
	expect(await response.json()).toEqual(result);
});

it("returns an actionable failure without exposing database credentials", async () => {
	mocks.canIngest.mockResolvedValue(true);
	mocks.runIngestion.mockRejectedValue(
		new Error("private database connection details"),
	);
	const response = await POST(
		new Request("http://localhost/api/admin/ingest", { method: "POST" }),
	);
	expect(response.status).toBe(503);
	expect(await response.text()).not.toContain("private database");
});
