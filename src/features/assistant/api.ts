import { api } from 'src/lib/api/client';

export interface AssistantResponse {
  answer: string;
  dataUsed: boolean;
  period: { fromDate: string; toDate: string } | null;
  sources: string[];
  responseMode?: 'AI' | 'DETERMINISTIC_FALLBACK' | 'LOCAL_RULE';
}

export interface AssistantHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type AssistantLanguage = 'AUTO' | 'ENGLISH' | 'HINDI';

export const assistantApi = {
  chat(message: string, history: AssistantHistoryMessage[] = [], language: AssistantLanguage = 'AUTO', signal?: AbortSignal) {
    return api.post<AssistantResponse>('/assistant/chat', { message, history, language }, { signal });
  },
};
