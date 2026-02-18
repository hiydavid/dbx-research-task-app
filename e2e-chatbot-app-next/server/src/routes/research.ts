import { Router, type Request, type Response, type Router as RouterType } from 'express';
import {
  appendResearchRunEvent,
  approveLatestResearchPlanByProjectId,
  createResearchProject,
  createResearchRun,
  getLatestResearchPlanByProjectId,
  getLatestResearchRunByProjectId,
  getResearchPlanByProjectIdAndVersion,
  getResearchProjectByChatId,
  getResearchProjectById,
  getResearchProjectsByUserId,
  getResearchRunById,
  getResearchRunEventsByRunId,
  isDatabaseAvailable,
  saveChat,
  updateResearchProject,
  requestResearchRunCancellation,
} from '@chat-template/db';
import {
  createResearchProjectBodySchema,
  generateUUID,
  researchRunEventsQuerySchema,
} from '@chat-template/core';
import { ChatSDKError } from '@chat-template/core/errors';
import {
  authMiddleware,
  requireAuth,
} from '../middleware/auth';
import {
  cancelResearchRunExecution,
  isResearchRunActive,
  startResearchRunExecution,
} from '../research/executor';
import {
  publishResearchRunEvent,
  subscribeResearchRunEvents,
} from '../research/run-events';

export const researchRouter: RouterType = Router();

researchRouter.use(authMiddleware);

function ensureDatabase(res: Response) {
  if (!isDatabaseAvailable()) {
    const error = new ChatSDKError(
      'bad_request:database',
      'Research workflows require database persistence.',
    );
    const response = error.toResponse();
    res.status(response.status).json(response.json);
    return false;
  }
  return true;
}

async function getProjectForUser({
  projectId,
  userId,
}: {
  projectId: string;
  userId: string;
}) {
  const project = await getResearchProjectById({ id: projectId });
  if (!project) {
    return {
      project: null,
      error: new ChatSDKError('not_found:chat', 'Research project not found'),
    };
  }
  if (project.userId !== userId) {
    return {
      project: null,
      error: new ChatSDKError('forbidden:chat', 'User cannot access project'),
    };
  }
  return { project, error: null };
}

async function buildProjectPayload(projectId: string) {
  const project = await getResearchProjectById({ id: projectId });
  if (!project) {
    return null;
  }

  const latestPlan = await getLatestResearchPlanByProjectId({ projectId });
  const latestRun = await getLatestResearchRunByProjectId({ projectId });
  const activeRun = project.activeRunId
    ? await getResearchRunById({ runId: project.activeRunId })
    : null;

  return {
    project,
    latestPlan,
    latestRun,
    activeRun,
  };
}

researchRouter.post('/projects', requireAuth, async (req: Request, res: Response) => {
  if (!ensureDatabase(res)) {
    return;
  }

  const parsedBody = createResearchProjectBodySchema.safeParse(req.body ?? {});
  if (!parsedBody.success) {
    const error = new ChatSDKError('bad_request:api');
    const response = error.toResponse();
    return res.status(response.status).json(response.json);
  }

  const session = req.session;
  if (!session) {
    const error = new ChatSDKError('unauthorized:chat');
    const response = error.toResponse();
    return res.status(response.status).json(response.json);
  }

  const projectId = generateUUID();
  const chatId = generateUUID();
  const title =
    parsedBody.data.title ??
    `Research task ${new Date().toLocaleDateString('en-US')}`;

  await saveChat({
    id: chatId,
    userId: session.user.id,
    title,
    visibility: 'private',
  });

  const project = await createResearchProject({
    id: projectId,
    chatId,
    userId: session.user.id,
  });

  return res.status(201).json({
    project,
    chat: {
      id: chatId,
      title,
      visibility: 'private',
    },
  });
});

researchRouter.get('/projects', requireAuth, async (req: Request, res: Response) => {
  if (!ensureDatabase(res)) {
    return;
  }

  const session = req.session;
  if (!session) {
    const error = new ChatSDKError('unauthorized:chat');
    const response = error.toResponse();
    return res.status(response.status).json(response.json);
  }

  const projects = await getResearchProjectsByUserId({
    userId: session.user.id,
  });
  return res.status(200).json({ projects });
});

researchRouter.get(
  '/projects/by-chat/:chatId',
  requireAuth,
  async (req: Request, res: Response) => {
    if (!ensureDatabase(res)) {
      return;
    }

    const session = req.session;
    const chatId = req.params.chatId;
    if (!session || !chatId) {
      const error = new ChatSDKError('unauthorized:chat');
      const response = error.toResponse();
      return res.status(response.status).json(response.json);
    }

    const project = await getResearchProjectByChatId({ chatId });
    if (!project || project.userId !== session.user.id) {
      return res.status(404).json({ error: 'Research project not found' });
    }

    const payload = await buildProjectPayload(project.id);
    return res.status(200).json(payload);
  },
);

