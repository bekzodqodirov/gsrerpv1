CREATE TYPE "public"."batch_status" AS ENUM('planned', 'loading', 'departed', 'arrived', 'unloaded', 'closed');--> statement-breakpoint
CREATE TABLE "batch_cargo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"cargo_id" uuid NOT NULL,
	"scanned" boolean DEFAULT false NOT NULL,
	"loaded_at" timestamp with time zone,
	"loaded_by" uuid,
	CONSTRAINT "batch_cargo_uq" UNIQUE("batch_id","cargo_id")
);
--> statement-breakpoint
CREATE TABLE "batch" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(32) NOT NULL,
	"origin_warehouse_id" uuid NOT NULL,
	"destination_warehouse_id" uuid NOT NULL,
	"carrier_id" uuid,
	"agreed_price" numeric(18, 2),
	"currency" varchar(3),
	"status" "batch_status" DEFAULT 'planned' NOT NULL,
	"seal_number" varchar(64),
	"planned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"departed_at" timestamp with time zone,
	"arrived_at" timestamp with time zone,
	"unloaded_at" timestamp with time zone,
	"note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "batch_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "carrier" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"phone" varchar(64),
	"truck_plate" varchar(32),
	"truck_type" varchar(64),
	"capacity_kg" numeric(12, 2),
	"capacity_m3" numeric(12, 2),
	"rating" numeric(3, 2),
	"note" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "batch_cargo" ADD CONSTRAINT "batch_cargo_batch_id_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_cargo" ADD CONSTRAINT "batch_cargo_cargo_id_cargo_id_fk" FOREIGN KEY ("cargo_id") REFERENCES "public"."cargo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_cargo" ADD CONSTRAINT "batch_cargo_loaded_by_user_id_fk" FOREIGN KEY ("loaded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch" ADD CONSTRAINT "batch_origin_warehouse_id_warehouse_id_fk" FOREIGN KEY ("origin_warehouse_id") REFERENCES "public"."warehouse"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch" ADD CONSTRAINT "batch_destination_warehouse_id_warehouse_id_fk" FOREIGN KEY ("destination_warehouse_id") REFERENCES "public"."warehouse"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch" ADD CONSTRAINT "batch_carrier_id_carrier_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."carrier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch" ADD CONSTRAINT "batch_currency_currency_code_fk" FOREIGN KEY ("currency") REFERENCES "public"."currency"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch" ADD CONSTRAINT "batch_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "batch_cargo_batch_idx" ON "batch_cargo" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "batch_cargo_cargo_idx" ON "batch_cargo" USING btree ("cargo_id");--> statement-breakpoint
CREATE INDEX "batch_origin_idx" ON "batch" USING btree ("origin_warehouse_id");--> statement-breakpoint
CREATE INDEX "batch_status_idx" ON "batch" USING btree ("status");