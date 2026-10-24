// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from 'src/features/auth/auth-context';
import { clearSession } from 'src/lib/api/session';
import type { MembershipRole } from 'src/lib/api/types';
import { createFetchMock, jsonResponse, testOrganization, testUser } from 'src/test/api-fixtures';
import { DocumentManagementPage } from './DocumentManagementPage';
import type {
  DocumentExtraction,
  DocumentRecord,
  DocumentReview,
  OcrResult,
  StructuredExtractionData,
} from './types';

const documentId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const expenseId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const reviewer = {
  id: testUser.id,
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: testUser.email,
};

const structuredData: StructuredExtractionData = {
  documentType: 'RECEIPT',
  invoiceNumber: 'INV-42',
  invoiceDate: '2026-10-01',
  dueDate: '2026-10-31',
  currency: 'USD',
  vendorName: 'Acme Digital',
  vendorTaxIdentifier: 'TAX-42',
  vendorEmail: 'billing@acme.test',
  vendorPhone: '555-0100',
  customerName: 'Analytical Engines',
  customerTaxIdentifier: 'TAX-CUST',
  subtotal: 100,
  taxAmount: 20,
  discountAmount: 0,
  totalAmount: 120,
  paymentTerms: 'Net 30',
  notes: 'Original AI note',
  lineItems: [
    {
      description: 'Software subscription',
      quantity: 1,
      unitPrice: 100,
      taxRate: 20,
      taxAmount: 20,
      discountAmount: 0,
      lineTotal: 120,
    },
  ],
};

function makeDocument(overrides: Partial<DocumentRecord> = {}): DocumentRecord {
  return {
    id: documentId,
    organizationId: testOrganization.id,
    invoiceId: null,
    expenseId: null,
    originalFileName: 'receipt.pdf',
    contentType: 'application/pdf',
    fileSize: 2048,
    documentType: 'RECEIPT',
    status: 'UPLOADED',
    checksum: 'a'.repeat(64),
    uploadedBy: testUser.id,
    createdAt: '2026-10-20T12:00:00Z',
    updatedAt: '2026-10-20T12:00:00Z',
    ...overrides,
  };
}

function makeOcr(overrides: Partial<OcrResult> = {}): OcrResult {
  return {
    id: 'ocr-1',
    documentId,
    status: 'COMPLETED',
    extractedText: 'Acme Digital receipt total 120.00 USD',
    pageCount: 1,
    processingStartedAt: '2026-10-20T12:01:00Z',
    processingCompletedAt: '2026-10-20T12:01:10Z',
    errorMessage: null,
    createdAt: '2026-10-20T12:00:30Z',
    updatedAt: '2026-10-20T12:01:10Z',
    ...overrides,
  };
}

function makeExtraction(
  overrides: Partial<DocumentExtraction> = {},
): DocumentExtraction {
  return {
    id: 'extraction-1',
    documentId,
    extractionType: 'RECEIPT',
    status: 'COMPLETED',
    model: 'fake-model',
    promptVersion: 'v1',
    structuredData,
    confidence: 0.94,
    processingStartedAt: '2026-10-20T12:02:00Z',
    processingCompletedAt: '2026-10-20T12:02:10Z',
    errorMessage: null,
    createdAt: '2026-10-20T12:01:30Z',
    updatedAt: '2026-10-20T12:02:10Z',
    ...overrides,
  };
}

function makeReview(overrides: Partial<DocumentReview> = {}): DocumentReview {
  return {
    id: 'review-1',
    documentId,
    extractionId: 'extraction-1',
    status: 'PENDING',
    originalAiData: structuredData,
    reviewedData: structuredData,
    reviewedBy: null,
    reviewedAt: null,
    reviewComment: null,
    createdAt: '2026-10-20T12:03:00Z',
    updatedAt: '2026-10-20T12:03:00Z',
    ...overrides,
  };
}

function makePage<T>(content: T[]) {
  return {
    content,
    totalElements: content.length,
    totalPages: content.length ? 1 : 0,
    number: 0,
    size: 10,
    first: true,
    last: true,
    numberOfElements: content.length,
    empty: content.length === 0,
  };
}

