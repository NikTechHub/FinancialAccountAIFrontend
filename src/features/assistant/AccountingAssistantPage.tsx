import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { ApiError } from 'src/lib/api/client';
import { Alert, AlertDescription, AlertTitle } from 'src/components/ui/alert';
import { Button } from 'src/components/ui/button';
import CardBox from 'src/components/shared/CardBox';
import { Textarea } from 'src/components/ui/textarea';
import { useAuth } from 'src/features/auth/useAuth';
import BreadcrumbComp from 'src/layouts/full/shared/breadcrumb/BreadcrumbComp';
import { assistantApi, type AssistantHistoryMessage, type AssistantLanguage, type AssistantResponse } from './api';
import { ASSISTANT_ROUTE_ALLOWLIST, resolveLocalIntent } from './localIntent';

interface Turn { id: number; question: string; response: AssistantResponse | null; error: string | null; }
interface RecognitionResult { transcript: string; }
interface RecognitionEvent { resultIndex: number; results: ArrayLike<ArrayLike<RecognitionResult>>; }
interface RecognitionErrorEvent { error: string; }
interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
interface RecognitionConstructor { new(): RecognitionLike; }
type SpeechWindow = Window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor; };

function assistantError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.kind === 'network') return 'Unable to reach the server. Check your connection and try again.';
    if (error.kind === 'parse') return 'The assistant returned an unexpected response. Please try again.';
    if (error.status === 401) return 'Your session has expired. Please sign in again.';
    if (error.status === 403) return 'You do not have permission to use the assistant.';
    if (error.status === 404) return 'No organization membership is available for that accounting question. General questions can still be asked.';
    if (error.status === 429) return /provider quota/i.test(error.message)
      ? 'The LLM provider quota is exhausted. Check its billing and usage limits, then retry.'
      : 'The assistant request limit was reached. Wait a minute and retry.';
    if (error.status === 502 || error.status === 503) return 'The AI provider is unavailable or not configured. Check the backend AI provider key and model configuration.';
    if (error.status === 504) return 'The AI provider request timed out. Your question is still here; retry in a moment.';
    if (error.status !== null && error.status >= 500) return 'The assistant backend failed to process this request. Your question is still here; retry or check backend logs.';
    if (error.status === 400) return 'The question or conversation context was not accepted. Start a shorter conversation and retry.';
  }
  return 'The assistant could not answer that request. Please try again.';
}

function conversationHistory(turns: Turn[], beforeId: number): AssistantHistoryMessage[] {
  const messages = turns.filter((turn) => turn.id < beforeId && turn.response)
    .flatMap((turn) => [
      { role: 'user' as const, content: turn.question },
      { role: 'assistant' as const, content: turn.response!.answer },
    ]);
  let size = 0;
  const recent: AssistantHistoryMessage[] = [];
  for (const message of messages.reverse()) {
    if (recent.length >= 8 || size + message.content.length > 12_000) break;
    recent.unshift(message);
    size += message.content.length;
  }
  return recent;
}

function speechTextLanguage(text: string, preference: AssistantLanguage): 'hi-IN' | 'en-US' {
  if (preference === 'HINDI') return 'hi-IN';
  if (preference === 'ENGLISH') return 'en-US';
  if (/[\u0900-\u097f]/.test(text) || /\b(mera|meri|kitna|kitne|hai|hua|kharcha|mahine|samjhao)\b/i.test(text)) return 'hi-IN';
  return 'en-US';
}

