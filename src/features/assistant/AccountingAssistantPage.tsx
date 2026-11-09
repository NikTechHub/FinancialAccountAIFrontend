import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError } from 'src/lib/api/client';
import { Alert, AlertDescription, AlertTitle } from 'src/components/ui/alert';
import { Button } from 'src/components/ui/button';
import CardBox from 'src/components/shared/CardBox';
import { Textarea } from 'src/components/ui/textarea';
import { useAuth } from 'src/features/auth/useAuth';
import BreadcrumbComp from 'src/layouts/full/shared/breadcrumb/BreadcrumbComp';
import { assistantApi, type AssistantResponse } from './api';

interface Turn {
  id: number;
  question: string;
  response: AssistantResponse | null;
  error: string | null;
}

function assistantError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.kind === 'network') return 'Unable to reach the server. Check your connection and try again.';
    if (error.kind === 'parse') return 'The assistant returned an unexpected response. Please try again.';
    if (error.status === 401) return 'Your session has expired. Please sign in again.';
    if (error.status === 403) return 'You do not have permission to use the assistant.';
    if (error.status === 400) return 'The question was not accepted. Check that it is not blank and is 2,000 characters or fewer.';
    return 'The assistant could not answer that request. Please try again.';
  }
  return 'The assistant could not answer that request. Please try again.';
}

export function AccountingAssistantPage() {
  const { organization } = useAuth();
  const [draft, setDraft] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const nextId = useRef(0);
  const sendingRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  async function submitQuestion(question: string, id: number) {
    if (sendingRef.current) return;
    sendingRef.current = true;
    const controller = new AbortController();
    controllerRef.current = controller;
    setSendingId(id);
    setTurns((current) => current.map((turn) => turn.id === id ? { ...turn, error: null } : turn));
    try {
      const response = await assistantApi.chat(question, controller.signal);
      if (controller.signal.aborted) return;
      if (typeof response.answer !== 'string' || typeof response.dataUsed !== 'boolean' ||
          !Array.isArray(response.sources) || !response.sources.every((source) => typeof source === 'string') ||
          (response.period !== null && (!response.period || typeof response.period.fromDate !== 'string' || typeof response.period.toDate !== 'string'))) {
        throw new ApiError('Invalid assistant response', { kind: 'parse' });
      }
      setTurns((current) => current.map((turn) => turn.id === id ? { ...turn, response, error: null } : turn));
    } catch (error) {
      if (!controller.signal.aborted) {
        setTurns((current) => current.map((turn) => turn.id === id ? { ...turn, error: assistantError(error) } : turn));
      }
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        sendingRef.current = false;
        setSendingId(null);
      }
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = draft.trim();
    if (!question || question.length > 2000 || sendingRef.current) return;
    const id = nextId.current++;
    setTurns((current) => [...current, { id, question, response: null, error: null }]);
    setDraft('');
    void submitQuestion(question, id);
  }

  return (
    <>
      <BreadcrumbComp title="AI Accounting Assistant" items={[{ title: 'Dashboard', to: '/' }, { title: 'AI Accounting Assistant' }]} />
      {!organization ? (
        <Alert variant="lighterror"><AlertTitle>No organization available</AlertTitle>
          <AlertDescription>Sign in with an organization account to use the assistant.</AlertDescription>
        </Alert>
      ) : (
        <CardBox className="min-w-0 overflow-hidden">
          <div className="space-y-3 p-5">
            <div>
              <h2 className="text-lg font-semibold">AI Accounting Assistant</h2>
              <p className="mt-1 text-sm text-muted-foreground">Ask about recorded revenue, expenses, profit, invoices, vendors, or financial reports for {organization.name}.</p>
            </div>
            <Alert variant="lightwarning">
              <AlertTitle>Informational, read-only answers</AlertTitle>
              <AlertDescription>
                The assistant can only answer supported financial questions and cannot change accounting records.
                Answers may use deterministic fallback text if an AI provider is unavailable. The API does not identify
                which generated an answer, so treat every response as unverified and check the cited report sources.
              </AlertDescription>
            </Alert>
            <p className="text-xs text-muted-foreground">Each question is sent on its own. Earlier messages are shown here but are not included as server conversation history.</p>
          </div>

          <div aria-live="polite" aria-label="Assistant conversation" className="max-h-[60vh] min-h-48 space-y-4 overflow-y-auto border-t border-border p-4 dark:border-white/10">
            {turns.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">Ask a question to get started. For example: “What was our revenue last month?”</p>
            )}
            {turns.map((turn) => (
              <article key={turn.id} className="space-y-3">
                <div className="ml-auto max-w-[90%] rounded-lg bg-lightprimary p-3 text-sm text-ld sm:max-w-[80%]">
                  <p className="mb-1 text-xs font-semibold text-primary">You</p>
                  <p className="whitespace-pre-wrap break-words">{turn.question}</p>
                </div>
                {turns.length > 0 && sendingId === turn.id && !turn.response && !turn.error && (
                  <p role="status" className="text-sm text-muted-foreground">Getting an answer from the assistant...</p>
                )}
                {turn.response && (
                  <div className="max-w-[95%] space-y-2 rounded-lg border border-border p-4 text-sm dark:border-white/10">
                    <p className="text-xs font-semibold text-muted-foreground">Assistant · unverified</p>
                    <p className="whitespace-pre-wrap break-words">{turn.response.answer}</p>
                    {turn.response.period && <p className="text-xs text-muted-foreground">Period: {turn.response.period.fromDate} to {turn.response.period.toDate}</p>}
                    {turn.response.sources.length > 0 && <p className="text-xs text-muted-foreground">Sources: {turn.response.sources.join(', ')}</p>}
                    <p className="text-xs text-muted-foreground">{turn.response.dataUsed ? 'Based on recorded data.' : 'No financial data was used.'}</p>
                  </div>
                )}
                {turn.error && (
                  <Alert variant="lighterror">
                    <AlertTitle>Unable to get an answer</AlertTitle>
                    <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                      <span>{turn.error}</span>
                      <Button type="button" variant="outlineerror" size="sm" disabled={sendingId !== null} onClick={() => void submitQuestion(turn.question, turn.id)}>Retry</Button>
                    </AlertDescription>
                  </Alert>
                )}
              </article>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3 border-t border-border p-4 dark:border-white/10">
            <label htmlFor="assistant-question" className="text-sm font-medium">Your question</label>
            <Textarea id="assistant-question" value={draft} maxLength={2000} rows={3}
              placeholder="Ask about your recorded financial data..." disabled={sendingId !== null}
              onChange={(event) => setDraft(event.target.value)} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">{draft.length}/2000 characters</span>
              <Button type="submit" disabled={sendingId !== null || !draft.trim()}>
                {sendingId !== null ? 'Sending...' : 'Ask assistant'}
              </Button>
            </div>
          </form>
        </CardBox>
      )}
    </>
  );
}
