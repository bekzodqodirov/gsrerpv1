-- Qayta upakovka: yopiq yashik partiyaga BITTA BIRLIK bo'lib rejalanadi/yuklanadi.
CREATE TABLE IF NOT EXISTS "batch_pallet" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"pallet_id" uuid NOT NULL,
	"loaded_scan" boolean DEFAULT false NOT NULL,
	"loaded_at" timestamp with time zone,
	"loaded_by" uuid,
	"unloaded_scan" boolean DEFAULT false NOT NULL,
	"unloaded_at" timestamp with time zone,
	"unloaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "batch_pallet_uq" UNIQUE("batch_id","pallet_id")
);
--> statement-breakpoint
ALTER TABLE "batch_pallet" ADD CONSTRAINT "batch_pallet_batch_id_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batch"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "batch_pallet" ADD CONSTRAINT "batch_pallet_pallet_id_pallet_id_fk" FOREIGN KEY ("pallet_id") REFERENCES "public"."pallet"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "batch_pallet" ADD CONSTRAINT "batch_pallet_loaded_by_user_id_fk" FOREIGN KEY ("loaded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "batch_pallet" ADD CONSTRAINT "batch_pallet_unloaded_by_user_id_fk" FOREIGN KEY ("unloaded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "batch_pallet_batch_idx" ON "batch_pallet" ("batch_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "batch_pallet_pallet_idx" ON "batch_pallet" ("pallet_id");
