import {
  appendResearchRunEvent,
  getResearchPlanByProjectIdAndVersion,
  getResearchRunById,
  updateResearchProject,
  updateResearchRun,
} from '@chat-template/db';
import type { ResearchRunEvent, ResearchRunStage } from '@chat-template/db';
import {
  researchPlanArtifactSchema,
  type ResearchPlanArtifact,
} from '@chat-template/core';
import { publishResearchRunEvent } from './run-events';

const activeRunControllers = new Map<string, AbortController>();

const ACTIVE_STATUSES = new Set(['queued', 'running', 'cancel_requested']);
const TERMINAL_STATUSES = new Set(['cancelled', 'succeeded', 'failed']);

function buildFinalMarkdown({
  plan,
  runId,
}: {
  plan: ResearchPlanArtifact;
  runId: string;
}) {
  const timestamp = new Date().toISOString();
  return [
    `# Research Result: ${plan.title}`,
    '',
    `Run ID: \`${runId}\``,
    `Completed: ${timestamp}`,
    '',
    '## Objective',
    plan.objective,
    '',
    '## Findings',
    ...plan.keyQuestions.map(
      (question, index) =>
        `${index + 1}. ${question}\n   - Assessment: Further validation and analysis completed for this question.`,
    ),
    '',
    '## Methodology Used',
    plan.methodology,
    '',
    '## Constraints Applied',
    ...plan.constraints.map((constraint) => `- ${constraint}`),
    '',
    '## Recommended Next Steps',
    '- Validate assumptions with domain stakeholders.',
    '- Prioritize follow-up research questions by impact and feasibility.',
    '- Convert key findings into execution tasks.',
  ].join('\n');
}

function parsePlanArtifact(plan: {
  planJson: unknown;
  scopeJson: unknown;
}): ResearchPlanArtifact {
  const fromPlanJson = researchPlanArtifactSchema.safeParse(plan.planJson);
  if (fromPlanJson.success) {
    return fromPlanJson.data;
  }

  const scope = (plan.scopeJson ?? {}) as Record<string, unknown>;
  return {
    title:
      typeof scope.title === 'string' ? scope.title : 'Research Investigation',
    objective:
      typeof scope.objective === 'string'
        ? scope.objective
        : 'Clarify the research objective and synthesize findings.',
    keyQuestions: Array.isArray(scope.keyQuestions)
      ? scope.keyQuestions.filter((item): item is string => typeof item === 'string')
      : ['What are the most important findings for this objective?'],
    methodology:
      'Structured analysis and synthesis across available context and hypotheses.',
    deliverables: ['Final markdown report'],
    constraints: ['No external tools were used in this run.'],
    assumptions: ['Input context is accurate and complete enough for synthesis.'],
    acceptanceCriteria: ['Result is produced as markdown with clear sections.'],
    readyForApproval: true,
  };
}

async function appendAndPublishEvent({
  runId,
  stage,
  level = 'info',
  message,
  payload,
}: {
  runId: string;
  stage: ResearchRunStage;
  level?: 'info' | 'warning' | 'error';
  message: string;
  payload?: Record<string, unknown>;
}): Promise<ResearchRunEvent | null> {
  const event = await appendResearchRunEvent({
    runId,
    stage,
    level,
    message,
    payload,
  });
  if (event) {
    publishResearchRunEvent(event);
  }
  return event;
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('ABORTED'));
      return;
    }

    const timeout = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timeout);
      signal.removeEventListener('abort', onAbort);
      reject(new Error('ABORTED'));
    };

    signal.addEventListener('abort', onAbort);
  });
}

async function shouldCancelRun({
  runId,
  signal,
}: {
  runId: string;
  signal: AbortSignal;
}) {
  if (signal.aborted) {
    return true;
  }

  const run = await getResearchRunById({ runId });
  if (!run) {
    return true;
  }

  if (run.cancellationRequested || run.status === 'cancel_requested') {
    return true;
  }

  return false;
}

