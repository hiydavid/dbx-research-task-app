CREATE TABLE "ai_chatbot"."ResearchProject" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chatId" uuid NOT NULL,
	"userId" text NOT NULL,
	"status" varchar DEFAULT 'planning' NOT NULL,
	"activeRunId" uuid,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_chatbot"."ResearchPlan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"projectId" uuid NOT NULL,
	"version" integer NOT NULL,
	"status" varchar DEFAULT 'draft' NOT NULL,
	"scopeJson" jsonb NOT NULL,
	"planJson" jsonb NOT NULL,
	"planMarkdown" text NOT NULL,
	"approvedAt" timestamp,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_chatbot"."ResearchRun" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"projectId" uuid NOT NULL,
	"planVersion" integer NOT NULL,
	"status" varchar DEFAULT 'queued' NOT NULL,
	"cancellationRequested" boolean DEFAULT false NOT NULL,
	"finalMarkdown" text,
	"errorText" text,
	"startedAt" timestamp,
	"endedAt" timestamp,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_chatbot"."ResearchRunEvent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"runId" uuid NOT NULL,
	"seq" integer NOT NULL,
	"stage" varchar NOT NULL,
	"level" varchar DEFAULT 'info' NOT NULL,
	"message" text NOT NULL,
	"payload" jsonb,
	"createdAt" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_chatbot"."ResearchProject" ADD CONSTRAINT "ResearchProject_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "ai_chatbot"."Chat"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ai_chatbot"."ResearchPlan" ADD CONSTRAINT "ResearchPlan_projectId_ResearchProject_id_fk" FOREIGN KEY ("projectId") REFERENCES "ai_chatbot"."ResearchProject"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ai_chatbot"."ResearchRun" ADD CONSTRAINT "ResearchRun_projectId_ResearchProject_id_fk" FOREIGN KEY ("projectId") REFERENCES "ai_chatbot"."ResearchProject"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ai_chatbot"."ResearchRunEvent" ADD CONSTRAINT "ResearchRunEvent_runId_ResearchRun_id_fk" FOREIGN KEY ("runId") REFERENCES "ai_chatbot"."ResearchRun"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ai_chatbot"."ResearchProject" ADD CONSTRAINT "ResearchProject_activeRunId_ResearchRun_id_fk" FOREIGN KEY ("activeRunId") REFERENCES "ai_chatbot"."ResearchRun"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "ResearchProject_chatId_unique" ON "ai_chatbot"."ResearchProject" ("chatId");
--> statement-breakpoint
CREATE UNIQUE INDEX "ResearchPlan_projectId_version_unique" ON "ai_chatbot"."ResearchPlan" ("projectId", "version");
--> statement-breakpoint
CREATE UNIQUE INDEX "ResearchRunEvent_runId_seq_unique" ON "ai_chatbot"."ResearchRunEvent" ("runId", "seq");
