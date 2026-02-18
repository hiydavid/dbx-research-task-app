import { expect, test } from '../fixtures';
import { TEST_PROMPTS } from '../prompts/routes';
import { skipInEphemeralMode, skipInWithDatabaseMode } from '../helpers';
import type { APIRequestContext } from '@playwright/test';

async function waitForRunToComplete({
  request,
  projectId,
  runId,
  timeoutMs = 12000,
}: {
  request: APIRequestContext;
  projectId: string;
  runId: string;
  timeoutMs?: number;
}) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const response = await request.get(
      `/api/research/projects/${projectId}/runs/${runId}/result`,
    );
    if (response.ok()) {
      const payload = await response.json();
      if (
        payload?.run?.status === 'succeeded' ||
        payload?.run?.status === 'failed' ||
        payload?.run?.status === 'cancelled'
      ) {
        return payload;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Timed out waiting for run completion');
}

test.describe('/api/research (with database)', () => {
  skipInEphemeralMode(test);

  test('Create project, generate plan, approve, run, and get markdown result', async ({
    adaContext,
  }) => {
    const createResponse = await adaContext.request.post('/api/research/projects', {
      data: {},
    });
    expect(createResponse.status()).toBe(201);

    const createPayload = await createResponse.json();
    const projectId = createPayload.project.id as string;
    const chatId = createPayload.chat.id as string;

    const chatResponse = await adaContext.request.post('/api/chat', {
      data: {
        id: chatId,
        message: TEST_PROMPTS.SKY.MESSAGE,
        selectedChatModel: 'chat-model',
        selectedVisibilityType: 'private',
      },
    });
    expect(chatResponse.status()).toBe(200);
    await chatResponse.text();

    const planResponse = await adaContext.request.get(
      `/api/research/projects/${projectId}/plan`,
    );
    expect(planResponse.status()).toBe(200);
    const planPayload = await planResponse.json();
    expect(planPayload.plan.status).toBe('draft');

    const approveResponse = await adaContext.request.post(
      `/api/research/projects/${projectId}/plan/approve`,
    );
    expect(approveResponse.status()).toBe(200);

    const runResponse = await adaContext.request.post(
      `/api/research/projects/${projectId}/runs`,
    );
    expect(runResponse.status()).toBe(202);
    const runPayload = await runResponse.json();
    const runId = runPayload.run.id as string;

    const eventsResponse = await adaContext.request.get(
      `/api/research/projects/${projectId}/runs/${runId}/events`,
    );
    expect(eventsResponse.status()).toBe(200);
    const eventsPayload = await eventsResponse.json();
    expect(Array.isArray(eventsPayload.events)).toBe(true);

    const resultPayload = await waitForRunToComplete({
      request: adaContext.request,
      projectId,
      runId,
    });
    expect(resultPayload.run.status).toBe('succeeded');
    expect(resultPayload.resultMarkdown).toContain('# Research Result');
  });

  test("User cannot access another user's project", async ({
    adaContext,
    babbageContext,
  }) => {
    const createResponse = await adaContext.request.post('/api/research/projects', {
      data: {},
    });
    expect(createResponse.status()).toBe(201);

    const createPayload = await createResponse.json();
    const projectId = createPayload.project.id as string;

    const forbiddenResponse = await babbageContext.request.get(
      `/api/research/projects/${projectId}`,
    );
    expect([403, 404]).toContain(forbiddenResponse.status());
  });
});

test.describe('/api/research (ephemeral mode)', () => {
  skipInWithDatabaseMode(test);

  test('Research APIs return database error when persistence is unavailable', async ({
    adaContext,
  }) => {
    const response = await adaContext.request.post('/api/research/projects', {
      data: {},
    });
    expect(response.status()).toBe(400);
  });
});
