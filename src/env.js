import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
	/**
	 * Specify your server-side environment variables schema here. This way you can ensure the app
	 * isn't built with invalid env vars.
	 */
	server: {
		DATABASE_URL: z.string().url(),
		DATABASE_URL_UNPOOLED: z.string().url().optional(),
		CRON_SECRET: z.string().min(16).optional(),
		INGEST_API_KEY: z.string().min(16).optional(),
		FACEBOOK_PAGE_ACCESS_TOKEN: z.string().optional(),
		FACEBOOK_DISCOVERY_ENABLED: z.enum(["true", "false"]).default("false"),
		TOURNAMENT_DISCOVERY_QUERY: z.string().max(160).optional(),
		NEON_AUTH_BASE_URL: z.string().url().optional(),
		NEON_AUTH_COOKIE_SECRET: z.string().min(32).optional(),
		ADMIN_EMAIL: z.string().email().optional(),
		NODE_ENV: z
			.enum(["development", "test", "production"])
			.default("development"),
	},

	/**
	 * Specify your client-side environment variables schema here. This way you can ensure the app
	 * isn't built with invalid env vars. To expose them to the client, prefix them with
	 * `NEXT_PUBLIC_`.
	 */
	client: {
		// NEXT_PUBLIC_CLIENTVAR: z.string(),
	},

	/**
	 * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
	 * middlewares) or client-side so we need to destruct manually.
	 */
	runtimeEnv: {
		DATABASE_URL: process.env.DATABASE_URL,
		DATABASE_URL_UNPOOLED: process.env.DATABASE_URL_UNPOOLED,
		CRON_SECRET: process.env.CRON_SECRET,
		INGEST_API_KEY: process.env.INGEST_API_KEY,
		FACEBOOK_PAGE_ACCESS_TOKEN: process.env.FACEBOOK_PAGE_ACCESS_TOKEN,
		FACEBOOK_DISCOVERY_ENABLED: process.env.FACEBOOK_DISCOVERY_ENABLED,
		TOURNAMENT_DISCOVERY_QUERY: process.env.TOURNAMENT_DISCOVERY_QUERY,
		NEON_AUTH_BASE_URL: process.env.NEON_AUTH_BASE_URL,
		NEON_AUTH_COOKIE_SECRET: process.env.NEON_AUTH_COOKIE_SECRET,
		ADMIN_EMAIL: process.env.ADMIN_EMAIL,
		NODE_ENV: process.env.NODE_ENV,
		// NEXT_PUBLIC_CLIENTVAR: process.env.NEXT_PUBLIC_CLIENTVAR,
	},
	/**
	 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
	 * useful for Docker builds.
	 */
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
	/**
	 * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
	 * `SOME_VAR=''` will throw an error.
	 */
	emptyStringAsUndefined: true,
});
