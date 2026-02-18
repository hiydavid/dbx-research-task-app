import type { InferSelectModel } from 'drizzle-orm';
import {
  boolean,
  integer,
  varchar,
  timestamp,
  json,
  jsonb,
  uuid,
  text,
  pgSchema,
} from 'drizzle-orm/pg-core';
import type { LanguageModelV3Usage } from '@ai-sdk/provider';
import type { User as SharedUser } from '@chat-template/utils';

const schemaName = 'ai_chatbot';
const customSchema = pgSchema(schemaName);

// Helper function to create table with proper schema handling
// Use the schema object for proper drizzle-kit migration generation
const createTable = customSchema.table;

export const user = createTable('User', {
  id: text('id').primaryKey().notNull(),
  email: varchar('email', { length: 64 }).notNull(),
  // Password removed - using Databricks SSO authentication
});

export type User = SharedUser;

export const chat = createTable('Chat', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  createdAt: timestamp('createdAt').notNull(),
  title: text('title').notNull(),
  userId: text('userId').notNull(),
  visibility: varchar('visibility', { enum: ['public', 'private'] })
    .notNull()
    .default('private'),
  lastContext: jsonb('lastContext').$type<LanguageModelV3Usage | null>(),
});

export type Chat = InferSelectModel<typeof chat>;

export const message = createTable('Message', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  chatId: uuid('chatId')
    .notNull()
    .references(() => chat.id),
  role: varchar('role').notNull(),
  parts: json('parts').notNull(),
  attachments: json('attachments').notNull(),
  createdAt: timestamp('createdAt').notNull(),
});

export type DBMessage = InferSelectModel<typeof message>;

export const researchProjectStatuses = [
  'planning',
  'plan_ready',
  'approved',
  'running',
  'completed',
  'failed',
  'cancelled',
] as const;

export type ResearchProjectStatus = (typeof researchProjectStatuses)[number];

export const researchPlanStatuses = [
  'draft',
  'approved',
  'superseded',
] as const;

export type ResearchPlanStatus = (typeof researchPlanStatuses)[number];

export const researchRunStatuses = [
  'queued',
  'running',
  'cancel_requested',
  'cancelled',
  'succeeded',
  'failed',
] as const;

export type ResearchRunStatus = (typeof researchRunStatuses)[number];

export const researchRunStages = [
  'queued',
  'analyzing',
  'researching',
  'synthesizing',
  'finalizing',
] as const;

export type ResearchRunStage = (typeof researchRunStages)[number];

export const researchRunEventLevels = ['info', 'warning', 'error'] as const;

export type ResearchRunEventLevel = (typeof researchRunEventLevels)[number];

export const researchProject = createTable('ResearchProject', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  chatId: uuid('chatId')
    .notNull()
    .references(() => chat.id, { onDelete: 'cascade' }),
  userId: text('userId').notNull(),
  status: varchar('status', { enum: researchProjectStatuses })
    .notNull()
    .default('planning'),
  activeRunId: uuid('activeRunId'),
  createdAt: timestamp('createdAt').notNull(),
  updatedAt: timestamp('updatedAt').notNull(),
});

export type ResearchProject = InferSelectModel<typeof researchProject>;

export const researchPlan = createTable('ResearchPlan', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  projectId: uuid('projectId')
    .notNull()
    .references(() => researchProject.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  status: varchar('status', { enum: researchPlanStatuses })
    .notNull()
    .default('draft'),
  scopeJson: jsonb('scopeJson').notNull(),
  planJson: jsonb('planJson').notNull(),
  planMarkdown: text('planMarkdown').notNull(),
  approvedAt: timestamp('approvedAt'),
  createdAt: timestamp('createdAt').notNull(),
  updatedAt: timestamp('updatedAt').notNull(),
});

export type ResearchPlan = InferSelectModel<typeof researchPlan>;

export const researchRun = createTable('ResearchRun', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  projectId: uuid('projectId')
    .notNull()
    .references(() => researchProject.id, { onDelete: 'cascade' }),
  planVersion: integer('planVersion').notNull(),
  status: varchar('status', { enum: researchRunStatuses })
    .notNull()
    .default('queued'),
  cancellationRequested: boolean('cancellationRequested')
    .notNull()
    .default(false),
  finalMarkdown: text('finalMarkdown'),
  errorText: text('errorText'),
  startedAt: timestamp('startedAt'),
  endedAt: timestamp('endedAt'),
  createdAt: timestamp('createdAt').notNull(),
  updatedAt: timestamp('updatedAt').notNull(),
});

export type ResearchRun = InferSelectModel<typeof researchRun>;

export const researchRunEvent = createTable('ResearchRunEvent', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  runId: uuid('runId')
    .notNull()
    .references(() => researchRun.id, { onDelete: 'cascade' }),
  seq: integer('seq').notNull(),
  stage: varchar('stage', { enum: researchRunStages }).notNull(),
  level: varchar('level', { enum: researchRunEventLevels })
    .notNull()
    .default('info'),
  message: text('message').notNull(),
  payload: jsonb('payload'),
  createdAt: timestamp('createdAt').notNull(),
});

export type ResearchRunEvent = InferSelectModel<typeof researchRunEvent>;
