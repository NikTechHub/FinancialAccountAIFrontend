import { describe, expect, it } from 'vitest';
import { ASSISTANT_ROUTE_ALLOWLIST, resolveLocalIntent } from './localIntent';

describe('assistant local intents', () => {
  it.each(['hello', 'hi', 'hey there'])('greets %s without an external provider', (message) => {
    expect(resolveLocalIntent(message)?.type).toBe('greeting');
  });

  it.each(['नमस्ते', 'namaste'])('greets Hindi input %s in Hindi', (message) => {
    expect(resolveLocalIntent(message)).toMatchObject({ type: 'greeting', answer: expect.stringContaining('नमस्ते') });
  });

  it.each([
    ['open invoices', 'invoices'],
    ['show my expenses', 'expenses'],
    ['take me to dashboard', 'dashboard'],
    ['expense page kholo', 'expenses'],
    ['journal entries kholo', 'journals'],
    ['मुझे जर्नल एंट्री पेज पर ले चलो', 'journals'],
    ['go to balance sheet', 'balanceSheet'],
  ])('resolves %s to an allowlisted application route', (message, routeKey) => {
    expect(resolveLocalIntent(message)).toEqual({ type: 'navigate', routeKey });
    expect(ASSISTANT_ROUTE_ALLOWLIST[routeKey as keyof typeof ASSISTANT_ROUTE_ALLOWLIST].path).toMatch(/^\//);
  });

  it('asks when multiple pages match and refuses unknown targets without redirecting', () => {
    expect(resolveLocalIntent('open invoices and expenses')?.type).toBe('ambiguous-navigation');
    expect(resolveLocalIntent('open payroll')).toEqual({ type: 'navigation-not-found' });
    expect(resolveLocalIntent('What is artificial intelligence?')).toBeNull();
    expect(resolveLocalIntent('Show my balance')).toBeNull();
  });

  it('only allowlists routes declared in the protected router', () => {
    expect(Object.values(ASSISTANT_ROUTE_ALLOWLIST).map(({ path }) => path)).toEqual([
      '/', '/vendors', '/customers', '/expenses', '/invoices', '/documents', '/accounts',
      '/journal-entries', '/reports/general-ledger', '/reports/trial-balance',
      '/reports/profit-and-loss', '/reports/balance-sheet', '/ai-assistant',
      '/organization-settings', '/audit-logs',
    ]);
  });
});
