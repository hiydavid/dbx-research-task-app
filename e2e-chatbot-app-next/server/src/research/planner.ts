import type { DBMessage } from '@chat-template/db';
import {
  createResearchPlanVersion,
  getMessagesByChatId,
  getResearchProjectByChatId,
  updateResearchProject,
} from '@chat-template/db';
import {
  researchPlanArtifactSchema,
  type ResearchPlanArtifact,
} from '@chat-template/core';

function extractMessageText(message: DBMessage): string {
  if (!Array.isArray(message.parts)) {
    return '';
  }

  return message.parts
    .map((part) => {
      if (
        typeof part === 'object' &&
        part !== null &&
        'type' in part &&
        part.type === 'text' &&
        'text' in part &&
        typeof part.text === 'string'
      ) {
        return part.text;
      }
      return '';
    })
    .filter(Boolean)
    .join('\n')
    .trim();
}

function normalizeTitle(input: string) {
  const words = input
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .slice(0, 8);
  return words.join(' ').replace(/[^\w\s-]/g, '').trim() || 'Research task';
}

function extractQuestions(text: string): string[] {
  const matches = text.match(/[^?.!]*\?/g) ?? [];
  const normalized = matches
    .map((q) => q.trim())
    .filter((q) => q.length > 8)
    .slice(0, 6);

  if (normalized.length > 0) {
    return normalized;
  }

  const sentences = text
    .split(/[.!]/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 12)
    .slice(0, 3);

  return sentences.map((sentence) => `How does this affect ${sentence}?`);
}

function dedupeNonEmpty(values: string[]) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

export function buildResearchPlanArtifact(messages: DBMessage[]) {
  const userTexts = messages
    .filter((message) => message.role === 'user')
    .map(extractMessageText)
    .filter(Boolean);
  const assistantTexts = messages
    .filter((message) => message.role === 'assistant')
    .map(extractMessageText)
    .filter(Boolean);

  const conversationText = userTexts.join('\n');
  const firstUserText = userTexts.at(0) ?? 'New research initiative';
  const latestUserText = userTexts.at(-1) ?? firstUserText;

  const constraints = dedupeNonEmpty([
    conversationText.toLowerCase().includes('deadline')
      ? 'Honor the timeline or deadline mentioned by the user.'
      : '',
    conversationText.toLowerCase().includes('budget')
      ? 'Account for budget constraints stated in scope.'
      : '',
    'Phase 1 uses no external tools; rely on provided user context.',
  ]);

  const assumptions = dedupeNonEmpty([
    'Scope can evolve through planner discussion before execution starts.',
    'Findings will be synthesized from available context and reasoning.',
  ]);

  const artifact: ResearchPlanArtifact = {
    title: normalizeTitle(firstUserText),
    objective: latestUserText,
    keyQuestions: extractQuestions(conversationText || latestUserText),
    methodology:
      'Iterative planning, hypothesis framing, context analysis, and synthesized evidence-backed reporting.',
    deliverables: [
      'A structured markdown research report',
      'Key findings and supporting rationale',
      'Open questions and recommended next steps',
    ],
    constraints,
    assumptions,
    acceptanceCriteria: [
      'Research question and scope are clearly articulated',
      'Execution progress is visible by stage',
      'Final result is delivered as markdown',
    ],
    readyForApproval: userTexts.length > 0 && assistantTexts.length > 0,
  };

  return researchPlanArtifactSchema.parse(artifact);
}

export function renderResearchPlanMarkdown(plan: ResearchPlanArtifact): string {
  return [
    `# ${plan.title}`,
    '',
    '## Objective',
    plan.objective,
    '',
    '## Key Questions',
    ...plan.keyQuestions.map((question) => `- ${question}`),
    '',
    '## Methodology',
    plan.methodology,
    '',
    '## Deliverables',
    ...plan.deliverables.map((deliverable) => `- ${deliverable}`),
    '',
    '## Constraints',
    ...plan.constraints.map((constraint) => `- ${constraint}`),
    '',
    '## Assumptions',
    ...plan.assumptions.map((assumption) => `- ${assumption}`),
    '',
    '## Acceptance Criteria',
    ...plan.acceptanceCriteria.map((criterion) => `- ${criterion}`),
    '',
    `Plan ready for approval: ${plan.readyForApproval ? 'Yes' : 'No'}`,
  ].join('\n');
}

export async function syncResearchPlanFromChat({
  chatId,
  userId,
}: {
  chatId: string;
  userId: string;
}) {
  const project = await getResearchProjectByChatId({ chatId });
  if (!project || project.userId !== userId) {
    return null;
  }

  const messages = await getMessagesByChatId({ id: chatId });
  if (messages.length === 0) {
    return null;
  }

  const plan = buildResearchPlanArtifact(messages);
  const planMarkdown = renderResearchPlanMarkdown(plan);

  const savedPlan = await createResearchPlanVersion({
    projectId: project.id,
    scopeJson: {
      title: plan.title,
      objective: plan.objective,
      keyQuestions: plan.keyQuestions,
    },
    planJson: plan,
    planMarkdown,
  });

  // Running projects keep their status until the current run finishes.
  if (project.status !== 'running') {
    await updateResearchProject({
      projectId: project.id,
      status: plan.readyForApproval ? 'plan_ready' : 'planning',
    });
  }

  return savedPlan;
}
