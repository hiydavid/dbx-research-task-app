import { EventEmitter } from 'node:events';
import type { ResearchRunEvent } from '@chat-template/db';

const runEventEmitter = new EventEmitter();
runEventEmitter.setMaxListeners(100);

function getRunChannel(runId: string) {
  return `research-run:${runId}`;
}

export function publishResearchRunEvent(event: ResearchRunEvent) {
  runEventEmitter.emit(getRunChannel(event.runId), event);
}

export function subscribeResearchRunEvents(
  runId: string,
  handler: (event: ResearchRunEvent) => void,
) {
  const channel = getRunChannel(runId);
  runEventEmitter.on(channel, handler);

  return () => {
    runEventEmitter.off(channel, handler);
  };
}
