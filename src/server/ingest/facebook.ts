import { extractTournamentIds } from "./tournamentsoftware";

export const DEFAULT_SOURCES = [
	{
		id: "queenslandbadminton",
		name: "Badminton Queensland",
		url: "https://www.facebook.com/queenslandbadminton",
		pageId: "queenslandbadminton",
	},
	{
		id: "AGBadminton",
		name: "AG Badminton",
		url: "https://www.facebook.com/AGBadminton",
		pageId: "AGBadminton",
	},
	{
		id: "YSBadmintonTraining",
		name: "YS Badminton Training",
		url: "https://www.facebook.com/YSBadmintonTraining",
		pageId: "YSBadmintonTraining",
	},
] as const;

export type DiscoveredPost = {
	id: string;
	sourceId: string;
	url: string;
	text: string;
	publishedAt: Date | null;
	tournamentIds: string[];
};

export async function discoverFacebookPosts(
	source: { id: string; pageId: string },
	token: string,
): Promise<DiscoveredPost[]> {
	let url = new URL(
		`https://graph.facebook.com/v24.0/${encodeURIComponent(source.pageId)}/posts`,
	);
	url.searchParams.set(
		"fields",
		"id,message,permalink_url,created_time,attachments",
	);
	url.searchParams.set("limit", "50");
	url.searchParams.set("access_token", token);
	const posts: DiscoveredPost[] = [];
	for (let page = 0; page < 3; page++) {
		const response = await fetch(url, {
			signal: AbortSignal.timeout(10_000),
			cache: "no-store",
		});
		const payload: unknown = await response.json();
		if (!response.ok) {
			const error = (payload as { error?: { message?: string } }).error
				?.message;
			throw new Error(
				error ?? `Facebook Graph API returned HTTP ${response.status}`,
			);
		}
		const records = (payload as { data?: unknown }).data;
		if (!Array.isArray(records))
			throw new Error("Facebook Graph API returned an unexpected response");
		posts.push(
			...records.flatMap((item: unknown) => {
				const post = item as Record<string, unknown>;
				if (typeof post.id !== "string") return [];
				const text = [post.message, JSON.stringify(post.attachments ?? "")]
					.filter(Boolean)
					.join("\n");
				const tournamentIds = extractTournamentIds(text);
				if (!tournamentIds.length) return [];
				return [
					{
						id: post.id,
						sourceId: source.id,
						url:
							typeof post.permalink_url === "string"
								? post.permalink_url
								: `https://www.facebook.com/${post.id}`,
						text: typeof post.message === "string" ? post.message : "",
						publishedAt:
							typeof post.created_time === "string"
								? new Date(post.created_time)
								: null,
						tournamentIds,
					},
				];
			}),
		);
		const next = (payload as { paging?: { next?: string } }).paging?.next;
		if (!next) break;
		const nextUrl = new URL(next);
		if (nextUrl.hostname !== "graph.facebook.com")
			throw new Error("Facebook returned an invalid pagination URL");
		url = nextUrl;
	}
	return posts;
}
