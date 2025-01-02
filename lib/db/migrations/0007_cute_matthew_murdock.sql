CREATE TABLE IF NOT EXISTS "Chat" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"createdAt" timestamp NOT NULL,
	"title" text NOT NULL,
	"userId" uuid NOT NULL,
	"visibility" varchar DEFAULT 'private' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"createdAt" timestamp NOT NULL,
	"title" text NOT NULL,
	"content" text,
	"text" varchar DEFAULT 'text' NOT NULL,
	"userId" uuid NOT NULL,
	"urlPath" varchar(1024),
	"fileType" varchar(64),
	"metadata" json,
	"isActive" boolean DEFAULT true NOT NULL,
	"documentGroupId" varchar(256),
	"version" integer DEFAULT 1 NOT NULL,
	"expiresAt" timestamp,
	"lastAccessedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chatId" uuid NOT NULL,
	"role" varchar NOT NULL,
	"content" json NOT NULL,
	"createdAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "questionnaire_question" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question" text NOT NULL,
	"key" varchar(64) NOT NULL,
	"placeholder" text,
	"order" integer NOT NULL,
	"is_required" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "questionnaire_question_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Suggestion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"documentId" uuid NOT NULL,
	"documentCreatedAt" timestamp NOT NULL,
	"originalText" text NOT NULL,
	"suggestedText" text NOT NULL,
	"description" text,
	"isResolved" boolean DEFAULT false NOT NULL,
	"userId" uuid NOT NULL,
	"createdAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "User" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(256) NOT NULL,
	"password" varchar(256),
	"stripeCustomerId" varchar(256),
	"stripeSubscriptionId" varchar(256),
	"subscriptionStatus" varchar(256),
	"currentPeriodEnd" timestamp,
	CONSTRAINT "User_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_questionnaire_answer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"answer" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Vote" (
	"chatId" uuid NOT NULL,
	"messageId" uuid NOT NULL,
	"isUpvoted" boolean NOT NULL,
	CONSTRAINT "Vote_chatId_messageId_pk" PRIMARY KEY("chatId","messageId")
);
--> statement-breakpoint
DROP TABLE "documents";--> statement-breakpoint
ALTER TABLE "document_embeddings" RENAME COLUMN "document_id" TO "documentId";--> statement-breakpoint
ALTER TABLE "document_embeddings" RENAME COLUMN "file_type" TO "fileType";--> statement-breakpoint
ALTER TABLE "document_embeddings" RENAME COLUMN "is_active" TO "isActive";--> statement-breakpoint
ALTER TABLE "document_embeddings" RENAME COLUMN "created_at" TO "createdAt";--> statement-breakpoint
ALTER TABLE "embedding_models" RENAME COLUMN "dimension" TO "dimensions";--> statement-breakpoint
ALTER TABLE "embedding_models" RENAME COLUMN "created_at" TO "createdAt";--> statement-breakpoint
ALTER TABLE "embedding_models" DROP CONSTRAINT "embedding_models_name_unique";--> statement-breakpoint
ALTER TABLE "document_embeddings" DROP CONSTRAINT "document_embeddings_embedding_model_id_embedding_models_id_fk";
--> statement-breakpoint
ALTER TABLE "document_embeddings" DROP CONSTRAINT "document_embeddings_document_id_documents_id_fk";
--> statement-breakpoint
ALTER TABLE "chat_history" ALTER COLUMN "accuracy" SET DATA TYPE real;--> statement-breakpoint
ALTER TABLE "chat_history" ALTER COLUMN "risk_level" SET DATA TYPE varchar(10);--> statement-breakpoint
ALTER TABLE "chat_history" ALTER COLUMN "sources" SET DATA TYPE json;--> statement-breakpoint
ALTER TABLE "chat_history" ALTER COLUMN "metadata" SET DATA TYPE json;--> statement-breakpoint
ALTER TABLE "chat_history" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_history" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "document_embeddings" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "document_embeddings" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "document_embeddings" ALTER COLUMN "metadata" SET DATA TYPE json;--> statement-breakpoint
ALTER TABLE "document_embeddings" ALTER COLUMN "documentId" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "document_embeddings" ALTER COLUMN "documentId" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "document_embeddings" ALTER COLUMN "embedding" SET DATA TYPE vector(1536);--> statement-breakpoint
ALTER TABLE "document_embeddings" ALTER COLUMN "embedding" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "document_embeddings" ALTER COLUMN "fileType" SET DATA TYPE varchar(64);--> statement-breakpoint
ALTER TABLE "document_embeddings" ALTER COLUMN "createdAt" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "embedding_models" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "embedding_models" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "embedding_models" ALTER COLUMN "name" SET DATA TYPE varchar(256);--> statement-breakpoint
ALTER TABLE "embedding_models" ALTER COLUMN "createdAt" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "embedding_models" ADD COLUMN "provider" varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE "embedding_models" ADD COLUMN "status" varchar(32) DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "embedding_models" ADD COLUMN "metadata" json;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Chat" ADD CONSTRAINT "Chat_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Document" ADD CONSTRAINT "Document_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Message" ADD CONSTRAINT "Message_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_documentId_Document_id_fk" FOREIGN KEY ("documentId") REFERENCES "public"."Document"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_questionnaire_answer" ADD CONSTRAINT "user_questionnaire_answer_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_questionnaire_answer" ADD CONSTRAINT "user_questionnaire_answer_question_id_questionnaire_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questionnaire_question"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Vote" ADD CONSTRAINT "Vote_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Vote" ADD CONSTRAINT "Vote_messageId_Message_id_fk" FOREIGN KEY ("messageId") REFERENCES "public"."Message"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "document_embeddings" ADD CONSTRAINT "document_embeddings_documentId_Document_id_fk" FOREIGN KEY ("documentId") REFERENCES "public"."Document"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "document_embeddings" DROP COLUMN IF EXISTS "embedding_model_id";--> statement-breakpoint
ALTER TABLE "embedding_models" DROP COLUMN IF EXISTS "model_id";