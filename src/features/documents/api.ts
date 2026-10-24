import { api } from 'src/lib/api/client';
import type { PageResponse } from 'src/lib/api/types';
import type {
  DocumentExtraction,
  DocumentListParams,
  DocumentRecord,
  DocumentReview,
  DocumentUploadInput,
  OcrResult,
  ProcessingAccepted,
  StructuredExtractionData,
} from './types';

function query(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, String(value));
  });
  const result = search.toString();
  return result ? `?${result}` : '';
}

export const documentApi = {
  list(params: DocumentListParams, signal?: AbortSignal) {
    return api.get<PageResponse<DocumentRecord>>(
      `/documents${query({
        page: params.page,
        size: params.size,
        originalFileName: params.filename.trim(),
        sort: params.sort,
      })}`,
      { signal },
    );
  },

  upload(input: DocumentUploadInput, signal?: AbortSignal) {
    const form = new FormData();
    form.append('file', input.file);
    form.append('documentType', input.documentType);
    if (input.expenseId) form.append('expenseId', input.expenseId);
    return api.post<DocumentRecord>('/documents', form, { signal });
  },

  get(id: string, signal?: AbortSignal) {
    return api.get<DocumentRecord>(`/documents/${id}`, { signal });
  },

  download(id: string, signal?: AbortSignal) {
    return api.get<Blob>(`/documents/${id}/download`, {
      signal,
      responseType: 'blob',
      headers: { Accept: '*/*' },
    });
  },

  delete(id: string, signal?: AbortSignal) {
    return api.delete<void>(`/documents/${id}`, { signal });
  },

  startOcr(id: string, signal?: AbortSignal) {
    return api.post<ProcessingAccepted>(`/documents/${id}/ocr`, undefined, { signal });
  },

  getOcr(id: string, signal?: AbortSignal) {
    return api.get<OcrResult>(`/documents/${id}/ocr`, { signal });
  },

  startExtraction(id: string, signal?: AbortSignal) {
    return api.post<ProcessingAccepted>(`/documents/${id}/extraction`, undefined, {
      signal,
    });
  },

  getExtraction(id: string, signal?: AbortSignal) {
    return api.get<DocumentExtraction>(`/documents/${id}/extraction`, { signal });
  },

  createReview(id: string, signal?: AbortSignal) {
    return api.post<DocumentReview>(`/documents/${id}/review`, undefined, { signal });
  },

  getReview(id: string, signal?: AbortSignal) {
    return api.get<DocumentReview>(`/documents/${id}/review`, { signal });
  },

  updateReview(
    id: string,
    reviewedData: StructuredExtractionData,
    signal?: AbortSignal,
  ) {
    return api.put<DocumentReview>(
      `/documents/${id}/review`,
      { reviewedData },
      { signal },
    );
  },

  approveReview(id: string, reviewComment: string, signal?: AbortSignal) {
    return api.post<DocumentReview>(
      `/documents/${id}/review/approve`,
      { reviewComment: reviewComment.trim() || null },
      { signal },
    );
  },

  rejectReview(id: string, reviewComment: string, signal?: AbortSignal) {
    return api.post<DocumentReview>(
      `/documents/${id}/review/reject`,
      { reviewComment: reviewComment.trim() || null },
      { signal },
    );
  },

  reopenReview(id: string, signal?: AbortSignal) {
    return api.post<DocumentReview>(`/documents/${id}/review/reopen`, undefined, {
      signal,
    });
  },
};
