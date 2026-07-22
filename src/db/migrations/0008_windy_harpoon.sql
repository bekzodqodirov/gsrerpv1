ALTER TABLE "cargo" ADD COLUMN "storage_zone" varchar(32);--> statement-breakpoint
ALTER TABLE "cargo" ADD COLUMN "split_from" uuid;--> statement-breakpoint
ALTER TABLE "cargo" ADD CONSTRAINT "cargo_split_from_cargo_id_fk" FOREIGN KEY ("split_from") REFERENCES "public"."cargo"("id") ON DELETE no action ON UPDATE no action;