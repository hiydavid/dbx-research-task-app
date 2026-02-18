import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  inArray,
  lt,
  sql,
  type SQL,
} from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import {
  chat,
  message,
  researchPlan,
  researchProject,
  researchRun,
  researchRunEvent,
  type DBMessage,
  type Chat,
  type ResearchPlan,
  type ResearchPlanStatus,
  type ResearchProject,
  type ResearchProjectStatus,
  type ResearchRun,
  type ResearchRunEvent,
  type ResearchRunEventLevel,
  type ResearchRunStage,
  type ResearchRunStatus,
} from './schema';
import type { VisibilityType } from '@chat-template/utils';
import { ChatSDKError } from '@chat-template/core/errors';
import type { LanguageModelV3Usage } from '@ai-sdk/provider';
import { isDatabaseAvailable } from './connection';
import { getAuthMethod, getAuthMethodDescription } from '@chat-template/auth';

// Re-export User type for external use
export type { User } from './schema';

// Optionally, if not using email/pass login, you can
// use the Drizzle adapter for Auth.js / NextAuth
// https://authjs.dev/reference/adapter/drizzle
let _db: ReturnType<typeof drizzle>;

const getOrInitializeDb = async () => {
  if (!isDatabaseAvailable()) {
    throw new Error(
      'Database configuration required. Please set PGDATABASE/PGHOST/PGUSER or POSTGRES_URL environment variables.',
    );
  }

  if (_db) return _db;

  const authMethod = getAuthMethod();
  if (authMethod === 'oauth' || authMethod === 'cli') {
    // Dynamic auth path - db will be initialized asynchronously
    console.log(
      `Using ${getAuthMethodDescription()} authentication for Postgres connection`,
    );
  } else if (process.env.POSTGRES_URL) {
    // Traditional connection string
    const client = postgres(process.env.POSTGRES_URL);
    _db = drizzle(client);
  }

  return _db;
};

// Helper to ensure db is initialized for dynamic auth connections
async function ensureDb() {
  const db = await getOrInitializeDb();
  // Always get a fresh DB instance for dynamic auth connections to handle token expiry
  const authMethod = getAuthMethod();
  if (authMethod === 'oauth' || authMethod === 'cli') {
    const authDescription = getAuthMethodDescription();
    console.log(`[ensureDb] Getting ${authDescription} database connection...`);
    try {
      // Import getDb for database connection
      const { getDb } = await import('./connection-pool.js');
      const database = await getDb();
      console.log(
        `[ensureDb] ${authDescription} db connection obtained successfully`,
      );
      return database;
    } catch (error) {
      console.error(
        `[ensureDb] Failed to get ${authDescription} connection:`,
        error,
      );
      throw error;
    }
  }

  // For static connections (POSTGRES_URL), use cached instance
  if (!db) {
    console.error('[ensureDb] DB is still null after initialization attempt!');
    throw new Error('Database connection could not be established');
  }
  return db;
}

export async function saveChat({
  id,
  userId,
  title,
  visibility,
}: {
  id: string;
  userId: string;
  title: string;
  visibility: VisibilityType;
}) {
  if (!isDatabaseAvailable()) {
    console.log('[saveChat] Database not available, skipping persistence');
    return;
  }

  try {
    return await (await ensureDb()).insert(chat).values({
      id,
      createdAt: new Date(),
      userId,
      title,
      visibility,
    });
  } catch (error) {
    console.error('[saveChat] Error saving chat:', error);
    throw new ChatSDKError('bad_request:database', 'Failed to save chat');
  }
}

export async function deleteChatById({ id }: { id: string }) {
  if (!isDatabaseAvailable()) {
    console.log('[deleteChatById] Database not available, skipping deletion');
    return null;
  }

  try {
    await (await ensureDb()).delete(message).where(eq(message.chatId, id));

    const [chatsDeleted] = await (await ensureDb())
      .delete(chat)
      .where(eq(chat.id, id))
      .returning();
    return chatsDeleted;
  } catch (_error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete chat by id',
    );
  }
}

