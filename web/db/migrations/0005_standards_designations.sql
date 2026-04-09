CREATE TABLE IF NOT EXISTS "standards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"aspect_id" uuid NOT NULL,
	"description" text,
	"domain_tag" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "standards_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "standard_parameters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"standard_id" uuid NOT NULL,
	"parameter_definition_id" uuid NOT NULL,
	"role" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "standard_parameters_standard_id_parameter_definition_id_unique" UNIQUE("standard_id","parameter_definition_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "standard_designations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"standard_id" uuid NOT NULL,
	"designation" text NOT NULL,
	"values" jsonb NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "standard_designations_standard_id_designation_unique" UNIQUE("standard_id","designation")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "item_standards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"standard_id" uuid NOT NULL,
	"designation_id" uuid,
	"is_custom" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "item_standards_item_id_standard_id_unique" UNIQUE("item_id","standard_id")
);
--> statement-breakpoint
ALTER TABLE "standards" ADD CONSTRAINT "standards_aspect_id_aspects_id_fk" FOREIGN KEY ("aspect_id") REFERENCES "public"."aspects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "standard_parameters" ADD CONSTRAINT "standard_parameters_standard_id_standards_id_fk" FOREIGN KEY ("standard_id") REFERENCES "public"."standards"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "standard_parameters" ADD CONSTRAINT "standard_parameters_parameter_definition_id_parameter_definitions_id_fk" FOREIGN KEY ("parameter_definition_id") REFERENCES "public"."parameter_definitions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "standard_designations" ADD CONSTRAINT "standard_designations_standard_id_standards_id_fk" FOREIGN KEY ("standard_id") REFERENCES "public"."standards"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "item_standards" ADD CONSTRAINT "item_standards_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "item_standards" ADD CONSTRAINT "item_standards_standard_id_standards_id_fk" FOREIGN KEY ("standard_id") REFERENCES "public"."standards"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "item_standards" ADD CONSTRAINT "item_standards_designation_id_standard_designations_id_fk" FOREIGN KEY ("designation_id") REFERENCES "public"."standard_designations"("id") ON DELETE set null ON UPDATE no action;
