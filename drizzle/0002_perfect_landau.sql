CREATE TABLE "open-shuttle_import_job" (
	"tournamentId" uuid PRIMARY KEY NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"runAfter" timestamp with time zone DEFAULT now() NOT NULL,
	"lockedUntil" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"lastError" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "open-shuttle_import_job" ADD CONSTRAINT "open-shuttle_import_job_tournamentId_open-shuttle_tournament_id_fk" FOREIGN KEY ("tournamentId") REFERENCES "public"."open-shuttle_tournament"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "import_job_status_run_after_idx" ON "open-shuttle_import_job" USING btree ("status","runAfter");--> statement-breakpoint
-- Backfill: queue every Tournament that was never imported, or was imported
-- before it finished. Mirrors enqueueMissingImportJobs() in src/server/ingest/queue.ts.
INSERT INTO "open-shuttle_import_job" ("tournamentId", "runAfter")
SELECT t."id", COALESCE((t."endsOn" + 1)::timestamp AT TIME ZONE 'Australia/Brisbane', now())
FROM "open-shuttle_tournament" t
WHERE t."lastImportedAt" IS NULL
	OR (t."endsOn" IS NOT NULL AND t."lastImportedAt" < (t."endsOn" + 1)::timestamp AT TIME ZONE 'Australia/Brisbane')
ON CONFLICT DO NOTHING;