function createAuthValue(role: MembershipRole | null): AuthContextValue {
  return {
    status: 'authenticated',
    user: testUser,
    organization: testOrganization,
    role,
    membershipError: null,
    login: vi.fn(async () => undefined),
    register: vi.fn(async () => undefined),
    logout: vi.fn(),
  };
}

function renderPage(role: MembershipRole | null = 'OWNER') {
  render(
    <MemoryRouter initialEntries={['/documents']}>
      <AuthContext.Provider value={createAuthValue(role)}>
        <DocumentManagementPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

function setupDocumentRoutes(options: {
  document?: DocumentRecord;
  ocr?: OcrResult | null;
  extraction?: DocumentExtraction | null;
  review?: DocumentReview | null;
  getFailure?: number;
  detailFailure?: number;
  uploadFailure?: number;
  uploadDelayMs?: number;
  ocrPostDelayMs?: number;
  keepOcrMissingAfterPost?: boolean;
} = {}) {
  let records = [options.document ?? makeDocument()];
  let ocr = options.ocr ?? null;
  let extraction = options.extraction ?? null;
  let review = options.review ?? null;
  let getFailure = options.getFailure ?? null;
  let timestamp = 0;

  const nextTimestamp = () =>
    new Date(Date.UTC(2026, 9, 20, 13, 0, timestamp++)).toISOString();

  const fetchMock = createFetchMock([
    {
      path: '/api/v1/documents',
      handler: () => {
        if (getFailure) return jsonResponse({ message: 'Failed' }, getFailure);
        return jsonResponse(makePage(records));
      },
    },
    {
      method: 'POST',
      path: '/api/v1/documents',
      handler: async ({ body }) => {
        if (options.uploadDelayMs) {
          await new Promise((resolve) => setTimeout(resolve, options.uploadDelayMs));
        }
        if (options.uploadFailure) {
          return jsonResponse(
            { message: 'Upload failed' },
            options.uploadFailure,
          );
        }
        const form = body as FormData;
        const file = form.get('file') as File;
        const documentType = String(form.get('documentType')) as DocumentRecord['documentType'];
        const uploaded = makeDocument({
          originalFileName: file.name,
          contentType: file.type,
          fileSize: file.size,
          documentType,
          status: 'UPLOADED',
          createdAt: nextTimestamp(),
          updatedAt: nextTimestamp(),
        });
        records = [uploaded];
        ocr = null;
        extraction = null;
        review = null;
        return jsonResponse(uploaded, 201);
      },
    },
    {
      path: `/api/v1/documents/${documentId}`,
      handler: () => {
        if (options.detailFailure) {
          return jsonResponse({ message: 'Failed' }, options.detailFailure);
        }
        const record = records.find((item) => item.id === documentId);
        if (!record) return jsonResponse({ message: 'Not found' }, 404);
        return jsonResponse(record);
      },
    },
    {
      path: `/api/v1/documents/${documentId}/download`,
      handler: () =>
        new Response(new Blob(['pdf-bytes'], { type: 'application/pdf' }), {
          status: 200,
          headers: { 'Content-Type': 'application/pdf' },
        }),
    },
    {
      path: `/api/v1/documents/${documentId}/ocr`,
      handler: () => {
        if (!ocr) return jsonResponse({ message: 'OCR not found' }, 404);
        return jsonResponse(ocr);
      },
    },
    {
      method: 'POST',
      path: `/api/v1/documents/${documentId}/ocr`,
      handler: async () => {
        if (options.ocrPostDelayMs) {
          await new Promise((resolve) => setTimeout(resolve, options.ocrPostDelayMs));
        }
        if (!options.keepOcrMissingAfterPost) {
          ocr = makeOcr({
            status: 'PENDING',
            extractedText: null,
            pageCount: null,
            processingStartedAt: null,
            processingCompletedAt: null,
          });
        }
        return jsonResponse(
          {
            documentId,
            operationId: 'operation-ocr',
            status: 'ACCEPTED',
            message: 'OCR processing queued',
          },
          202,
        );
      },
    },
    {
      path: `/api/v1/documents/${documentId}/extraction`,
      handler: () => {
        if (!extraction) return jsonResponse({ message: 'Extraction not found' }, 404);
        return jsonResponse(extraction);
      },
    },
    {
      method: 'POST',
      path: `/api/v1/documents/${documentId}/extraction`,
      handler: () => {
        extraction = makeExtraction({
          status: 'PENDING',
          structuredData: null,
          confidence: null,
        });
        return jsonResponse(
          {
            documentId,
            operationId: 'operation-extraction',
            status: 'ACCEPTED',
            message: 'Extraction queued',
          },
          202,
        );
      },
    },
    {
      path: `/api/v1/documents/${documentId}/review`,
      handler: () => {
        if (!review) return jsonResponse({ message: 'Review not found' }, 404);
        return jsonResponse(review);
      },
    },
    {
      method: 'POST',
      path: `/api/v1/documents/${documentId}/review`,
      handler: () => {
        if (!review) {
          review = makeReview({
            originalAiData: extraction?.structuredData ?? structuredData,
            reviewedData: extraction?.structuredData ?? structuredData,
            updatedAt: nextTimestamp(),
          });
        }
        return jsonResponse(review);
      },
    },
    {
      method: 'PUT',
      path: `/api/v1/documents/${documentId}/review`,
      handler: ({ body }) => {
        const reviewedData = (body as { reviewedData: StructuredExtractionData })
          .reviewedData;
        review = {
          ...(review ?? makeReview()),
          reviewedData,
          updatedAt: nextTimestamp(),
        };
        return jsonResponse(review);
      },
    },
    {
      method: 'POST',
      path: `/api/v1/documents/${documentId}/review/approve`,
      handler: () => {
        review = {
          ...(review ?? makeReview()),
          status: 'APPROVED',
          reviewedBy: reviewer,
          reviewedAt: nextTimestamp(),
          updatedAt: nextTimestamp(),
        };
        return jsonResponse(review);
      },
    },
    {
      method: 'POST',
      path: `/api/v1/documents/${documentId}/review/reject`,
      handler: ({ body }) => {
        const reviewComment = (body as { reviewComment: string | null }).reviewComment;
        review = {
          ...(review ?? makeReview()),
          status: 'REJECTED',
          reviewComment,
          reviewedBy: reviewer,
          reviewedAt: nextTimestamp(),
          updatedAt: nextTimestamp(),
        };
        return jsonResponse(review);
      },
    },
    {
      method: 'POST',
      path: `/api/v1/documents/${documentId}/review/reopen`,
      handler: () => {
        review = {
          ...(review ?? makeReview()),
          status: 'PENDING',
          reviewedBy: null,
          reviewedAt: null,
          updatedAt: nextTimestamp(),
        };
        return jsonResponse(review);
      },
    },
    {
      method: 'DELETE',
      path: `/api/v1/documents/${documentId}`,
      handler: () => {
        records = [];
        return new Response(null, { status: 204 });
      },
    },
    {
      path: '/api/v1/expenses',
      handler: () =>
        jsonResponse(makePage([{ id: expenseId, description: 'Existing expense' }])),
    },
  ]);

  vi.stubGlobal('fetch', fetchMock);

  return {
    fetchMock,
    setGetFailure: (status: number | null) => {
      getFailure = status;
    },
  };
}

async function chooseOption(trigger: HTMLElement, optionName: RegExp | string) {
  fireEvent.pointerDown(trigger, {
    button: 0,
    ctrlKey: false,
    pointerType: 'mouse',
  });
  const option = await screen.findByRole('option', { name: optionName });
  fireEvent.click(option);
}

async function openDocument() {
  const openButton = await screen.findByRole('button', { name: 'Open receipt.pdf' });
  fireEvent.click(openButton);
  expect(await screen.findByText('Document details')).toBeTruthy();
}

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', {
    configurable: true,
    value: () => false,
  });
  Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
    configurable: true,
    value: () => undefined,
  });
  Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', {
    configurable: true,
    value: () => undefined,
  });
  Element.prototype.scrollIntoView = vi.fn();
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:mock-download'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: vi.fn(),
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  clearSession();
});

