CREATE TABLE IF NOT EXISTS "QuestionnaireQuestion" (
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
CREATE TABLE IF NOT EXISTS "UserQuestionnaireAnswer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"answer" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "User" ALTER COLUMN "email" SET DATA TYPE varchar(256);--> statement-breakpoint
ALTER TABLE "User" ALTER COLUMN "password" SET DATA TYPE varchar(256);--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "stripeCustomerId" varchar(256);--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "stripeSubscriptionId" varchar(256);--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "subscriptionStatus" varchar(256);--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "currentPeriodEnd" timestamp;--> statement-breakpoint
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
ALTER TABLE "User" ADD CONSTRAINT "User_email_unique" UNIQUE("email");