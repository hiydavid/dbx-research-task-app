import { z } from 'zod';
import type { LanguageModelUsage, UIMessage } from 'ai';

const messageMetadataSchema = z.object({
  createdAt: z.string(),
});

type MessageMetadata = z.infer<typeof messageMetadataSchema>;


export type CustomUIDataTypes = {
  error: string;
  usage: LanguageModelUsage;
};

export type ChatMessage = UIMessage<
  MessageMetadata,
  CustomUIDataTypes
>;

export interface Attachment {
  name: string;
  url: string;
  contentType: string;
}

export type { VisibilityType } from '@chat-template/utils';

export type ResearchRunStage =
  | 'queued'
  | 'analyzing'
  | 'researching'
  | 'synthesizing'
  | 'finalizing';

export type ResearchRunEventLevel = 'info' | 'warning' | 'error';

export interface ResearchScope {
  title: string;
  objective: string;
  keyQuestions: string[];
  methodology: string;
  deliverables: string[];
  constraints: string[];
  assumptions: string[];
  acceptanceCriteria: string[];
}

export interface ResearchPlanArtifact extends ResearchScope {
  readyForApproval: boolean;
}
