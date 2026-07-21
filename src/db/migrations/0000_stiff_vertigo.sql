CREATE TYPE "public"."cargo_status" AS ENUM('received_cn', 'in_transit_ksg', 'at_kashgar', 'loaded', 'cn_customs', 'in_transit_uz', 'at_uz_warehouse', 'uz_customs', 'ready', 'delivered', 'held', 'lost');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" varchar(64) NOT NULL,
	"entity" varchar(64) NOT NULL,
	"entity_id" varchar(64),
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "doc_sequence" (
	"doc_type" varchar(32) PRIMARY KEY NOT NULL,
	"prefix" varchar(8) NOT NULL,
	"last_number" varchar(16) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(128) NOT NULL,
	"description" varchar(255),
	CONSTRAINT "permission_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "role_permission" (
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	CONSTRAINT "role_permission_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "role" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "user_role" (
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	CONSTRAINT "user_role_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar(64) NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"email" varchar(255),
	"password_hash" text NOT NULL,
	"warehouse_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_username_unique" UNIQUE("username"),
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
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
	"gs_code" varchar(8) NOT NULL,
	"name" varchar(255) NOT NULL,
	"country" varchar(2) NOT NULL,
	"city" varchar(128),
	"kind" varchar(16) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "warehouse_code_unique" UNIQUE("code"),
	CONSTRAINT "warehouse_gs_code_unique" UNIQUE("gs_code")
);
--> statement-breakpoint
CREATE TABLE "attachment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity" varchar(32) NOT NULL,
	"entity_id" uuid NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"stored_name" varchar(64) NOT NULL,
	"mime_type" varchar(128) NOT NULL,
	"size_bytes" integer NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attachment_stored_name_unique" UNIQUE("stored_name")
);
--> statement-breakpoint
CREATE TABLE "cargo_box" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cargo_id" uuid NOT NULL,
	"line_id" uuid NOT NULL,
	"box_no" integer NOT NULL,
	"qr_code" varchar(64) NOT NULL,
	"pallet_id" uuid,
	"flag" varchar(16),
	CONSTRAINT "cargo_box_no_uq" UNIQUE("cargo_id","box_no")
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
CREATE TABLE "cargo_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cargo_id" uuid NOT NULL,
	"line_no" integer NOT NULL,
	"letter_code" varchar(4) NOT NULL,
	"product_name" varchar(255) NOT NULL,
	"box_count" integer NOT NULL,
	"box_length_cm" numeric(8, 2),
	"box_width_cm" numeric(8, 2),
	"box_height_cm" numeric(8, 2),
	"weight_per_box_kg" numeric(10, 3),
	"total_weight_kg" numeric(12, 3) NOT NULL,
	"total_volume_m3" numeric(12, 4) NOT NULL,
	"note" text,
	CONSTRAINT "cargo_line_no_uq" UNIQUE("cargo_id","line_no")
);
--> statement-breakpoint
CREATE TABLE "cargo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reg_number" varchar(32) NOT NULL,
	"client_id" uuid NOT NULL,
	"origin_warehouse_id" uuid NOT NULL,
	"current_warehouse_id" uuid,
	"total_boxes" integer DEFAULT 0 NOT NULL,
	"total_weight_kg" numeric(12, 3) DEFAULT '0' NOT NULL,
	"total_volume_m3" numeric(12, 4) DEFAULT '0' NOT NULL,
	"ksg_boxes" integer,
	"ksg_weight_kg" numeric(12, 3),
	"ksg_volume_m3" numeric(12, 4),
	"status" "cargo_status" DEFAULT 'received_cn' NOT NULL,
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
CREATE TABLE "pallet" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(64) NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pallet_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_role_id_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_permission_id_permission_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permission"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_role_id_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_warehouse_id_warehouse_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouse"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_rate" ADD CONSTRAINT "exchange_rate_currency_currency_code_fk" FOREIGN KEY ("currency") REFERENCES "public"."currency"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cargo_box" ADD CONSTRAINT "cargo_box_cargo_id_cargo_id_fk" FOREIGN KEY ("cargo_id") REFERENCES "public"."cargo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cargo_box" ADD CONSTRAINT "cargo_box_line_id_cargo_line_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."cargo_line"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cargo_box" ADD CONSTRAINT "cargo_box_pallet_id_pallet_id_fk" FOREIGN KEY ("pallet_id") REFERENCES "public"."pallet"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cargo_event" ADD CONSTRAINT "cargo_event_cargo_id_cargo_id_fk" FOREIGN KEY ("cargo_id") REFERENCES "public"."cargo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cargo_event" ADD CONSTRAINT "cargo_event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cargo_line" ADD CONSTRAINT "cargo_line_cargo_id_cargo_id_fk" FOREIGN KEY ("cargo_id") REFERENCES "public"."cargo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cargo" ADD CONSTRAINT "cargo_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cargo" ADD CONSTRAINT "cargo_origin_warehouse_id_warehouse_id_fk" FOREIGN KEY ("origin_warehouse_id") REFERENCES "public"."warehouse"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cargo" ADD CONSTRAINT "cargo_current_warehouse_id_warehouse_id_fk" FOREIGN KEY ("current_warehouse_id") REFERENCES "public"."warehouse"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cargo" ADD CONSTRAINT "cargo_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pallet" ADD CONSTRAINT "pallet_warehouse_id_warehouse_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouse"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pallet" ADD CONSTRAINT "pallet_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attachment_entity_idx" ON "attachment" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "cargo_box_cargo_idx" ON "cargo_box" USING btree ("cargo_id");--> statement-breakpoint
CREATE INDEX "cargo_box_pallet_idx" ON "cargo_box" USING btree ("pallet_id");--> statement-breakpoint
CREATE INDEX "cargo_box_qr_idx" ON "cargo_box" USING btree ("qr_code");--> statement-breakpoint
CREATE INDEX "cargo_event_cargo_idx" ON "cargo_event" USING btree ("cargo_id");--> statement-breakpoint
CREATE INDEX "cargo_line_cargo_idx" ON "cargo_line" USING btree ("cargo_id");--> statement-breakpoint
CREATE INDEX "cargo_client_idx" ON "cargo" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "cargo_status_idx" ON "cargo" USING btree ("status");--> statement-breakpoint
CREATE INDEX "cargo_current_wh_idx" ON "cargo" USING btree ("current_warehouse_id");