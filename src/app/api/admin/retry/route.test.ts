import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	canIngest: vi.fn(),
	retryImportJobs: vi.fn(),
	enqueueTournamentNow: vi.fn(),
	registerTournament: vi.fn(),
}));
vi.mock("~/server/authz", () => ({ canIngest: mocks.canIngest }));
vi.mock("~/server/ingest/queue", () => ({
	retryImportJobs: mocks.retryImportJobs,
	enqueueTournamentNow: mocks.enqueueTournamentNow,
}));
vi.mock("~/server/ingest/pipeline", () => ({
	registerTournament: mocks.registerTournament,
}));

import { POST as importTournament } from "../import/route";
import { POST } from "./route";

const id = "471c31ee-1005-4ae0-affb-f5cd9ce0186c";
const post = (body: unknown) =>
	new Request("http://localhost/api/admin/retry", {
		method: "POST",
		body: JSON.stringify(body),
	});

beforeEach(() => vi.resetAllMocks());

it("rejects unauthorized callers before touching the queue", async () => {
	mocks.canIngest.mockResolvedValue(false);
	expect((await POST(post({ all: true }))).status).toBe(401);
	expect(mocks.retryImportJobs).not.toHaveBeenCalled();
});

it("requeues one tournament or every failed job", async () => {
	mocks.canIngest.mockResolvedValue(true);
	mocks.retryImportJobs.mockResolvedValue(1);
	const one = await POST(post({ tournamentId: id }));
	expect(await one.json()).toEqual({ requeued: 1 });
	expect(mocks.retryImportJobs).toHaveBeenLastCalledWith({ tournamentId: id });
	await POST(post({ all: true }));
	expect(mocks.retryImportJobs).toHaveBeenLastCalledWith({ all: true });
});

it("rejects malformed bodies", async () => {
	mocks.canIngest.mockResolvedValue(true);
	expect((await POST(post({ tournamentId: "nope" }))).status).toBe(400);
	expect((await POST(post({ all: false }))).status).toBe(400);
	expect(mocks.retryImportJobs).not.toHaveBeenCalled();
});

it("queues a manual import instead of importing in the request", async () => {
	mocks.canIngest.mockResolvedValue(true);
	mocks.registerTournament.mockResolvedValue(id);
	const response = await importTournament(
		new Request("http://localhost/api/admin/import", {
			method: "POST",
			body: JSON.stringify({
				url: `https://badminton.tournamentsoftware.com/tournament/${id}`,
			}),
		}),
	);
	expect(response.status).toBe(202);
	expect(await response.json()).toEqual({ id, queued: true });
	expect(mocks.enqueueTournamentNow).toHaveBeenCalledWith(id);
});