researchRouter.get(
  '/projects/:id',
  requireAuth,
  async (req: Request, res: Response) => {
    if (!ensureDatabase(res)) {
      return;
    }

    const session = req.session;
    const projectId = req.params.id;
    if (!session || !projectId) {
      const error = new ChatSDKError('unauthorized:chat');
      const response = error.toResponse();
      return res.status(response.status).json(response.json);
    }

    const { project, error } = await getProjectForUser({
      projectId,
      userId: session.user.id,
    });
    if (!project || error) {
      const response = (error ?? new ChatSDKError('not_found:chat')).toResponse();
      return res.status(response.status).json(response.json);
    }

    const payload = await buildProjectPayload(project.id);
    return res.status(200).json(payload);
  },
);

researchRouter.get(
  '/projects/:id/plan',
  requireAuth,
  async (req: Request, res: Response) => {
    if (!ensureDatabase(res)) {
      return;
    }

    const session = req.session;
    const projectId = req.params.id;
    if (!session || !projectId) {
      const error = new ChatSDKError('unauthorized:chat');
      const response = error.toResponse();
      return res.status(response.status).json(response.json);
    }

    const { project, error } = await getProjectForUser({
      projectId,
      userId: session.user.id,
    });
    if (!project || error) {
      const response = (error ?? new ChatSDKError('not_found:chat')).toResponse();
      return res.status(response.status).json(response.json);
    }

    const latestPlan = await getLatestResearchPlanByProjectId({
      projectId: project.id,
    });
    if (!latestPlan) {
      return res.status(404).json({ error: 'No plan exists for this project' });
    }

    return res.status(200).json({
      plan: latestPlan,
      projectStatus: project.status,
    });
  },
);

researchRouter.post(
  '/projects/:id/plan/approve',
  requireAuth,
  async (req: Request, res: Response) => {
    if (!ensureDatabase(res)) {
      return;
    }

    const session = req.session;
    const projectId = req.params.id;
    if (!session || !projectId) {
      const error = new ChatSDKError('unauthorized:chat');
      const response = error.toResponse();
      return res.status(response.status).json(response.json);
    }

    const { project, error } = await getProjectForUser({
      projectId,
      userId: session.user.id,
    });
    if (!project || error) {
      const response = (error ?? new ChatSDKError('not_found:chat')).toResponse();
      return res.status(response.status).json(response.json);
    }

    const approvedPlan = await approveLatestResearchPlanByProjectId({
      projectId: project.id,
    });
    if (!approvedPlan) {
      return res.status(404).json({ error: 'No plan available to approve' });
    }

    const updatedProject = await updateResearchProject({
      projectId: project.id,
      status: 'approved',
    });

    return res.status(200).json({
      plan: approvedPlan,
      project: updatedProject,
    });
  },
);

researchRouter.post(
  '/projects/:id/runs',
  requireAuth,
  async (req: Request, res: Response) => {
    if (!ensureDatabase(res)) {
      return;
    }

    const session = req.session;
    const projectId = req.params.id;
    if (!session || !projectId) {
      const error = new ChatSDKError('unauthorized:chat');
      const response = error.toResponse();
      return res.status(response.status).json(response.json);
    }

    const { project, error } = await getProjectForUser({
      projectId,
      userId: session.user.id,
    });
    if (!project || error) {
      const response = (error ?? new ChatSDKError('not_found:chat')).toResponse();
      return res.status(response.status).json(response.json);
    }

    if (project.activeRunId) {
      const activeRun = await getResearchRunById({ runId: project.activeRunId });
      if (activeRun && isResearchRunActive(activeRun.status)) {
        return res.status(409).json({
          error: 'A research run is already active for this project.',
        });
      }
    }

    const latestPlan = await getLatestResearchPlanByProjectId({
      projectId: project.id,
    });

    if (!latestPlan || latestPlan.status !== 'approved') {
      return res.status(409).json({
        error: 'Plan must be explicitly approved before execution can start.',
      });
    }

    const runId = generateUUID();
    const run = await createResearchRun({
      id: runId,
      projectId: project.id,
      planVersion: latestPlan.version,
      status: 'queued',
    });

    await updateResearchProject({
      projectId: project.id,
      status: 'running',
      activeRunId: runId,
    });

    const queuedEvent = await appendResearchRunEvent({
      runId,
      stage: 'queued',
      message: 'Research run queued.',
    });
    if (queuedEvent) {
      publishResearchRunEvent(queuedEvent);
    }

    startResearchRunExecution({
      projectId: project.id,
      runId,
    });

    return res.status(202).json({
      run,
      projectId: project.id,
    });
  },
);

