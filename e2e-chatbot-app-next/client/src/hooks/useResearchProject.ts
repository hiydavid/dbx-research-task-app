import useSWR from 'swr';
import type {
  ResearchPlan,
  ResearchProject,
  ResearchRun,
} from '@chat-template/db';

export interface ResearchProjectPayload {
  project: ResearchProject;
  latestPlan: ResearchPlan | null;
  latestRun: ResearchRun | null;
  activeRun: ResearchRun | null;
}

async function fetchResearchProject(url: string): Promise<ResearchProjectPayload | null> {
  const response = await fetch(url, {
    credentials: 'include',
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error('Failed to load research project');
  }

  return response.json();
}

export function useResearchProjectByChat(chatId: string | undefined) {
  const { data, isLoading, error, mutate } = useSWR<ResearchProjectPayload | null>(
    chatId ? `/api/research/projects/by-chat/${chatId}` : null,
    fetchResearchProject,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 1000,
    },
  );

  return {
    researchData: data,
    isLoading,
    error: error ? 'Failed to load research project' : null,
    mutate,
  };
}
