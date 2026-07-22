CREATE TABLE "batch_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"cargo_id" uuid NOT NULL,
	"line_id" uuid NOT NULL,
	"planned_boxes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "batch_line_uq" UNIQUE("batch_id","line_id")
);
--> statement-breakpoint
ALTER TABLE "batch_line" ADD CONSTRAINT "batch_line_batch_id_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_line" ADD CONSTRAINT "batch_line_cargo_id_cargo_id_fk" FOREIGN KEY ("cargo_id") REFERENCES "public"."cargo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_line" ADD CONSTRAINT "batch_line_line_id_cargo_line_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."cargo_line"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "batch_line_batch_idx" ON "batch_line" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "batch_line_line_idx" ON "batch_line" USING btree ("line_id");--> statement-breakpoint
-- Mavjud partiyalar planini tovar darajasiga ko'chirish: har partiya-yukning
-- har qatori uchun plan = qatorning to'liq karobka soni (eski model shunday edi).
INSERT INTO "batch_line" ("batch_id", "cargo_id", "line_id", "planned_boxes")
SELECT bc."batch_id", bc."cargo_id", cl."id", cl."box_count"
FROM "batch_cargo" bc
JOIN "cargo_line" cl ON cl."cargo_id" = bc."cargo_id"
ON CONFLICT ("batch_id", "line_id") DO NOTHING;--> statement-breakpoint
-- OCHIQ partiyalarda scan qilinmagan karobka qatorlari endi "kvota" (batch_line)
-- bilan ifodalanadi — oldindan ochilgan bo'sh qatorlarni o'chiramiz. Yuklangan
-- (scan qilingan) qatorlar qoladi. Jo'nab ketgan partiyalarga tegilmaydi.
DELETE FROM "batch_box" bb
USING "batch" b
WHERE bb."batch_id" = b."id"
  AND b."status" IN ('planned', 'loading')
  AND bb."loaded_scan" = false;