export async function getChatsByUserId({
  id,
  limit,
  startingAfter,
  endingBefore,
}: {
  id: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
}) {
  if (!isDatabaseAvailable()) {
    console.log('[getChatsByUserId] Database not available, returning empty');
    return { chats: [], hasMore: false };
  }

  try {
    const extendedLimit = limit + 1;

    const query = async (whereCondition?: SQL<any>) => {
      const database = await ensureDb();

      return database
        .select()
        .from(chat)
        .where(
          whereCondition
            ? and(whereCondition, eq(chat.userId, id))
            : eq(chat.userId, id),
        )
        .orderBy(desc(chat.createdAt))
        .limit(extendedLimit);
    };

    let filteredChats: Array<Chat> = [];

    if (startingAfter) {
      console.log(
        '[getChatsByUserId] Fetching chat for startingAfter:',
        startingAfter,
      );
      const database = await ensureDb();
      const [selectedChat] = await database
        .select()
        .from(chat)
        .where(eq(chat.id, startingAfter))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          'not_found:database',
          `Chat with id ${startingAfter} not found`,
        );
      }

      filteredChats = await query(gt(chat.createdAt, selectedChat.createdAt));
    } else if (endingBefore) {
      console.log(
        '[getChatsByUserId] Fetching chat for endingBefore:',
        endingBefore,
      );
      const database = await ensureDb();
      const [selectedChat] = await database
        .select()
        .from(chat)
        .where(eq(chat.id, endingBefore))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          'not_found:database',
          `Chat with id ${endingBefore} not found`,
        );
      }

      filteredChats = await query(lt(chat.createdAt, selectedChat.createdAt));
    } else {
      console.log('[getChatsByUserId] Executing main query without pagination');
      filteredChats = await query();
    }

    const hasMore = filteredChats.length > limit;
    console.log(
      '[getChatsByUserId] Query successful, found',
      filteredChats.length,
      'chats',
    );

    return {
      chats: hasMore ? filteredChats.slice(0, limit) : filteredChats,
      hasMore,
    };
  } catch (error) {
    console.error('[getChatsByUserId] Error details:', error);
    console.error(
      '[getChatsByUserId] Error stack:',
      error instanceof Error ? error.stack : 'No stack available',
    );
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get chats by user id',
    );
  }
}

export async function getChatById({ id }: { id: string }) {
  if (!isDatabaseAvailable()) {
    console.log('[getChatById] Database not available, returning null');
    return null;
  }

  try {
    const [selectedChat] = await (await ensureDb())
      .select()
      .from(chat)
      .where(eq(chat.id, id));
    if (!selectedChat) {
      return null;
    }

    return selectedChat;
  } catch (_error) {
    throw new ChatSDKError('bad_request:database', 'Failed to get chat by id');
  }
}

export async function saveMessages({
  messages,
}: {
  messages: Array<DBMessage>;
}) {
  if (!isDatabaseAvailable()) {
    console.log('[saveMessages] Database not available, skipping persistence');
    return;
  }

  try {
    // Use upsert to handle both new messages and updates (e.g., MCP approval continuations)
    // When a message ID already exists, update its parts (which may have changed)
    // Using sql`excluded.X` to reference the values that would have been inserted
    return await (await ensureDb())
      .insert(message)
      .values(messages)
      .onConflictDoUpdate({
        target: message.id,
        set: {
          parts: sql`excluded.parts`,
          attachments: sql`excluded.attachments`,
        },
      });
  } catch (_error) {
    throw new ChatSDKError('bad_request:database', 'Failed to save messages');
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  if (!isDatabaseAvailable()) {
    console.log('[getMessagesByChatId] Database not available, returning empty');
    return [];
  }

  try {
    return await (await ensureDb())
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt));
  } catch (_error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get messages by chat id',
    );
  }
}

