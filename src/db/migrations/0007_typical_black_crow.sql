ALTER TABLE "pallet" ADD COLUMN "client_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "pallet" ADD COLUMN "status" varchar(16) DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "pallet" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pallet" ADD CONSTRAINT "pallet_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Tahta yashik raqamlagichi (PLT-2026-0001) — mavjud bazaga ham qo'shamiz.
INSERT INTO "doc_sequence" ("doc_type", "prefix", "last_number")
VALUES ('pallet', 'PLT', '0')
ON CONFLICT ("doc_type") DO NOTHING;