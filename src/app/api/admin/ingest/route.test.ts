import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	canIngest: vi.fn(),
	runIngestion: vi.fn(),
	isCronAuthorized: vi.fn(),
	config: {
		FACEBOOK_DISCOVERY_ENABLED: "true",
		FACEBOOK_PAGE_ACCESS_TOKEN: "test-token",
		TOURNAMENT_DISCOVERY_QUERY: "Queensland",
		CRON_SECRET: "test-cron-secret",
	},
}));
vi.mock("~/env", () => ({ env: mocks.config }));
vi.mock("~/server/authz", () => ({
	canIngest: mocks.canIngest,
	isCronAuthorized: mocks.isCronAuthorized,
}));
vi.mock("~/server/ingest/pipeline", () => ({
	runIngestion: mocks.runIngestion,
}));

import { GET } from "../../cron/ingest/route";
import { POST } from "./route";

beforeEach(() => {
	vi.resetAllMocks();
	mocks.config.FACEBOOK_DISCOVERY_ENABLED = "true";
});

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

it.each(["false", undefined])(
	"skips a configured token when discovery is %s for admin and cron runs",
	async (enabled) => {
		Object.assign(mocks.config, { FACEBOOK_DISCOVERY_ENABLED: enabled });
		mocks.canIngest.mockResolvedValue(true);
		mocks.isCronAuthorized.mockReturnValue(true);
		mocks.runIngestion.mockResolvedValue({
			runId: 2,
			discovered: 0,
			imported: 2,
			matches: 698,
			errors: [],
		});
		const request = new Request("http://localhost/api/admin/ingest", {
			method: "POST",
		});
		expect((await POST(request)).status).toBe(200);
		expect(
			(await GET(new Request("http://localhost/api/cron/ingest"))).status,
		).toBe(200);
		expect(mocks.runIngestion).toHaveBeenNthCalledWith(1, {
			facebookToken: undefined,
			listingQuery: "Queensland",
		});
		expect(mocks.runIngestion).toHaveBeenNthCalledWith(2, {
			facebookToken: undefined,
			listingQuery: "Queensland",
		});
	},
);