export async function getMessageById({ id }: { id: string }) {
  if (!isDatabaseAvailable()) {
    console.log('[getMessageById] Database not available, returning empty');
    return [];
  }

  try {
    return await (await ensureDb())
      .select()
      .from(message)
      .where(eq(message.id, id));
  } catch (_error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get message by id',
    );
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  if (!isDatabaseAvailable()) {
    console.log('[deleteMessagesByChatIdAfterTimestamp] Database not available, skipping deletion');
    return;
  }

  try {
    const messagesToDelete = await (await ensureDb())
      .select({ id: message.id })
      .from(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp)),
      );

    const messageIds = messagesToDelete.map((message) => message.id);

    if (messageIds.length > 0) {
      return await (await ensureDb())
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), inArray(message.id, messageIds)),
        );
    }
  } catch (_error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete messages by chat id after timestamp',
    );
  }
}

export async function updateChatVisiblityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: 'private' | 'public';
}) {
  if (!isDatabaseAvailable()) {
    console.log('[updateChatVisiblityById] Database not available, skipping update');
    return;
  }

  try {
    return await (await ensureDb())
      .update(chat)
      .set({ visibility })
      .where(eq(chat.id, chatId));
  } catch (_error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to update chat visibility by id',
    );
  }
}

export async function updateChatLastContextById({
  chatId,
  context,
}: {
  chatId: string;
  // Store raw LanguageModelUsage to keep it simple
  context: LanguageModelV3Usage;
}) {
  if (!isDatabaseAvailable()) {
    console.log('[updateChatLastContextById] Database not available, skipping update');
    return;
  }

  try {
    return await (await ensureDb())
      .update(chat)
      .set({ lastContext: context })
      .where(eq(chat.id, chatId));
  } catch (error) {
    console.warn('Failed to update lastContext for chat', chatId, error);
    return;
  }
}

function requireResearchPersistence(operation: string) {
  if (!isDatabaseAvailable()) {
    throw new ChatSDKError(
      'bad_request:database',
      `${operation} requires database persistence to be enabled.`,
    );
  }
}

export type ResearchProjectListItem = {
  project: ResearchProject;
  chatTitle: string;
  chatId: string;
};

