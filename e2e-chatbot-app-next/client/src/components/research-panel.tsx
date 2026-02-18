import { useEffect, useMemo, useState } from 'react';
import { Button } from './ui/button';
import { Response } from './elements/response';
import { useResearchProjectByChat } from '@/hooks/useResearchProject';
import type { ResearchRunEvent, ResearchRunStatus } from '@chat-template/db';

type PanelTab = 'scope' | 'plan' | 'progress' | 'result';

function isRunActive(status: ResearchRunStatus) {
  return (
    status === 'queued' || status === 'running' || status === 'cancel_requested'
  );
}

export function ResearchPanel({ chatId }: { chatId: string }) {
  const [selectedTab, setSelectedTab] = useState<PanelTab>('scope');
  const [events, setEvents] = useState<ResearchRunEvent[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { researchData, mutate, isLoading, error } = useResearchProjectByChat(chatId);

  const project = researchData?.project ?? null;
  const latestPlan = researchData?.latestPlan ?? null;
  const latestRun = researchData?.latestRun ?? null;
  const activeRun = researchData?.activeRun ?? null;

  const runForDisplay = activeRun ?? latestRun;
  const isActive = runForDisplay ? isRunActive(runForDisplay.status) : false;

  const scope = useMemo(() => {
    if (!latestPlan?.scopeJson || typeof latestPlan.scopeJson !== 'object') {
      return null;
    }
    return latestPlan.scopeJson as {
      title?: string;
      objective?: string;
      keyQuestions?: string[];
    };
  }, [latestPlan?.scopeJson]);

  useEffect(() => {
    const runId = runForDisplay?.id;
    const projectId = project?.id;
    if (!runId || !projectId) {
      setEvents([]);
      return;
    }

    const load = async () => {
      const response = await fetch(
        `/api/research/projects/${projectId}/runs/${runId}/events`,
        {
          credentials: 'include',
        },
      );
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as { events: ResearchRunEvent[] };
      setEvents(payload.events ?? []);
    };

    void load();
  }, [runForDisplay?.id, project?.id]);

  useEffect(() => {
    const runId = activeRun?.id;
    const projectId = project?.id;
    if (!runId || !projectId) {
      return;
    }

    const latestSeq = events.at(-1)?.seq ?? 0;
    const streamUrl = `/api/research/projects/${projectId}/runs/${runId}/events/stream?after_seq=${latestSeq}`;
    const source = new EventSource(streamUrl);

    source.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as ResearchRunEvent;
        setEvents((prev) => {
          if (prev.some((existing) => existing.id === parsed.id)) {
            return prev;
          }
          return [...prev, parsed];
        });
      } catch (err) {
        console.warn('Unable to parse run event', err);
      }
    };

    source.onerror = () => {
      source.close();
    };

    return () => {
      source.close();
    };
  }, [activeRun?.id, project?.id]);

  const postAction = async (url: string) => {
    setIsSubmitting(true);
    try {
      await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
    } finally {
      setIsSubmitting(false);
      await mutate();
    }
  };

  const onApprove = async () => {
    if (!project) return;
    await postAction(`/api/research/projects/${project.id}/plan/approve`);
    setSelectedTab('plan');
  };

  const onStart = async () => {
    if (!project) return;
    await postAction(`/api/research/projects/${project.id}/runs`);
    setSelectedTab('progress');
  };

  const onCancel = async () => {
    if (!project || !runForDisplay) return;
    await postAction(
      `/api/research/projects/${project.id}/runs/${runForDisplay.id}/cancel`,
    );
    setSelectedTab('progress');
  };

  const showApprove =
    !!latestPlan && latestPlan.status === 'draft' && !isActive;
  const showStart =
    !!latestPlan && latestPlan.status === 'approved' && !isActive;
  const showCancel = !!runForDisplay && isActive;
  const showRerun =
    !!latestPlan &&
    latestPlan.status === 'approved' &&
    !!latestRun &&
    !isActive;

  return (
    <aside
      data-testid="research-panel"
      className="flex h-full w-full min-w-0 flex-col border-l border-border/60 bg-muted/20"
    >
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="font-semibold text-sm">Research Workspace</div>
        <div data-testid="research-project-status" className="text-muted-foreground text-xs">
          {project?.status ?? 'planning'}
        </div>
      </div>

      <div className="flex gap-1 border-b p-2">
        {(['scope', 'plan', 'progress', 'result'] as PanelTab[]).map((tab) => (
          <Button
            key={tab}
            variant={selectedTab === tab ? 'default' : 'ghost'}
            size="sm"
            className="h-8 px-2 capitalize text-xs"
            onClick={() => setSelectedTab(tab)}
          >
            {tab}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 border-b px-3 py-2">
        {showApprove && (
          <Button
            size="sm"
            className="h-8"
            disabled={isSubmitting}
            onClick={onApprove}
            data-testid="approve-plan-button"
          >
            Approve Plan
          </Button>
        )}
        {showStart && (
          <Button
            size="sm"
            className="h-8"
            disabled={isSubmitting}
            onClick={onStart}
            data-testid="start-research-button"
          >
            Start Research
          </Button>
        )}
        {showCancel && (
          <Button
            size="sm"
            variant="destructive"
            className="h-8"
            disabled={isSubmitting}
            onClick={onCancel}
            data-testid="cancel-run-button"
          >
            Cancel Run
          </Button>
        )}
        {showRerun && (
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            disabled={isSubmitting}
            onClick={onStart}
            data-testid="rerun-button"
          >
            Re-run
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {isLoading && <div className="text-muted-foreground text-sm">Loading research workspace...</div>}
        {error && <div className="text-destructive text-sm">{error}</div>}

        {!isLoading && !project && (
          <div className="text-muted-foreground text-sm">
            This chat is not attached to a research project.
          </div>
        )}

        {project && selectedTab === 'scope' && (
          <div className="space-y-3">
            <div>
              <h3 className="font-medium text-sm">Objective</h3>
              <p className="mt-1 text-sm">{scope?.objective ?? 'Not defined yet.'}</p>
            </div>
            <div>
              <h3 className="font-medium text-sm">Key Questions</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                {(scope?.keyQuestions ?? []).map((question) => (
                  <li key={question}>{question}</li>
                ))}
                {(scope?.keyQuestions ?? []).length === 0 && (
                  <li className="list-none text-muted-foreground">
                    No key questions captured yet.
                  </li>
                )}
              </ul>
            </div>
          </div>
        )}

        {project && selectedTab === 'plan' && (
          <div className="space-y-3">
            {!latestPlan && (
              <div className="text-muted-foreground text-sm">
                The planner will generate a draft plan after your first exchange.
              </div>
            )}
            {latestPlan && <Response>{latestPlan.planMarkdown}</Response>}
          </div>
        )}

        {project && selectedTab === 'progress' && (
          <div className="space-y-3">
            {!runForDisplay && (
              <div className="text-muted-foreground text-sm">
                Start research to view live execution progress.
              </div>
            )}
            {runForDisplay && (
              <>
                <div className="rounded-md border bg-background px-3 py-2 text-sm">
                  Status:{' '}
                  <span data-testid="research-run-status" className="font-medium">
                    {runForDisplay.status}
                  </span>
                </div>
                <ol data-testid="research-events" className="space-y-2">
                  {events.map((event) => (
                    <li
                      key={event.id}
                      className="rounded-md border bg-background px-3 py-2"
                    >
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        {event.stage}
                      </div>
                      <div className="mt-1 text-sm">{event.message}</div>
                    </li>
                  ))}
                  {events.length === 0 && (
                    <li className="text-muted-foreground text-sm">
                      No events yet.
                    </li>
                  )}
                </ol>
              </>
            )}
          </div>
        )}

        {project && selectedTab === 'result' && (
          <div className="space-y-3">
            {!latestRun?.finalMarkdown && (
              <div className="text-muted-foreground text-sm">
                Final markdown will appear here when execution completes.
              </div>
            )}
            {latestRun?.finalMarkdown && (
              <div data-testid="research-result-markdown">
                <Response>{latestRun.finalMarkdown}</Response>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
