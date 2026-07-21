CREATE TYPE "public"."cargo_status" AS ENUM('received_cn', 'in_transit_ksg', 'at_kashgar', 'loaded', 'cn_customs', 'in_transit_uz', 'at_uz_warehouse', 'uz_customs', 'ready', 'delivered', 'held', 'lost');--> statement-breakpoint
CREATE TABLE "client" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" varchar(255) NOT NULL,
	"phone" varchar(64),
	"telegram" varchar(64),
	"city" varchar(128),
	"address" text,
	"credit_limit_usd" numeric(18, 2),
	"note" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "currency" (
	"code" varchar(3) PRIMARY KEY NOT NULL,
	"name" varchar(64) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exchange_rate" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"currency" varchar(3) NOT NULL,
	"rate_to_usd" numeric(18, 8) NOT NULL,
	"rate_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_type" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"name_ru" varchar(255),
	"default_rate_per_kg_usd" numeric(12, 4),
	"default_rate_per_m3_usd" numeric(12, 4),
	"note" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warehouse" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(16) NOT NULL,
	"name" varchar(255) NOT NULL,
	"country" varchar(2) NOT NULL,
	"city" varchar(128),
	"kind" varchar(16) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "warehouse_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "cargo_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cargo_id" uuid NOT NULL,
	"type" varchar(32) NOT NULL,
	"from_status" varchar(32),
	"to_status" varchar(32),
	"data" jsonb,
	"comment" text,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cargo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reg_number" varchar(32) NOT NULL,
	"client_id" uuid NOT NULL,
	"product_type_id" uuid,
	"description" text,
	"origin_warehouse_id" uuid NOT NULL,
	"pieces" integer NOT NULL,
	"weight_kg" numeric(12, 3) NOT NULL,
	"volume_m3" numeric(12, 4) NOT NULL,
	"ksg_pieces" integer,
	"ksg_weight_kg" numeric(12, 3),
	"ksg_volume_m3" numeric(12, 4),
	"status" "cargo_status" DEFAULT 'received_cn' NOT NULL,
	"current_warehouse_id" uuid,
	"held_from_status" varchar(32),
	"received_at" timestamp with time zone NOT NULL,
	"delivered_at" timestamp with time zone,
	"note" text,
	"voided" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cargo_reg_number_unique" UNIQUE("reg_number")
);
--> statement-breakpoint
ALTER TABLE "exchange_rate" ADD CONSTRAINT "exchange_rate_currency_currency_code_fk" FOREIGN KEY ("currency") REFERENCES "public"."currency"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cargo_event" ADD CONSTRAINT "cargo_event_cargo_id_cargo_id_fk" FOREIGN KEY ("cargo_id") REFERENCES "public"."cargo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cargo_event" ADD CONSTRAINT "cargo_event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cargo" ADD CONSTRAINT "cargo_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cargo" ADD CONSTRAINT "cargo_product_type_id_product_type_id_fk" FOREIGN KEY ("product_type_id") REFERENCES "public"."product_type"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cargo" ADD CONSTRAINT "cargo_origin_warehouse_id_warehouse_id_fk" FOREIGN KEY ("origin_warehouse_id") REFERENCES "public"."warehouse"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cargo" ADD CONSTRAINT "cargo_current_warehouse_id_warehouse_id_fk" FOREIGN KEY ("current_warehouse_id") REFERENCES "public"."warehouse"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cargo" ADD CONSTRAINT "cargo_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cargo_event_cargo_idx" ON "cargo_event" USING btree ("cargo_id");--> statement-breakpoint
CREATE INDEX "cargo_client_idx" ON "cargo" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "cargo_status_idx" ON "cargo" USING btree ("status");--> statement-breakpoint
CREATE INDEX "cargo_current_wh_idx" ON "cargo" USING btree ("current_warehouse_id");