afterEach(() => {
  cleanup();
  clearSession();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('DocumentManagementPage', () => {
  it('loads documents and searches by file name', async () => {
    const { fetchMock } = setupDocumentRoutes({
      document: makeDocument({ expenseId }),
    });
    renderPage();

    expect(await screen.findByText('receipt.pdf')).toBeTruthy();
    expect(screen.getByText('Receipt')).toBeTruthy();
    expect(screen.getAllByText('Uploaded').length).toBeGreaterThan(0);
    expect(screen.getByText(/Expense bbbbbbbb/)).toBeTruthy();

    const searchInput = screen.getByLabelText('Search documents by file name');
    fireEvent.change(searchInput, { target: { value: 'receipt' } });
    fireEvent.submit(searchInput.closest('form')!);

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input).includes('originalFileName=receipt'),
        ),
      ).toBe(true);
    });
  });

  it('uploads a valid document and shows the persisted identifier and status', async () => {
    const { fetchMock } = setupDocumentRoutes({ uploadDelayMs: 60 });
    renderPage();

    await screen.findByText('receipt.pdf');
    fireEvent.click(screen.getByRole('button', { name: 'Upload document' }));

    const dialog = await screen.findByRole('dialog');
    const file = new File(['%PDF-1.4 test'], 'receipt.pdf', {
      type: 'application/pdf',
    });
    fireEvent.change(within(dialog).getByLabelText(/Document file/), {
      target: { files: [file] },
    });
    await chooseOption(within(dialog).getByLabelText(/Document type/), 'Receipt');

    const submit = within(dialog).getByRole('button', { name: 'Upload document' });
    fireEvent.click(submit);
    fireEvent.click(submit);

    expect(
      await screen.findByText('Document uploaded: receipt.pdf'),
    ).toBeTruthy();
    expect(await screen.findByText(`Document ${documentId}`)).toBeTruthy();

    const postCalls = fetchMock.mock.calls.filter(
      ([input, init]) =>
        (init?.method ?? 'GET').toUpperCase() === 'POST' &&
        new URL(String(input), 'http://localhost').pathname === '/api/v1/documents',
    );
    expect(postCalls).toHaveLength(1);
    const form = postCalls[0]?.[1]?.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect(form.get('documentType')).toBe('RECEIPT');
    expect((form.get('file') as File).name).toBe('receipt.pdf');
    expect(form.get('expenseId')).toBeNull();
    expect((postCalls[0]?.[1]?.headers as Headers).get('Content-Type')).toBeNull();
  });

  it('rejects an unsupported file before making a request', async () => {
    const { fetchMock } = setupDocumentRoutes();
    renderPage();

    await screen.findByText('receipt.pdf');
    fireEvent.click(screen.getByRole('button', { name: 'Upload document' }));
    const dialog = await screen.findByRole('dialog');

    fireEvent.change(within(dialog).getByLabelText(/Document file/), {
      target: {
        files: [new File(['text'], 'notes.txt', { type: 'text/plain' })],
      },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Upload document' }));

    expect(
      await screen.findByText('Choose a PDF, JPEG, PNG, or WebP document.'),
    ).toBeTruthy();
    expect(
      fetchMock.mock.calls.filter(
        ([input, init]) =>
          (init?.method ?? 'GET').toUpperCase() === 'POST' &&
          String(input).endsWith('/api/v1/documents'),
      ),
    ).toHaveLength(0);
  });

  it('keeps documents read-only for viewers while allowing open and download', async () => {
    setupDocumentRoutes({ document: makeDocument() });
    renderPage('VIEWER');

    expect(await screen.findByText('receipt.pdf')).toBeTruthy();
    expect(screen.getByText('Read-only access')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Upload document' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete receipt.pdf' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Open receipt.pdf' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Download receipt.pdf' })).toBeTruthy();

    await openDocument();
    expect(
      await screen.findByText('A user with write access can start OCR.'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Run OCR' })).toBeNull();
  });

  it('disables OCR after an accepted request while waiting for status', async () => {
    const { fetchMock } = setupDocumentRoutes({
      ocrPostDelayMs: 80,
      keepOcrMissingAfterPost: true,
    });
    renderPage();

    await screen.findByText('receipt.pdf');
    await openDocument();

    const runOcr = await screen.findByRole('button', { name: 'Run OCR' });
    fireEvent.click(runOcr);
    fireEvent.click(runOcr);

    expect(await screen.findByText('OCR processing was queued.')).toBeTruthy();
    expect(
      screen.getByText('OCR request accepted. Waiting for the processing record to appear.'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Run OCR' })).toBeNull();

    await waitFor(() => {
      const postCalls = fetchMock.mock.calls.filter(
        ([input, init]) =>
          (init?.method ?? 'GET').toUpperCase() === 'POST' &&
          String(input).endsWith(`/api/v1/documents/${documentId}/ocr`),
      );
      expect(postCalls).toHaveLength(1);
    });
  });

  it('shows a pending OCR state without allowing a duplicate request', async () => {
    setupDocumentRoutes({
      document: makeDocument({ status: 'PROCESSING' }),
      ocr: makeOcr({
        status: 'PENDING',
        extractedText: null,
        pageCount: null,
        processingStartedAt: null,
        processingCompletedAt: null,
      }),
    });
    renderPage();

    await screen.findByText('receipt.pdf');
    await openDocument();

    expect(
      await screen.findByText('OCR is queued. Waiting for the worker to start processing.'),
    ).toBeTruthy();
    expect(screen.getByText('Pending')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Run OCR' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Retry OCR' })).toBeNull();
  });

  it('shows a processing OCR state with its start time', async () => {
    setupDocumentRoutes({
      document: makeDocument({ status: 'PROCESSING' }),
      ocr: makeOcr({
        status: 'PROCESSING',
        extractedText: null,
        pageCount: null,
        processingCompletedAt: null,
      }),
    });
    renderPage();

    await screen.findByText('receipt.pdf');
    await openDocument();

    expect(
      await screen.findByText('OCR is processing. This page will update automatically.'),
    ).toBeTruthy();
    expect(screen.getAllByText('Processing').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Run OCR' })).toBeNull();
  });

  it('shows a failed OCR state with the backend error and a retry action', async () => {
    setupDocumentRoutes({
      document: makeDocument({ status: 'FAILED' }),
      ocr: makeOcr({
        status: 'FAILED',
        extractedText: null,
        pageCount: null,
        processingCompletedAt: null,
        errorMessage: 'Tesseract failed with exit 1',
      }),
    });
    renderPage();

    await screen.findByText('receipt.pdf');
    await openDocument();

    expect(await screen.findByText('OCR failed')).toBeTruthy();
    expect(screen.getByText('Tesseract failed with exit 1')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry OCR' })).toBeTruthy();
    expect(screen.queryByText('View extracted text')).toBeNull();
  });

  it('displays OCR text and completed extraction suggestions', async () => {
    setupDocumentRoutes({
      document: makeDocument({ status: 'PROCESSED' }),
      ocr: makeOcr(),
      extraction: makeExtraction({ model: 'gpt-4o-mini-fallback' }),
    });
    renderPage();

    await screen.findByText('receipt.pdf');
    await openDocument();

    expect(await screen.findByText('View extracted text')).toBeTruthy();
    expect(
      screen.getByText('Acme Digital receipt total 120.00 USD'),
    ).toBeTruthy();
    expect(screen.queryByText(/\[OCR fallback\]/i)).toBeNull();
    expect(await screen.findByText('AI extraction suggestion')).toBeTruthy();
    expect(screen.getByText('INV-42')).toBeTruthy();
    expect(screen.getByText(/94\.0%/)).toBeTruthy();
    expect(screen.getByText('Software subscription')).toBeTruthy();
    expect(screen.getByText('Not accounting data')).toBeTruthy();
    expect(screen.getByText('Backend-reported extraction model')).toBeTruthy();
    expect(screen.getByText(/deterministic suggestions/)).toBeTruthy();
  });

  it('shows a pending review to viewers without review actions', async () => {
    setupDocumentRoutes({
      document: makeDocument({ status: 'PROCESSED' }),
      ocr: makeOcr(),
      extraction: makeExtraction(),
      review: makeReview(),
    });
    renderPage('VIEWER');

    await screen.findByText('receipt.pdf');
    await openDocument();

    expect(await screen.findByText('Pending review')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Start review' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Approve review' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reject review' })).toBeNull();
  });

  it('saves human corrections and approves the review', async () => {
    const { fetchMock } = setupDocumentRoutes({
      document: makeDocument({ status: 'PROCESSED' }),
      ocr: makeOcr(),
      extraction: makeExtraction(),
    });
    renderPage();

    await screen.findByText('receipt.pdf');
    await openDocument();

    fireEvent.click(await screen.findByRole('button', { name: 'Start review' }));
    expect(await screen.findByText('Human review copy')).toBeTruthy();

    const totalInput = await screen.findByLabelText('Total amount');
    expect((totalInput as HTMLInputElement).value).toBe('120');
    fireEvent.change(totalInput, { target: { value: '125' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Review changes saved.')).toBeTruthy();

    const putCall = fetchMock.mock.calls.find(
      ([, init]) => (init?.method ?? 'GET').toUpperCase() === 'PUT',
    );
    const putBody = JSON.parse(String(putCall?.[1]?.body)) as {
      reviewedData: StructuredExtractionData;
    };
    expect(putBody.reviewedData.totalAmount).toBe(125);

    const approve = screen.getByRole('button', { name: 'Approve review' });
    await waitFor(() => expect((approve as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(approve);

    expect(await screen.findByText('Review approved.')).toBeTruthy();
    expect(await screen.findByText('Approved review data')).toBeTruthy();
    expect(screen.getByText(/Ada Lovelace/)).toBeTruthy();
    expect(screen.getAllByText('$125.00').length).toBeGreaterThan(0);
  });

  it('reopens a rejected review for editing', async () => {
    setupDocumentRoutes({
      document: makeDocument({ status: 'PROCESSED' }),
      ocr: makeOcr(),
      extraction: makeExtraction(),
      review: makeReview({
        status: 'REJECTED',
        reviewComment: 'Total needs correction',
        reviewedBy: reviewer,
        reviewedAt: '2026-10-20T12:04:00Z',
      }),
    });
    renderPage();

    await screen.findByText('receipt.pdf');
    await openDocument();

    expect(await screen.findByText('Review rejected')).toBeTruthy();
    expect(screen.getAllByText('Total needs correction').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Reopen for review' }));

    expect(await screen.findByText('Review reopened for editing.')).toBeTruthy();
    expect(await screen.findByText('Human review copy')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Reopen for review' })).toBeNull();
  });

  it('downloads and deletes a document after confirmation', async () => {
    const { fetchMock } = setupDocumentRoutes();
    renderPage();

    await screen.findByText('receipt.pdf');
    fireEvent.click(screen.getByRole('button', { name: 'Download receipt.pdf' }));

    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled());
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Delete receipt.pdf' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Delete document?')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete document' }));

    expect(await screen.findByText('Document deleted: receipt.pdf')).toBeTruthy();
    expect(await screen.findByText('No documents yet')).toBeTruthy();
    expect(
      fetchMock.mock.calls.filter(
        ([, init]) => (init?.method ?? 'GET').toUpperCase() === 'DELETE',
      ),
    ).toHaveLength(1);
  });

  it('shows an upload API error without closing the dialog', async () => {
    setupDocumentRoutes({ uploadFailure: 500 });
    renderPage();

    await screen.findByText('receipt.pdf');
    fireEvent.click(screen.getByRole('button', { name: 'Upload document' }));
    const dialog = await screen.findByRole('dialog');
    const file = new File(['%PDF-1.4 test'], 'receipt.pdf', {
      type: 'application/pdf',
    });
    fireEvent.change(within(dialog).getByLabelText(/Document file/), {
      target: { files: [file] },
    });
    await chooseOption(within(dialog).getByLabelText(/Document type/), 'Receipt');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Upload document' }));

    expect(await screen.findByText('Unable to upload document')).toBeTruthy();
    expect(
      screen.getByText('The document request could not be completed. Please try again.'),
    ).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('shows session expiration when loading document details is unauthorized', async () => {
    setupDocumentRoutes({ detailFailure: 401 });
    renderPage();

    await screen.findByText('receipt.pdf');
    await openDocument();

    expect(
      await screen.findByText('Your session has expired. Please sign in again.'),
    ).toBeTruthy();
  });

  it('shows a load error and retries', async () => {
    const { setGetFailure } = setupDocumentRoutes({ getFailure: 500 });
    renderPage();

    expect(await screen.findByText('Unable to load documents')).toBeTruthy();
    expect(
      screen.getByText('The document request could not be completed. Please try again.'),
    ).toBeTruthy();

    setGetFailure(null);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('receipt.pdf')).toBeTruthy();
  });
});
