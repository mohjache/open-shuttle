import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	isCronAuthorized: vi.fn(),
	processNextImportJob: vi.fn(),
	config: { CRON_SECRET: "test-cron-secret" as string | undefined },
}));
vi.mock("~/env", () => ({ env: mocks.config }));
vi.mock("~/server/authz", () => ({
	isCronAuthorized: mocks.isCronAuthorized,
}));
vi.mock("~/server/ingest/queue", () => ({
	processNextImportJob: mocks.processNextImportJob,
}));

import { GET } from "./route";

const request = () => new Request("http://localhost/api/cron/process");

beforeEach(() => {
	vi.resetAllMocks();
	mocks.config.CRON_SECRET = "test-cron-secret";
});

it("rejects callers without the cron secret", async () => {
	mocks.isCronAuthorized.mockReturnValue(false);
	expect((await GET(request())).status).toBe(401);
	expect(mocks.processNextImportJob).not.toHaveBeenCalled();
});

it("fails closed when no cron secret is configured", async () => {
	mocks.config.CRON_SECRET = undefined;
	expect((await GET(request())).status).toBe(503);
	expect(mocks.processNextImportJob).not.toHaveBeenCalled();
});

it("reports the worker outcome", async () => {
	mocks.isCronAuthorized.mockReturnValue(true);
	mocks.processNextImportJob.mockResolvedValue({ status: "idle" });
	const response = await GET(request());
	expect(response.status).toBe(200);
	expect(await response.json()).toEqual({ status: "idle" });
});

it("does not leak internal errors", async () => {
	mocks.isCronAuthorized.mockReturnValue(true);
	mocks.processNextImportJob.mockRejectedValue(new Error("secret db detail"));
	const response = await GET(request());
	expect(response.status).toBe(503);
	expect(await response.text()).not.toContain("secret");
});
