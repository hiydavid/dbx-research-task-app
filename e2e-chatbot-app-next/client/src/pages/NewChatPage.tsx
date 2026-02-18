import { Chat } from '@/components/chat';
import { useSession } from '@/contexts/SessionContext';
import { useAppConfig } from '@/contexts/AppConfigContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { generateUUID } from '@/lib/utils';

export default function NewChatPage() {
  const { session } = useSession();
  const { chatHistoryEnabled } = useAppConfig();
  const location = useLocation();
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ephemeralChatId, setEphemeralChatId] = useState(() => generateUUID());
  const [modelId, setModelId] = useState('chat-model');

  if (!session?.user) {
    return null;
  }

  // In ephemeral mode (no DB), fall back to direct chat behavior.
  useEffect(() => {
    const savedModel = localStorage.getItem('chat-model');
    if (savedModel) {
      setModelId(savedModel);
    }
  }, []);

  useEffect(() => {
    if (!chatHistoryEnabled) {
      setEphemeralChatId(generateUUID());
    }
  }, [location.key, chatHistoryEnabled]);

  if (!chatHistoryEnabled) {
    return (
      <Chat
        key={ephemeralChatId}
        id={ephemeralChatId}
        initialMessages={[]}
        initialChatModel={modelId}
        initialVisibilityType="private"
        isReadonly={false}
        session={session}
      />
    );
  }

  const createResearchTask = async () => {
    setIsCreating(true);
    setError(null);
    try {
      const response = await fetch('/api/research/projects', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error('Unable to create research task');
      }

      const payload = (await response.json()) as { chat: { id: string } };
      navigate(`/chat/${payload.chat.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create project');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-xl rounded-xl border bg-card p-8">
        <h1 className="font-semibold text-2xl">Start a Research Task</h1>
        <p className="mt-3 text-muted-foreground text-sm">
          Create a new research project, define scope with the planner agent,
          then approve and run execution with live progress tracking.
        </p>
        <div className="mt-6 flex items-center gap-3">
          <Button onClick={createResearchTask} disabled={isCreating}>
            {isCreating ? 'Creating project...' : 'Start Research Task'}
          </Button>
          {error && <span className="text-destructive text-sm">{error}</span>}
        </div>
      </div>
    </div>
  );
}