export function AccountingAssistantPage() {
  const { organization } = useAuth();
  const navigate = useNavigate();
  const [draft, setDraft] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [language, setLanguage] = useState<AssistantLanguage>('AUTO');
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [voiceState, setVoiceState] = useState<'idle' | 'listening' | 'transcribing' | 'stopped' | 'error'>('idle');
  const [voiceMessage, setVoiceMessage] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<number | null>(null);
  const nextId = useRef(0);
  const sendingRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const navigationTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    controllerRef.current?.abort();
    recognitionRef.current?.abort();
    if (navigationTimerRef.current !== null) window.clearTimeout(navigationTimerRef.current);
    if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
  }, []);

  async function submitQuestion(question: string, id: number, history: AssistantHistoryMessage[]) {
    if (sendingRef.current) return;
    sendingRef.current = true;
    const controller = new AbortController();
    controllerRef.current = controller;
    setSendingId(id);
    setTurns((current) => current.map((turn) => turn.id === id ? { ...turn, error: null } : turn));
    try {
      const response = await assistantApi.chat(question, history, language, controller.signal);
      if (controller.signal.aborted) return;
      if (typeof response.answer !== 'string' || typeof response.dataUsed !== 'boolean' ||
          !Array.isArray(response.sources) || !response.sources.every((source) => typeof source === 'string') ||
          (response.period !== null && (!response.period || typeof response.period.fromDate !== 'string' || typeof response.period.toDate !== 'string'))) {
        throw new ApiError('Invalid assistant response', { kind: 'parse' });
      }
      setTurns((current) => current.map((turn) => turn.id === id ? { ...turn, response, error: null } : turn));
      setDraft((current) => current === question ? '' : current);
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
    const history = conversationHistory(turns, id);
    setTurns((current) => [...current, { id, question, response: null, error: null }]);
    const localIntent = resolveLocalIntent(question, language);
    if (localIntent) {
      const preferHindi = language === 'HINDI' || (language === 'AUTO' && /[\u0900-\u097f]|\b(namaste|namaskar|khol|dikhao|le chalo)\b/i.test(question));
      let answer: string;
      if (localIntent.type === 'greeting' || localIntent.type === 'help') answer = localIntent.answer;
      else if (localIntent.type === 'navigation-not-found') answer = preferHindi
        ? 'यह पेज उपलब्ध navigation routes में नहीं मिला। Dashboard, Invoices, Expenses या Journal Entries जैसे पेज का नाम बताइए।'
        : 'I could not find that page in the approved application routes. Try a page name such as Dashboard, Invoices, Expenses, or Journal Entries.';
      else if (localIntent.type === 'ambiguous-navigation') {
        const options = localIntent.routeKeys.map((key) => ASSISTANT_ROUTE_ALLOWLIST[key].label).join(' or ');
        answer = preferHindi ? `मुझे एक से अधिक पेज मिले: ${options}। आप कौन-सा पेज खोलना चाहते हैं?`
          : `I found more than one page: ${options}. Which one should I open?`;
      } else {
        const route = ASSISTANT_ROUTE_ALLOWLIST[localIntent.routeKey];
        answer = preferHindi ? `${route.label} खोल रहा हूँ…` : `Opening ${route.label}…`;
        navigationTimerRef.current = window.setTimeout(() => {
          navigate(route.path);
          navigationTimerRef.current = null;
        }, 450);
      }
      setTurns((current) => current.map((turn) => turn.id === id ? {
        ...turn,
        response: { answer, dataUsed: false, period: null, sources: [], responseMode: 'LOCAL_RULE' },
      } : turn));
      setDraft('');
      return;
    }
    void submitQuestion(question, id, history);
  }

  function retry(turn: Turn) {
    void submitQuestion(turn.question, turn.id, conversationHistory(turns, turn.id));
  }

  function toggleMicrophone() {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setVoiceState('stopped');
      return;
    }
    const speechWindow = window as SpeechWindow;
    const Constructor = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Constructor) {
      setVoiceState('error');
      setVoiceMessage('Speech recognition is not supported by this browser. Type your question instead.');
      return;
    }
    const recognition = new Constructor();
    recognition.lang = language === 'HINDI' ? 'hi-IN' : language === 'ENGLISH' ? 'en-US' : (navigator.language.toLowerCase().startsWith('hi') ? 'hi-IN' : 'en-US');
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).slice(event.resultIndex).map((item) => item[0]?.transcript ?? '').join(' ').trim();
      if (transcript) setDraft((current) => current ? `${current} ${transcript}` : transcript);
      setVoiceState('transcribing');
      setVoiceMessage(transcript ? 'Transcription ready. Review or edit it before sending.' : 'No speech was recognized. Try again or type your question.');
      recognitionRef.current = null;
      window.setTimeout(() => setVoiceState('stopped'), 0);
    };
    recognition.onerror = (event) => {
      setVoiceState('error');
      setVoiceMessage(event.error === 'not-allowed' || event.error === 'service-not-allowed'
        ? 'Microphone permission was denied. Allow microphone access in your browser or type your question.'
        : 'Speech recognition failed. Try again or type your question.');
      recognitionRef.current = null;
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setVoiceState((current) => current === 'listening' ? 'stopped' : current);
    };
    try {
      recognitionRef.current = recognition;
      setVoiceMessage('');
      setVoiceState('listening');
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setVoiceState('error');
      setVoiceMessage('The microphone could not be started. Check browser permission and try again.');
    }
  }

  function speak(answer: string, turnId: number) {
    if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') {
      setVoiceState('error');
      setVoiceMessage('Speech playback is not supported by this browser.');
      return;
    }
    if (speakingId === turnId) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const lang = speechTextLanguage(answer, language);
    const chunks = answer.match(/[\s\S]{1,1800}(?:\s|$)/g) ?? [answer];
    setSpeakingId(turnId);
    chunks.forEach((chunk, index) => {
      const utterance = new SpeechSynthesisUtterance(chunk);
      utterance.lang = lang;
      if (index === chunks.length - 1) {
        utterance.onend = () => setSpeakingId(null);
        utterance.onerror = () => { setSpeakingId(null); setVoiceMessage('The selected browser voice could not read this response.'); };
      }
      window.speechSynthesis.speak(utterance);
    });
  }

  function stopResponse() {
    controllerRef.current?.abort();
    setTurns((current) => current.map((turn) => turn.id === sendingId
      ? { ...turn, error: 'Request stopped. Retry when you are ready.' } : turn));
    sendingRef.current = false;
    controllerRef.current = null;
    setSendingId(null);
  }

  return (
    <>
      <BreadcrumbComp title="AI Accounting Assistant" items={[{ title: 'Dashboard', to: '/' }, { title: 'AI Accounting Assistant' }]} />
        <CardBox className="min-w-0 overflow-hidden">
          <div className="space-y-3 p-5">
            <div>
              <h2 className="text-lg font-semibold">Fintrix AI Assistant</h2>
              <p className="mt-1 text-sm text-muted-foreground">Ask in English, Hindi, or Hinglish. You can ask general questions or read-only questions about recorded finances{organization ? ` for ${organization.name}` : ''}.</p>
            </div>
            <Alert variant="lightwarning">
              <AlertTitle>Read-only and provider-aware</AlertTitle>
              <AlertDescription>
                Accounting facts are fetched from authorized reports. General answers require the server AI provider; if it is unavailable, the assistant reports an error. It has no live internet access or accounting write actions.
              </AlertDescription>
            </Alert>
          </div>

          <div aria-live="polite" aria-label="Assistant conversation" className="max-h-[60vh] min-h-48 space-y-4 overflow-y-auto border-t border-border p-4 dark:border-white/10">
            {turns.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Try “What was our revenue this month?”, “इस महीने का कुल खर्च कितना है?”, or “Mera profit kitna hua is month?”</p>}
            {turns.map((turn) => (
              <article key={turn.id} className="space-y-3">
                <div className="ml-auto max-w-[90%] rounded-lg bg-lightprimary p-3 text-sm text-ld sm:max-w-[80%]">
                  <p className="mb-1 text-xs font-semibold text-primary">You</p>
                  <p className="whitespace-pre-wrap break-words">{turn.question}</p>
                </div>
                {sendingId === turn.id && !turn.response && !turn.error && <p role="status" className="text-sm text-muted-foreground">Thinking…</p>}
                {turn.response && (
                  <div className="max-w-[95%] space-y-2 rounded-lg border border-border p-4 text-sm dark:border-white/10">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-muted-foreground">Assistant · {turn.response.responseMode === 'AI' ? 'AI response' : turn.response.responseMode === 'LOCAL_RULE' ? 'App assistant' : 'Limited deterministic fallback'}</p>
                      <Button type="button" variant="outline" size="sm" onClick={() => speak(turn.response!.answer, turn.id)}>
                        {speakingId === turn.id ? 'Stop speaking' : 'Speak response'}
                      </Button>
                    </div>
                    <p className="whitespace-pre-wrap break-words">{turn.response.answer}</p>
                    {turn.response.period && <p className="text-xs text-muted-foreground">Period: {turn.response.period.fromDate} to {turn.response.period.toDate}</p>}
                    {turn.response.sources.length > 0 && <p className="text-xs text-muted-foreground">Sources: {turn.response.sources.join(', ')}</p>}
                    <p className="text-xs text-muted-foreground">{turn.response.dataUsed ? 'Accounting data used; numeric facts are grounded in server reports.' : 'General answer; no accounting data was used.'}</p>
                  </div>
                )}
                {turn.error && <Alert variant="lighterror"><AlertTitle>Unable to get an answer</AlertTitle>
                  <AlertDescription className="flex flex-wrap items-center justify-between gap-3"><span>{turn.error}</span>
                    <Button type="button" variant="outlineerror" size="sm" disabled={sendingId !== null} onClick={() => retry(turn)}>Retry</Button>
                  </AlertDescription>
                </Alert>}
              </article>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3 border-t border-border p-4 dark:border-white/10">
            <label htmlFor="assistant-question" className="text-sm font-medium">Your question</label>
            <Textarea id="assistant-question" value={draft} maxLength={2000} rows={3}
              placeholder="Ask a general or accounting question…" disabled={sendingId !== null}
              onChange={(event) => setDraft(event.target.value)} />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="assistant-language" className="text-xs text-muted-foreground">Reply language</label>
                <select id="assistant-language" value={language} onChange={(event) => setLanguage(event.target.value as AssistantLanguage)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
                  <option value="AUTO">Auto</option><option value="ENGLISH">English</option><option value="HINDI">हिंदी</option>
                </select>
                <Button type="button" variant="outline" size="sm" onClick={toggleMicrophone} disabled={sendingId !== null}>
                  {voiceState === 'listening' ? 'Stop microphone' : 'Use microphone'}
                </Button>
                {sendingId !== null && <Button type="button" variant="outline" size="sm" onClick={stopResponse}>Stop response</Button>}
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <span className="text-xs text-muted-foreground">{draft.length}/2000</span>
                <Button type="submit" disabled={sendingId !== null || !draft.trim()}>{sendingId !== null ? 'Sending…' : 'Send'}</Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Microphone use starts only after you click. Browser speech recognition availability varies; transcription stays editable before sending. Voice playback uses installed browser voices and starts only when requested.</p>
            {voiceState === 'listening' && <p role="status" className="text-sm text-primary">Listening… speak your question, then pause.</p>}
            {voiceState === 'transcribing' && <p role="status" className="text-sm text-primary">Transcribing speech…</p>}
            {voiceMessage && <p role="status" className={`text-sm ${voiceState === 'error' ? 'text-error' : 'text-muted-foreground'}`}>{voiceMessage}</p>}
          </form>
        </CardBox>
    </>
  );
}
