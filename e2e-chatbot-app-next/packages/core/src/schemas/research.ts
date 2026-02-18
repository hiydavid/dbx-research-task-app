import { z } from 'zod';

export const researchScopeSchema = z.object({
  title: z.string().min(1),
  objective: z.string().min(1),
  keyQuestions: z.array(z.string().min(1)),
  methodology: z.string().min(1),
  deliverables: z.array(z.string().min(1)),
  constraints: z.array(z.string().min(1)),
  assumptions: z.array(z.string().min(1)),
  acceptanceCriteria: z.array(z.string().min(1)),
});

export const researchPlanArtifactSchema = researchScopeSchema.extend({
  readyForApproval: z.boolean(),
});

export const createResearchProjectBodySchema = z.object({
  title: z.string().trim().min(3).max(120).optional(),
});

export const researchRunEventsQuerySchema = z.object({
  after_seq: z.coerce.number().int().min(0).optional(),
});

export type ResearchPlanArtifactInput = z.infer<
  typeof researchPlanArtifactSchema
>;
