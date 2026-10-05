CREATE TABLE "open-shuttle_person" (
	"id" text PRIMARY KEY NOT NULL,
	"organizationCode" uuid NOT NULL,
	"memberId" text NOT NULL,
	"name" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "open-shuttle_player" ADD COLUMN "personId" text;--> statement-breakpoint
ALTER TABLE "open-shuttle_player" ADD CONSTRAINT "open-shuttle_player_personId_open-shuttle_person_id_fk" FOREIGN KEY ("personId") REFERENCES "public"."open-shuttle_person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "player_person_idx" ON "open-shuttle_player" USING btree ("personId");--> statement-breakpoint
-- Member IDs are only captured on import, so re-queue every imported Tournament
-- once; the worker re-imports it (idempotent upserts) and links its players.
INSERT INTO "open-shuttle_import_job" ("tournamentId", "runAfter")
SELECT t."id", now()
FROM "open-shuttle_tournament" t
WHERE t."lastImportedAt" IS NOT NULL
ON CONFLICT ("tournamentId") DO UPDATE
SET "status" = 'pending', "runAfter" = now(), "lastError" = NULL, "updatedAt" = now()
WHERE "open-shuttle_import_job"."status" = 'done';