export async function createResearchProject({
  id,
  chatId,
  userId,
  status = 'planning',
}: {
  id: string;
  chatId: string;
  userId: string;
  status?: ResearchProjectStatus;
}) {
  requireResearchPersistence('createResearchProject');
  const now = new Date();

  const [createdProject] = await (await ensureDb())
    .insert(researchProject)
    .values({
      id,
      chatId,
      userId,
      status,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return createdProject ?? null;
}

export async function getResearchProjectById({
  id,
}: {
  id: string;
}): Promise<ResearchProject | null> {
  requireResearchPersistence('getResearchProjectById');
  const [project] = await (await ensureDb())
    .select()
    .from(researchProject)
    .where(eq(researchProject.id, id))
    .limit(1);

  return project ?? null;
}

export async function getResearchProjectByChatId({
  chatId,
}: {
  chatId: string;
}): Promise<ResearchProject | null> {
  requireResearchPersistence('getResearchProjectByChatId');
  const [project] = await (await ensureDb())
    .select()
    .from(researchProject)
    .where(eq(researchProject.chatId, chatId))
    .limit(1);

  return project ?? null;
}

export async function getResearchProjectsByUserId({
  userId,
  limit = 50,
}: {
  userId: string;
  limit?: number;
}): Promise<ResearchProjectListItem[]> {
  requireResearchPersistence('getResearchProjectsByUserId');
  const rows = await (await ensureDb())
    .select({
      project: researchProject,
      chatTitle: chat.title,
      chatId: chat.id,
    })
    .from(researchProject)
    .innerJoin(chat, eq(researchProject.chatId, chat.id))
    .where(eq(researchProject.userId, userId))
    .orderBy(desc(researchProject.createdAt))
    .limit(limit);

  return rows;
}

export async function updateResearchProject({
  projectId,
  status,
  activeRunId,
}: {
  projectId: string;
  status?: ResearchProjectStatus;
  activeRunId?: string | null;
}) {
  requireResearchPersistence('updateResearchProject');
  const [updatedProject] = await (await ensureDb())
    .update(researchProject)
    .set({
      ...(status !== undefined ? { status } : {}),
      ...(activeRunId !== undefined ? { activeRunId } : {}),
      updatedAt: new Date(),
    })
    .where(eq(researchProject.id, projectId))
    .returning();

  return updatedProject ?? null;
}

export async function createResearchPlanVersion({
  projectId,
  scopeJson,
  planJson,
  planMarkdown,
  status = 'draft',
  approvedAt = null,
}: {
  projectId: string;
  scopeJson: Record<string, unknown>;
  planJson: Record<string, unknown>;
  planMarkdown: string;
  status?: ResearchPlanStatus;
  approvedAt?: Date | null;
}): Promise<ResearchPlan | null> {
  requireResearchPersistence('createResearchPlanVersion');
  const database = await ensureDb();
  const now = new Date();

  const [latestPlan] = await database
    .select()
    .from(researchPlan)
    .where(eq(researchPlan.projectId, projectId))
    .orderBy(desc(researchPlan.version))
    .limit(1);

  const nextVersion = (latestPlan?.version ?? 0) + 1;

  await database
    .update(researchPlan)
    .set({
      status: 'superseded',
      updatedAt: now,
    })
    .where(
      and(
        eq(researchPlan.projectId, projectId),
        inArray(researchPlan.status, ['draft', 'approved']),
      ),
    );

  const [newPlan] = await database
    .insert(researchPlan)
    .values({
      projectId,
      version: nextVersion,
      status,
      scopeJson,
      planJson,
      planMarkdown,
      approvedAt,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return newPlan ?? null;
}

export async function getLatestResearchPlanByProjectId({
  projectId,
}: {
  projectId: string;
}): Promise<ResearchPlan | null> {
  requireResearchPersistence('getLatestResearchPlanByProjectId');
  const [plan] = await (await ensureDb())
    .select()
    .from(researchPlan)
    .where(eq(researchPlan.projectId, projectId))
    .orderBy(desc(researchPlan.version))
    .limit(1);

  return plan ?? null;
}

export async function getResearchPlanByProjectIdAndVersion({
  projectId,
  version,
}: {
  projectId: string;
  version: number;
}): Promise<ResearchPlan | null> {
  requireResearchPersistence('getResearchPlanByProjectIdAndVersion');
  const [plan] = await (await ensureDb())
    .select()
    .from(researchPlan)
    .where(
      and(eq(researchPlan.projectId, projectId), eq(researchPlan.version, version)),
    )
    .limit(1);

  return plan ?? null;
}

export async function approveLatestResearchPlanByProjectId({
  projectId,
}: {
  projectId: string;
}): Promise<ResearchPlan | null> {
  requireResearchPersistence('approveLatestResearchPlanByProjectId');
  const database = await ensureDb();

  const [latestPlan] = await database
    .select()
    .from(researchPlan)
    .where(eq(researchPlan.projectId, projectId))
    .orderBy(desc(researchPlan.version))
    .limit(1);

  if (!latestPlan) {
    return null;
  }

  const now = new Date();

  await database
    .update(researchPlan)
    .set({
      status: 'superseded',
      updatedAt: now,
    })
    .where(
      and(
        eq(researchPlan.projectId, projectId),
        inArray(researchPlan.status, ['draft', 'approved']),
      ),
    );

  const [approvedPlan] = await database
    .update(researchPlan)
    .set({
      status: 'approved',
      approvedAt: now,
      updatedAt: now,
    })
    .where(eq(researchPlan.id, latestPlan.id))
    .returning();

  return approvedPlan ?? null;
}

export async function createResearchRun({
  id,
  projectId,
  planVersion,
  status = 'queued',
}: {
  id: string;
  projectId: string;
  planVersion: number;
  status?: ResearchRunStatus;
}): Promise<ResearchRun | null> {
  requireResearchPersistence('createResearchRun');
  const now = new Date();

  const [run] = await (await ensureDb())
    .insert(researchRun)
    .values({
      id,
      projectId,
      planVersion,
      status,
      cancellationRequested: false,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return run ?? null;
}

export async function getResearchRunById({
  runId,
}: {
  runId: string;
}): Promise<ResearchRun | null> {
  requireResearchPersistence('getResearchRunById');
  const [run] = await (await ensureDb())
    .select()
    .from(researchRun)
    .where(eq(researchRun.id, runId))
    .limit(1);

  return run ?? null;
}

export async function getLatestResearchRunByProjectId({
  projectId,
}: {
  projectId: string;
}): Promise<ResearchRun | null> {
  requireResearchPersistence('getLatestResearchRunByProjectId');
  const [run] = await (await ensureDb())
    .select()
    .from(researchRun)
    .where(eq(researchRun.projectId, projectId))
    .orderBy(desc(researchRun.createdAt))
    .limit(1);

  return run ?? null;
}

export async function updateResearchRun({
  runId,
  status,
  cancellationRequested,
  finalMarkdown,
  errorText,
  startedAt,
  endedAt,
}: {
  runId: string;
  status?: ResearchRunStatus;
  cancellationRequested?: boolean;
  finalMarkdown?: string | null;
  errorText?: string | null;
  startedAt?: Date | null;
  endedAt?: Date | null;
}): Promise<ResearchRun | null> {
  requireResearchPersistence('updateResearchRun');
  const [updatedRun] = await (await ensureDb())
    .update(researchRun)
    .set({
      ...(status !== undefined ? { status } : {}),
      ...(cancellationRequested !== undefined
        ? { cancellationRequested }
        : {}),
      ...(finalMarkdown !== undefined ? { finalMarkdown } : {}),
      ...(errorText !== undefined ? { errorText } : {}),
      ...(startedAt !== undefined ? { startedAt } : {}),
      ...(endedAt !== undefined ? { endedAt } : {}),
      updatedAt: new Date(),
    })
    .where(eq(researchRun.id, runId))
    .returning();

  return updatedRun ?? null;
}

export async function requestResearchRunCancellation({
  runId,
}: {
  runId: string;
}): Promise<ResearchRun | null> {
  requireResearchPersistence('requestResearchRunCancellation');
  const run = await getResearchRunById({ runId });
  if (!run) {
    return null;
  }

  const nextStatus: ResearchRunStatus =
    run.status === 'queued' || run.status === 'running'
      ? 'cancel_requested'
      : run.status;

  return updateResearchRun({
    runId,
    status: nextStatus,
    cancellationRequested: true,
  });
}

export async function appendResearchRunEvent({
  runId,
  stage,
  level = 'info',
  message: runMessage,
  payload,
}: {
  runId: string;
  stage: ResearchRunStage;
  level?: ResearchRunEventLevel;
  message: string;
  payload?: Record<string, unknown>;
}): Promise<ResearchRunEvent | null> {
  requireResearchPersistence('appendResearchRunEvent');
  const database = await ensureDb();

  const [lastEvent] = await database
    .select()
    .from(researchRunEvent)
    .where(eq(researchRunEvent.runId, runId))
    .orderBy(desc(researchRunEvent.seq))
    .limit(1);

  const [event] = await database
    .insert(researchRunEvent)
    .values({
      runId,
      seq: (lastEvent?.seq ?? 0) + 1,
      stage,
      level,
      message: runMessage,
      payload,
      createdAt: new Date(),
    })
    .returning();

  return event ?? null;
}

export async function getResearchRunEventsByRunId({
  runId,
  afterSeq,
}: {
  runId: string;
  afterSeq?: number;
}): Promise<ResearchRunEvent[]> {
  requireResearchPersistence('getResearchRunEventsByRunId');
  return (await ensureDb())
    .select()
    .from(researchRunEvent)
    .where(
      afterSeq !== undefined
        ? and(eq(researchRunEvent.runId, runId), gt(researchRunEvent.seq, afterSeq))
        : eq(researchRunEvent.runId, runId),
    )
    .orderBy(asc(researchRunEvent.seq));
}
