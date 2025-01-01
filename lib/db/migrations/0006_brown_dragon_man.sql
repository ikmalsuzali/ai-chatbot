CREATE TABLE IF NOT EXISTS "chat_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"accuracy" numeric NOT NULL,
	"risk_level" varchar(50) NOT NULL,
	"sources" jsonb NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"user_id" varchar(255)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "document_embeddings" (
	"id" serial PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb,
	"embedding_model_id" integer,
	"document_id" integer,
	"embedding" text,
	"file_type" varchar(50),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"url_path" text NOT NULL,
	"file_type" varchar(50) NOT NULL,
	"title" text,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"document_group_id" varchar(255),
	"version" integer DEFAULT 1 NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"last_accessed_at" timestamp,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "embedding_models" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"model_id" varchar(255) NOT NULL,
	"dimension" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "embedding_models_name_unique" UNIQUE("name")
);
--> statement-breakpoint
DROP TABLE "Chat";--> statement-breakpoint
DROP TABLE "Document";--> statement-breakpoint
DROP TABLE "Message";--> statement-breakpoint
DROP TABLE "questionnaire_question";--> statement-breakpoint
DROP TABLE "Suggestion";--> statement-breakpoint
DROP TABLE "User";--> statement-breakpoint
DROP TABLE "user_questionnaire_answer";--> statement-breakpoint
DROP TABLE "Vote";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "document_embeddings" ADD CONSTRAINT "document_embeddings_embedding_model_id_embedding_models_id_fk" FOREIGN KEY ("embedding_model_id") REFERENCES "public"."embedding_models"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "document_embeddings" ADD CONSTRAINT "document_embeddings_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
