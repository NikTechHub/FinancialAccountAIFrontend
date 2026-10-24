import { describe, expect, it } from 'vitest';
import { ApiError } from 'src/lib/api/client';
import { getDocumentErrorMessage } from './errors';

function apiError(status: number, message = '') {
  return new ApiError(message, { kind: 'http', status });
}

describe('document error messages', () => {
  it('distinguishes session expiry from insufficient permissions', () => {
    expect(getDocumentErrorMessage(apiError(401), 'review')).toBe(
      'Your session has expired. Please sign in again.',
    );
    expect(getDocumentErrorMessage(apiError(403), 'ocr')).toBe(
      'You do not have permission to start OCR processing.',
    );
    expect(getDocumentErrorMessage(apiError(403), 'review')).toBe(
      'You do not have permission to update this review.',
    );
  });

  it('maps backend upload limits and availability failures', () => {
    expect(getDocumentErrorMessage(apiError(413), 'upload')).toMatch(/10 MB/);
    expect(getDocumentErrorMessage(apiError(415), 'upload')).toMatch(
      /PDF, JPEG, PNG, or WebP/,
    );
    expect(getDocumentErrorMessage(apiError(503), 'ocr')).toMatch(
      /temporarily unavailable/,
    );
  });
});
