// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFetchMock, jsonResponse, testOrganization, testUser } from 'src/test/api-fixtures';
import type { DocumentExtraction, DocumentRecord, OcrResult } from './types';
import { useDocumentProcessing } from './useDocumentProcessing';

const documentId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

function makeDocument(status: DocumentRecord['status']): DocumentRecord {
  return {
    id: documentId,
    organizationId: testOrganization.id,
    invoiceId: null,
    expenseId: null,
    originalFileName: 'receipt.pdf',
    contentType: 'application/pdf',
    fileSize: 2048,
    documentType: 'RECEIPT',
    status,
    checksum: 'a'.repeat(64),
    uploadedBy: testUser.id,
    createdAt: '2026-10-20T12:00:00Z',
    updatedAt: '2026-10-20T12:00:00Z',
  };
}

function makeOcr(status: OcrResult['status']): OcrResult {
  return {
    id: 'ocr-1',
    documentId,
    status,
    extractedText: status === 'COMPLETED' ? 'Receipt text' : null,
    pageCount: status === 'COMPLETED' ? 1 : null,
    processingStartedAt: null,
    processingCompletedAt: null,
    errorMessage: null,
    createdAt: '2026-10-20T12:00:00Z',
    updatedAt: '2026-10-20T12:00:00Z',
  };
}

const extraction: DocumentExtraction = {
  id: 'extraction-1',
  documentId,
  extractionType: 'RECEIPT',
  status: 'COMPLETED',
  model: 'fake-model',
  promptVersion: 'v1',
  structuredData: { documentType: 'RECEIPT', totalAmount: 120 },
  confidence: 0.9,
  processingStartedAt: null,
  processingCompletedAt: null,
  errorMessage: null,
  createdAt: '2026-10-20T12:00:00Z',
  updatedAt: '2026-10-20T12:00:00Z',
};

function setupPollingRoutes() {
  let documentCalls = 0;
  let ocrCalls = 0;

  const fetchMock = createFetchMock([
    {
      path: `/api/v1/documents/${documentId}`,
      handler: () => {
        documentCalls += 1;
        return jsonResponse(makeDocument(documentCalls === 1 ? 'PROCESSING' : 'PROCESSED'));
      },
    },
    {
      path: `/api/v1/documents/${documentId}/ocr`,
      handler: () => {
        ocrCalls += 1;
        return jsonResponse(makeOcr(ocrCalls === 1 ? 'PROCESSING' : 'COMPLETED'));
      },
    },
    {
      path: `/api/v1/documents/${documentId}/extraction`,
      handler: () => jsonResponse(extraction),
    },
    {
      path: `/api/v1/documents/${documentId}/review`,
      handler: () => jsonResponse({ message: 'Not found' }, 404),
    },
  ]);

  vi.stubGlobal('fetch', fetchMock);

  return {
    fetchMock,
    getOcrCalls: () => ocrCalls,
  };
}

async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(0);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useDocumentProcessing', () => {
  it('polls until OCR and extraction reach a terminal state, then stops', async () => {
    const { fetchMock, getOcrCalls } = setupPollingRoutes();
    const { result } = renderHook(() =>
      useDocumentProcessing({ documentId, open: true }),
    );

    await flush();
    expect(result.current.document?.status).toBe('PROCESSING');
    expect(result.current.ocr?.status).toBe('PROCESSING');
    expect(getOcrCalls()).toBe(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    await flush();

    expect(result.current.document?.status).toBe('PROCESSED');
    expect(result.current.ocr?.status).toBe('COMPLETED');
    expect(result.current.extraction?.status).toBe('COMPLETED');
    expect(getOcrCalls()).toBe(2);

    const totalCalls = fetchMock.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });
    await flush();

    expect(fetchMock.mock.calls.length).toBe(totalCalls);
  });

  it('stops polling when the viewer closes or unmounts', async () => {
    const { getOcrCalls } = setupPollingRoutes();
    const { result, unmount } = renderHook(() =>
      useDocumentProcessing({ documentId, open: true }),
    );

    await flush();
    expect(result.current.ocr?.status).toBe('PROCESSING');
    expect(getOcrCalls()).toBe(1);

    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });

    expect(getOcrCalls()).toBe(1);
  });

  it('bounds polling and exposes a manual status refresh when the backend stays pending', async () => {
    let documentCalls = 0;
    let ocrCalls = 0;
    const fetchMock = createFetchMock([
      { path: `/api/v1/documents/${documentId}`, handler: () => { documentCalls++; return jsonResponse(makeDocument('PROCESSING')); } },
      { path: `/api/v1/documents/${documentId}/ocr`, handler: () => { ocrCalls++; return jsonResponse(makeOcr('PENDING')); } },
    ]);
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useDocumentProcessing({ documentId, open: true }));
    await flush();
    expect(result.current.pollingPaused).toBe(false);

    await act(async () => { await vi.advanceTimersByTimeAsync(200_000); });
    await flush();
    expect(result.current.pollingPaused).toBe(true);
    expect(ocrCalls).toBe(25);
    const calls = fetchMock.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(fetchMock).toHaveBeenCalledTimes(calls);
    expect(documentCalls).toBe(25);
  });
});
