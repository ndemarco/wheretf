CREATE TABLE "aspect_parameters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aspect_id" uuid NOT NULL,
	"parameter_definition_id" uuid NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"default_value" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "aspect_parameters_aspect_id_parameter_definition_id_unique" UNIQUE("aspect_id","parameter_definition_id")
);
--> statement-breakpoint
CREATE TABLE "aspects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "aspects_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"icon" text,
	"color" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "item_aspects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"aspect_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "item_aspects_item_id_aspect_id_unique" UNIQUE("item_id","aspect_id")
);
--> statement-breakpoint
CREATE TABLE "item_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "item_categories_item_id_category_id_unique" UNIQUE("item_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "item_parameter_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"parameter_definition_id" uuid NOT NULL,
	"item_aspect_id" uuid,
	"value" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "item_parameter_values_item_id_parameter_definition_id_item_aspect_id_unique" UNIQUE("item_id","parameter_definition_id","item_aspect_id")
);
--> statement-breakpoint
CREATE TABLE "parameter_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"data_type" text NOT NULL,
	"unit" text,
	"default_value" jsonb,
	"constraints" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "parameter_definitions_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "aspect_parameters" ADD CONSTRAINT "aspect_parameters_aspect_id_aspects_id_fk" FOREIGN KEY ("aspect_id") REFERENCES "public"."aspects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aspect_parameters" ADD CONSTRAINT "aspect_parameters_parameter_definition_id_parameter_definitions_id_fk" FOREIGN KEY ("parameter_definition_id") REFERENCES "public"."parameter_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_aspects" ADD CONSTRAINT "item_aspects_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_aspects" ADD CONSTRAINT "item_aspects_aspect_id_aspects_id_fk" FOREIGN KEY ("aspect_id") REFERENCES "public"."aspects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_categories" ADD CONSTRAINT "item_categories_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_categories" ADD CONSTRAINT "item_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_parameter_values" ADD CONSTRAINT "item_parameter_values_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_parameter_values" ADD CONSTRAINT "item_parameter_values_parameter_definition_id_parameter_definitions_id_fk" FOREIGN KEY ("parameter_definition_id") REFERENCES "public"."parameter_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_parameter_values" ADD CONSTRAINT "item_parameter_values_item_aspect_id_item_aspects_id_fk" FOREIGN KEY ("item_aspect_id") REFERENCES "public"."item_aspects"("id") ON DELETE cascade ON UPDATE no action;