researchRouter.post(
  '/projects/:id/runs/:runId/cancel',
  requireAuth,
  async (req: Request, res: Response) => {
    if (!ensureDatabase(res)) {
      return;
    }

    const session = req.session;
    const projectId = req.params.id;
    const runId = req.params.runId;

    if (!session || !projectId || !runId) {
      const error = new ChatSDKError('unauthorized:chat');
      const response = error.toResponse();
      return res.status(response.status).json(response.json);
    }

    const { project, error } = await getProjectForUser({
      projectId,
      userId: session.user.id,
    });
    if (!project || error) {
      const response = (error ?? new ChatSDKError('not_found:chat')).toResponse();
      return res.status(response.status).json(response.json);
    }

    const run = await getResearchRunById({ runId });
    if (!run || run.projectId !== project.id) {
      return res.status(404).json({ error: 'Run not found for this project' });
    }

    const updatedRun = await requestResearchRunCancellation({ runId });
    cancelResearchRunExecution(runId);

    return res.status(200).json({
      run: updatedRun,
    });
  },
);

researchRouter.get(
  '/projects/:id/runs/:runId/events',
  requireAuth,
  async (req: Request, res: Response) => {
    if (!ensureDatabase(res)) {
      return;
    }

    const session = req.session;
    const projectId = req.params.id;
    const runId = req.params.runId;

    if (!session || !projectId || !runId) {
      const error = new ChatSDKError('unauthorized:chat');
      const response = error.toResponse();
      return res.status(response.status).json(response.json);
    }

    const { project, error } = await getProjectForUser({
      projectId,
      userId: session.user.id,
    });
    if (!project || error) {
      const response = (error ?? new ChatSDKError('not_found:chat')).toResponse();
      return res.status(response.status).json(response.json);
    }

    const run = await getResearchRunById({ runId });
    if (!run || run.projectId !== project.id) {
      return res.status(404).json({ error: 'Run not found for this project' });
    }

    const parsedQuery = researchRunEventsQuerySchema.safeParse(req.query ?? {});
    if (!parsedQuery.success) {
      return res.status(400).json({ error: 'Invalid query params' });
    }

    const events = await getResearchRunEventsByRunId({
      runId,
      afterSeq: parsedQuery.data.after_seq,
    });
    return res.status(200).json({ events });
  },
);

researchRouter.get(
  '/projects/:id/runs/:runId/events/stream',
  requireAuth,
  async (req: Request, res: Response) => {
    if (!ensureDatabase(res)) {
      return;
    }

    const session = req.session;
    const projectId = req.params.id;
    const runId = req.params.runId;

    if (!session || !projectId || !runId) {
      const error = new ChatSDKError('unauthorized:chat');
      const response = error.toResponse();
      return res.status(response.status).json(response.json);
    }

    const { project, error } = await getProjectForUser({
      projectId,
      userId: session.user.id,
    });
    if (!project || error) {
      const response = (error ?? new ChatSDKError('not_found:chat')).toResponse();
      return res.status(response.status).json(response.json);
    }

    const run = await getResearchRunById({ runId });
    if (!run || run.projectId !== project.id) {
      return res.status(404).json({ error: 'Run not found for this project' });
    }

    const parsedQuery = researchRunEventsQuerySchema.safeParse(req.query ?? {});
    if (!parsedQuery.success) {
      return res.status(400).json({ error: 'Invalid query params' });
    }

    const afterSeq = parsedQuery.data.after_seq;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const existingEvents = await getResearchRunEventsByRunId({
      runId,
      afterSeq,
    });
    for (const event of existingEvents) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }

    const unsubscribe = subscribeResearchRunEvents(runId, (event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    });

    const ping = setInterval(() => {
      res.write(`event: ping\ndata: ${Date.now()}\n\n`);
    }, 15000);

    req.on('close', () => {
      unsubscribe();
      clearInterval(ping);
      res.end();
    });
  },
);

researchRouter.get(
  '/projects/:id/runs/:runId/result',
  requireAuth,
  async (req: Request, res: Response) => {
    if (!ensureDatabase(res)) {
      return;
    }

    const session = req.session;
    const projectId = req.params.id;
    const runId = req.params.runId;

    if (!session || !projectId || !runId) {
      const error = new ChatSDKError('unauthorized:chat');
      const response = error.toResponse();
      return res.status(response.status).json(response.json);
    }

    const { project, error } = await getProjectForUser({
      projectId,
      userId: session.user.id,
    });
    if (!project || error) {
      const response = (error ?? new ChatSDKError('not_found:chat')).toResponse();
      return res.status(response.status).json(response.json);
    }

    const run = await getResearchRunById({ runId });
    if (!run || run.projectId !== project.id) {
      return res.status(404).json({ error: 'Run not found for this project' });
    }

    const plan = await getResearchPlanByProjectIdAndVersion({
      projectId: project.id,
      version: run.planVersion,
    });

    return res.status(200).json({
      run,
      plan,
      resultMarkdown: run.finalMarkdown,
    });
  },
);
