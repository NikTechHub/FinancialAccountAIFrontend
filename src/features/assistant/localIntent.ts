export const ASSISTANT_ROUTE_ALLOWLIST = {
  dashboard: { label: 'Dashboard', path: '/' },
  vendors: { label: 'Vendors', path: '/vendors' },
  customers: { label: 'Customers', path: '/customers' },
  expenses: { label: 'Expenses', path: '/expenses' },
  invoices: { label: 'Invoices', path: '/invoices' },
  documents: { label: 'Documents', path: '/documents' },
  accounts: { label: 'Chart of Accounts', path: '/accounts' },
  journals: { label: 'Journal Entries', path: '/journal-entries' },
  generalLedger: { label: 'General Ledger', path: '/reports/general-ledger' },
  trialBalance: { label: 'Trial Balance', path: '/reports/trial-balance' },
  profitAndLoss: { label: 'Profit & Loss', path: '/reports/profit-and-loss' },
  balanceSheet: { label: 'Balance Sheet', path: '/reports/balance-sheet' },
  assistant: { label: 'AI Assistant', path: '/ai-assistant' },
  organizationSettings: { label: 'Organization Settings', path: '/organization-settings' },
  auditLogs: { label: 'Audit Logs', path: '/audit-logs' },
} as const;

export type AssistantRouteKey = keyof typeof ASSISTANT_ROUTE_ALLOWLIST;

export type LocalAssistantIntent =
  | { type: 'greeting'; answer: string }
  | { type: 'help'; answer: string }
  | { type: 'navigate'; routeKey: AssistantRouteKey }
  | { type: 'ambiguous-navigation'; routeKeys: AssistantRouteKey[] }
  | { type: 'navigation-not-found' }
  | null;

const routeKeywords: Record<AssistantRouteKey, string[]> = {
  dashboard: ['dashboard', 'home page', 'डैशबोर्ड', 'मुख्य पेज'],
  vendors: ['vendors', 'vendor page', 'वेंडर'],
  customers: ['customers', 'customer page', 'ग्राहक'],
  expenses: ['expenses', 'expense page', 'spending page', 'खर्च', 'व्यय'],
  invoices: ['invoices', 'invoice page', 'invoice', 'बिल', 'इनवॉइस'],
  documents: ['documents', 'document page', 'document review', 'ocr', 'दस्तावेज'],
  accounts: ['chart of accounts', 'accounts page', 'account page', 'खातों का चार्ट'],
  journals: ['journal entries', 'journal entry', 'journals', 'जर्नल एंट्री', 'जर्नल प्रविष्टि'],
  generalLedger: ['general ledger', 'ledger page', 'ledger', 'जनरल लेजर'],
  trialBalance: ['trial balance', 'ट्रायल बैलेंस'],
  profitAndLoss: ['profit and loss', 'profit & loss', 'p&l', 'income statement', 'लाभ और हानि'],
  balanceSheet: ['balance sheet', 'बैलेंस शीट'],
  assistant: ['ai assistant', 'accounting assistant', 'assistant page'],
  organizationSettings: ['organization settings', 'organization setting', 'org settings', 'संगठन सेटिंग'],
  auditLogs: ['audit logs', 'audit log', 'ऑडिट लॉग'],
};

function isHindi(message: string, preference: 'AUTO' | 'ENGLISH' | 'HINDI'): boolean {
  if (preference === 'HINDI') return true;
  if (preference === 'ENGLISH') return false;
  return /[\u0900-\u097f]/.test(message) || /\b(namaste|namaskar|kya|khol|dikhao|le chalo)\b/i.test(message);
}

export function resolveLocalIntent(message: string, language: 'AUTO' | 'ENGLISH' | 'HINDI' = 'AUTO'): LocalAssistantIntent {
  const normalized = message.trim().toLocaleLowerCase().replace(/[!?.,;:]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized) return null;

  if (/^(hello|hi|hey|नमस्ते|नमस्कार|namaste|namaskar)(\s+(there|how are you|how's it going|आप कैसे हैं|आप कैसे हो))?$/i.test(normalized)) {
    return { type: 'greeting', answer: isHindi(normalized, language) ? 'नमस्ते! मैं Fintrix AI Assistant हूँ। मैं आपकी कैसे मदद कर सकता हूँ?' : 'Hello! I’m the Fintrix AI Assistant. How can I help you today?' };
  }

  if (/^(help|what can you do|how can you help|आप क्या कर सकते|मदद|मदद करो)$/i.test(normalized)) {
    return { type: 'help', answer: isHindi(normalized, language)
      ? 'मैं सामान्य सवालों के जवाब दे सकता हूँ, आपकी अधिकृत accounting reports समझा सकता हूँ, और dashboard, invoices, expenses, journals तथा reports खोल सकता हूँ। मैं रिकॉर्ड बदल या पोस्ट नहीं कर सकता।'
      : 'I can answer general questions, explain authorized accounting reports, and open pages such as Dashboard, Invoices, Expenses, Journal Entries, and reports. I cannot change or post records.' };
  }

  const hasExplicitNavigationVerb = /\b(open|go to|take me to|navigate to|visit|go|open up)\b|खोल|ले चल|ले चलो|पर जाओ|पेज खोल|kholo|le chalo/i.test(normalized);
  const hasShowPageIntent = /\bshow\b|दिखा|dikhao/i.test(normalized) &&
    (/\b(page|screen|view)\b|पेज|स्क्रीन/i.test(normalized) ||
      (Object.values(routeKeywords).flat().some((keyword) => normalized.includes(keyword)) && !/\b(my|our)\s+(balance|finances?|spending|revenue|profit)\b/i.test(normalized)));
  const hasNavigationVerb = hasExplicitNavigationVerb || hasShowPageIntent;
  if (!hasNavigationVerb) return null;

  const matches = (Object.keys(routeKeywords) as AssistantRouteKey[]).filter((routeKey) =>
    routeKeywords[routeKey].some((keyword) => normalized.includes(keyword)),
  );
  if (matches.length > 1) return { type: 'ambiguous-navigation', routeKeys: matches };
  if (matches.length === 1) return { type: 'navigate', routeKey: matches[0] };
  return { type: 'navigation-not-found' };
}
