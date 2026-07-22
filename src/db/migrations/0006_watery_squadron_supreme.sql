ALTER TABLE "warehouse" ADD COLUMN "capacity_m3" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "warehouse" ADD COLUMN "capacity_kg" numeric(14, 2);--> statement-breakpoint
-- Mavjud omborlarga standart sig'im (keyin sozlamalardan o'zgartiriladi).
UPDATE "warehouse" SET "capacity_m3" = '500',  "capacity_kg" = '120000' WHERE "code" = 'YIWU' AND "capacity_m3" IS NULL;--> statement-breakpoint
UPDATE "warehouse" SET "capacity_m3" = '400',  "capacity_kg" = '100000' WHERE "code" = 'GZ'   AND "capacity_m3" IS NULL;--> statement-breakpoint
UPDATE "warehouse" SET "capacity_m3" = '300',  "capacity_kg" = '80000'  WHERE "code" = 'URC'  AND "capacity_m3" IS NULL;--> statement-breakpoint
UPDATE "warehouse" SET "capacity_m3" = '1500', "capacity_kg" = '400000' WHERE "code" = 'KSG'  AND "capacity_m3" IS NULL;--> statement-breakpoint
UPDATE "warehouse" SET "capacity_m3" = '400',  "capacity_kg" = '90000'  WHERE "code" = 'TAS'  AND "capacity_m3" IS NULL;--> statement-breakpoint
UPDATE "warehouse" SET "capacity_m3" = '300',  "capacity_kg" = '70000'  WHERE "code" = 'AND'  AND "capacity_m3" IS NULL;