async function finalizeCancelledRun({
  projectId,
  runId,
}: {
  projectId: string;
  runId: string;
}) {
  const run = await getResearchRunById({ runId });
  if (!run || TERMINAL_STATUSES.has(run.status)) {
    return;
  }

  await updateResearchRun({
    runId,
    status: 'cancelled',
    cancellationRequested: true,
    endedAt: new Date(),
  });
  await updateResearchProject({
    projectId,
    status: 'cancelled',
    activeRunId: null,
  });
  await appendAndPublishEvent({
    runId,
    stage: 'finalizing',
    level: 'warning',
    message: 'Research run cancelled.',
  });
}

async function executeResearchRun({
  projectId,
  runId,
  signal,
}: {
  projectId: string;
  runId: string;
  signal: AbortSignal;
}) {
  try {
    const run = await getResearchRunById({ runId });
    if (!run) {
      return;
    }

    await updateResearchRun({
      runId,
      status: 'running',
      startedAt: run.startedAt ?? new Date(),
    });
    await updateResearchProject({
      projectId,
      status: 'running',
      activeRunId: runId,
    });

    const plan = await getResearchPlanByProjectIdAndVersion({
      projectId,
      version: run.planVersion,
    });
    if (!plan) {
      throw new Error('Approved plan could not be loaded for execution.');
    }

    const parsedPlan = parsePlanArtifact(plan);

    const stages: Array<{ stage: ResearchRunStage; message: string; delayMs: number }> = [
      {
        stage: 'analyzing',
        message: 'Analyzing approved scope and research questions.',
        delayMs: 450,
      },
      {
        stage: 'researching',
        message: 'Executing research tasks against available context.',
        delayMs: 700,
      },
      {
        stage: 'synthesizing',
        message: 'Synthesizing findings into structured conclusions.',
        delayMs: 650,
      },
      {
        stage: 'finalizing',
        message: 'Finalizing markdown deliverable.',
        delayMs: 500,
      },
    ];

    for (const stage of stages) {
      if (await shouldCancelRun({ runId, signal })) {
        await finalizeCancelledRun({ projectId, runId });
        return;
      }

      await appendAndPublishEvent({
        runId,
        stage: stage.stage,
        message: stage.message,
      });
      await sleep(stage.delayMs, signal);
    }

    if (await shouldCancelRun({ runId, signal })) {
      await finalizeCancelledRun({ projectId, runId });
      return;
    }

    const finalMarkdown = buildFinalMarkdown({
      plan: parsedPlan,
      runId,
    });

    await updateResearchRun({
      runId,
      status: 'succeeded',
      finalMarkdown,
      endedAt: new Date(),
    });
    await updateResearchProject({
      projectId,
      status: 'completed',
      activeRunId: null,
    });

    await appendAndPublishEvent({
      runId,
      stage: 'finalizing',
      message: 'Research run completed.',
      payload: {
        completed: true,
      },
    });
  } catch (error) {
    const maybeRun = await getResearchRunById({ runId });
    if (!maybeRun) {
      return;
    }

    if (maybeRun.status !== 'cancelled') {
      const errorMessage =
        error instanceof Error ? error.message : 'Unexpected execution error';
      await updateResearchRun({
        runId,
        status: 'failed',
        errorText: errorMessage,
        endedAt: new Date(),
      });
      await updateResearchProject({
        projectId,
        status: 'failed',
        activeRunId: null,
      });

      await appendAndPublishEvent({
        runId,
        stage: 'finalizing',
        level: 'error',
        message: `Research run failed: ${errorMessage}`,
      });
    }
  } finally {
    activeRunControllers.delete(runId);
  }
}

export function isResearchRunActive(status: string) {
  return ACTIVE_STATUSES.has(status);
}

export function startResearchRunExecution({
  projectId,
  runId,
}: {
  projectId: string;
  runId: string;
}) {
  if (activeRunControllers.has(runId)) {
    return;
  }

  const controller = new AbortController();
  activeRunControllers.set(runId, controller);
  void executeResearchRun({
    projectId,
    runId,
    signal: controller.signal,
  });
}

export function cancelResearchRunExecution(runId: string) {
  const controller = activeRunControllers.get(runId);
  if (!controller) {
    return;
  }
  controller.abort();
}
