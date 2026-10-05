import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	listPersons: vi.fn(),
	getPerson: vi.fn(),
	listMatches: vi.fn(),
}));
vi.mock("~/server/catalog", () => mocks);

import { GET as getPersonRoute } from "./[id]/route";
import { GET as listRoute } from "./route";

const org = "d62ece1c-326e-41e7-b6b4-321b9dabb0ab";

beforeEach(() => vi.resetAllMocks());

it("lists persons with validated pagination", async () => {
	mocks.listPersons.mockResolvedValue([{ id: `${org}:NSW738`, name: "A B" }]);
	const response = await listRoute(
		new Request("http://localhost/api/v1/persons?q=lee&limit=5&offset=10"),
	);
	expect(await response.json()).toEqual({
		data: [{ id: `${org}:NSW738`, name: "A B" }],
		pagination: { limit: 5, offset: 10 },
	});
	expect(mocks.listPersons).toHaveBeenCalledWith({
		q: "lee",
		limit: 5,
		offset: 10,
	});
});

it("rejects out-of-range pagination", async () => {
	for (const query of [
		"limit=0",
		"limit=101",
		"offset=-1",
		`q=${"x".repeat(101)}`,
	]) {
		const response = await listRoute(
			new Request(`http://localhost/api/v1/persons?${query}`),
		);
		expect(response.status).toBe(400);
	}
	expect(mocks.listPersons).not.toHaveBeenCalled();
});

it("returns a person with matches across every appearance", async () => {
	mocks.getPerson.mockResolvedValue({
		id: `${org}:NSW738`,
		name: "A B",
		appearances: [{ playerId: "t1:1" }, { playerId: "t2:9" }],
	});
	mocks.listMatches.mockResolvedValue([{ id: "m1" }]);
	const response = await getPersonRoute(
		new Request("http://localhost/api/v1/persons/x"),
		{ params: Promise.resolve({ id: `${org}:NSW738` }) },
	);
	const body = await response.json();
	expect(body.data.matches).toEqual([{ id: "m1" }]);
	expect(mocks.listMatches).toHaveBeenCalledWith({
		playerIds: ["t1:1", "t2:9"],
		limit: 100,
	});
});

it("returns 404 for an unknown person", async () => {
	mocks.getPerson.mockResolvedValue(null);
	const response = await getPersonRoute(
		new Request("http://localhost/api/v1/persons/nope"),
		{ params: Promise.resolve({ id: "nope" }) },
	);
	expect(response.status).toBe(404);
	expect(mocks.listMatches).not.toHaveBeenCalled();
});
