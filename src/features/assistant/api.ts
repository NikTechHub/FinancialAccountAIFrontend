import { api } from 'src/lib/api/client';

export interface AssistantResponse {
  answer: string;
  dataUsed: boolean;
  period: { fromDate: string; toDate: string } | null;
  sources: string[];
}

export const assistantApi = {
  chat(message: string, signal?: AbortSignal) {
    return api.post<AssistantResponse>('/assistant/chat', { message }, { signal });
  },
};
