CREATE TABLE "batch_box" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"box_id" uuid NOT NULL,
	"cargo_id" uuid NOT NULL,
	"loaded_scan" boolean DEFAULT false NOT NULL,
	"loaded_at" timestamp with time zone,
	"loaded_by" uuid,
	"unloaded_scan" boolean DEFAULT false NOT NULL,
	"unloaded_at" timestamp with time zone,
	"unloaded_by" uuid,
	"flag" varchar(16),
	CONSTRAINT "batch_box_uq" UNIQUE("batch_id","box_id")
);
--> statement-breakpoint
DROP INDEX "cargo_box_qr_idx";--> statement-breakpoint
ALTER TABLE "batch_box" ADD CONSTRAINT "batch_box_batch_id_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_box" ADD CONSTRAINT "batch_box_box_id_cargo_box_id_fk" FOREIGN KEY ("box_id") REFERENCES "public"."cargo_box"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_box" ADD CONSTRAINT "batch_box_cargo_id_cargo_id_fk" FOREIGN KEY ("cargo_id") REFERENCES "public"."cargo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_box" ADD CONSTRAINT "batch_box_loaded_by_user_id_fk" FOREIGN KEY ("loaded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_box" ADD CONSTRAINT "batch_box_unloaded_by_user_id_fk" FOREIGN KEY ("unloaded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "batch_box_batch_idx" ON "batch_box" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "batch_box_box_idx" ON "batch_box" USING btree ("box_id");--> statement-breakpoint
-- Mavjud karobkalarning ulushli QR kodlarini UNIKAL kodga o'tkazamiz
-- (reg-raqam + karobka №), unique cheklovdan OLDIN.
UPDATE "cargo_box" cb
SET "qr_code" = c."reg_number" || '-B' || lpad(cb."box_no"::text, 3, '0')
FROM "cargo" c
WHERE cb."cargo_id" = c."id";--> statement-breakpoint
ALTER TABLE "cargo_box" ADD CONSTRAINT "cargo_box_qr_uq" UNIQUE("qr_code");