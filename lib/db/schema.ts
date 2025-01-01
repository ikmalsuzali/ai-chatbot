import type { InferSelectModel } from 'drizzle-orm';
import {
  pgTable,
  varchar,
  timestamp,
  json,
  uuid,
  text,
  primaryKey,
  foreignKey,
  boolean,
  integer,
  serial,
  real,
} from 'drizzle-orm/pg-core';

// User and authentication tables
export const user = pgTable('User', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  email: varchar('email', { length: 256 }).unique().notNull(),
  password: varchar('password', { length: 256 }),
  stripeCustomerId: varchar('stripeCustomerId', { length: 256 }),
  stripeSubscriptionId: varchar('stripeSubscriptionId', { length: 256 }),
  subscriptionStatus: varchar('subscriptionStatus', { length: 256 }),
  currentPeriodEnd: timestamp('currentPeriodEnd'),
});

export type User = InferSelectModel<typeof user>;

// Chat related tables
export const chat = pgTable('Chat', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  createdAt: timestamp('createdAt').notNull(),
  title: text('title').notNull(),
  userId: uuid('userId')
    .notNull()
    .references(() => user.id),
  visibility: varchar('visibility', { enum: ['public', 'private'] })
    .notNull()
    .default('private'),
});

export type Chat = InferSelectModel<typeof chat>;

export const message = pgTable('Message', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  chatId: uuid('chatId')
    .notNull()
    .references(() => chat.id),
  role: varchar('role').notNull(),
  content: json('content').notNull(),
  createdAt: timestamp('createdAt').notNull(),
});

export type Message = InferSelectModel<typeof message>;

export const vote = pgTable(
  'Vote',
  {
    chatId: uuid('chatId')
      .notNull()
      .references(() => chat.id),
    messageId: uuid('messageId')
      .notNull()
      .references(() => message.id),
    isUpvoted: boolean('isUpvoted').notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  },
);

export type Vote = InferSelectModel<typeof vote>;

// Document processing tables
export const document = pgTable(
  'Document',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    createdAt: timestamp('createdAt').notNull(),
    title: text('title').notNull(),
    content: text('content'),
    kind: varchar('text', { enum: ['text', 'code'] })
      .notNull()
      .default('text'),
    userId: uuid('userId')
      .notNull()
      .references(() => user.id),
    urlPath: varchar('urlPath', { length: 1024 }),
    fileType: varchar('fileType', { length: 64 }),
    metadata: json('metadata'),
    isActive: boolean('isActive').notNull().default(true),
    documentGroupId: varchar('documentGroupId', { length: 256 }),
    version: integer('version').notNull().default(1),
    expiresAt: timestamp('expiresAt'),
    lastAccessedAt: timestamp('lastAccessedAt'),
  }
);

export type Document = InferSelectModel<typeof document>;

export const embeddingModels = pgTable('embedding_models', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  name: varchar('name', { length: 256 }).notNull(),
  provider: varchar('provider', { length: 64 }).notNull(),
  dimensions: integer('dimensions').notNull(),
  status: varchar('status', { length: 32 }).notNull().default('active'),
  metadata: json('metadata'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
});

export type EmbeddingModel = InferSelectModel<typeof embeddingModels>;

export const documentEmbeddings = pgTable('document_embeddings', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  documentId: uuid('documentId')
    .notNull()
    .references(() => document.id),
  content: text('content').notNull(),
  embedding: json('embedding').notNull(),
  metadata: json('metadata'),
  fileType: varchar('fileType', { length: 64 }),
  isActive: boolean('isActive').notNull().default(true),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
});

export type DocumentEmbedding = InferSelectModel<typeof documentEmbeddings>;

export const suggestion = pgTable(
  'Suggestion',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    documentId: uuid('documentId')
      .notNull()
      .references(() => document.id),
    documentCreatedAt: timestamp('documentCreatedAt').notNull(),
    originalText: text('originalText').notNull(),
    suggestedText: text('suggestedText').notNull(),
    description: text('description'),
    isResolved: boolean('isResolved').notNull().default(false),
    userId: uuid('userId')
      .notNull()
      .references(() => user.id),
    createdAt: timestamp('createdAt').notNull(),
  }
);

export type Suggestion = InferSelectModel<typeof suggestion>;

// Questionnaire tables
export const questionnaireQuestion = pgTable('questionnaire_question', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  question: text('question').notNull(),
  key: varchar('key', { length: 64 }).notNull().unique(),
  placeholder: text('placeholder'),
  order: integer('order').notNull(),
  isRequired: boolean('is_required').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type QuestionnaireQuestion = InferSelectModel<typeof questionnaireQuestion>;

export const userQuestionnaireAnswer = pgTable('user_questionnaire_answer', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  questionId: uuid('question_id')
    .notNull()
    .references(() => questionnaireQuestion.id, { onDelete: 'cascade' }),
  answer: text('answer').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type UserQuestionnaireAnswer = InferSelectModel<typeof userQuestionnaireAnswer>;

export const chatHistory = pgTable('chat_history', {
  id: serial('id').primaryKey(),
  question: text('question').notNull(),
  answer: text('answer').notNull(),
  accuracy: real('accuracy').notNull(),
  riskLevel: varchar('risk_level', { length: 10 }).notNull(),
  sources: json('sources').notNull(),
  metadata: json('metadata'),
  userId: text('user_id'),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export type ChatHistory = typeof chatHistory.$inferInsert;
