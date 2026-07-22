-- Qisqa raqamli global karobka ID (RFID/EPC ga mos, tez scan). Ketma-ket
-- 100000 dan; mavjud karobkalarga backfill; keyin default + NOT NULL + unique.
CREATE SEQUENCE IF NOT EXISTS "box_uid_seq" START WITH 100000;
--> statement-breakpoint
ALTER TABLE "cargo_box" ADD COLUMN IF NOT EXISTS "box_uid" bigint;
--> statement-breakpoint
UPDATE "cargo_box" SET "box_uid" = nextval('box_uid_seq') WHERE "box_uid" IS NULL;
--> statement-breakpoint
ALTER TABLE "cargo_box" ALTER COLUMN "box_uid" SET DEFAULT nextval('box_uid_seq');
--> statement-breakpoint
ALTER TABLE "cargo_box" ALTER COLUMN "box_uid" SET NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cargo_box_uid_uq" ON "cargo_box" ("box_uid");
