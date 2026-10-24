import { useCallback, useEffect, useRef, useState } from 'react';
import { documentApi } from './api';
import {
  getDocumentErrorMessage,
  isAbortError,
  isNotFound,
} from './errors';
import type {
  DocumentExtraction,
  DocumentRecord,
  DocumentReview,
  OcrResult,
  StructuredExtractionData,
} from './types';

type ProcessingAction =
  | 'ocr'
  | 'extraction'
  | 'create-review'
  | 'save-review'
  | 'approve'
  | 'reject'
  | 'reopen';

interface UseDocumentProcessingOptions {
  documentId: string | null;
  open: boolean;
}

function isPending(status: string | undefined | null) {
  return status === 'PENDING' || status === 'PROCESSING';
}

export function useDocumentProcessing({
  documentId,
  open,
}: UseDocumentProcessingOptions) {
  const [document, setDocument] = useState<DocumentRecord | null>(null);
  const [ocr, setOcr] = useState<OcrResult | null>(null);
  const [extraction, setExtraction] = useState<DocumentExtraction | null>(null);
  const [review, setReview] = useState<DocumentReview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocrQueued, setOcrQueued] = useState(false);
  const [extractionQueued, setExtractionQueued] = useState(false);
  const [action, setAction] = useState<ProcessingAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const loadedOnceRef = useRef(false);
  const actionRef = useRef<ProcessingAction | null>(null);

  useEffect(() => {
    if (!open) return;

    loadedOnceRef.current = false;
    setDocument(null);
    setOcr(null);
    setExtraction(null);
    setReview(null);
    setError(null);
    setOcrQueued(false);
    setExtractionQueued(false);
    setActionError(null);
    setActionNotice(null);
    setAction(null);
    actionRef.current = null;
  }, [open, documentId]);

  useEffect(() => {
    if (!open || !documentId) return;

    const controller = new AbortController();
    let active = true;
    let timer: number | undefined;
    let attempt = 0;

    const run = async () => {
      if (!loadedOnceRef.current) {
        setLoading(true);
        loadedOnceRef.current = true;
      }

      try {
        const doc = await documentApi.get(documentId, controller.signal);
        if (!active) return;

        let nextOcr: OcrResult | null = null;
        try {
          nextOcr = await documentApi.getOcr(documentId, controller.signal);
        } catch (ocrError) {
          if (!isNotFound(ocrError)) throw ocrError;
        }
        if (!active) return;

        let nextExtraction: DocumentExtraction | null = null;
        if (nextOcr?.status === 'COMPLETED') {
          try {
            nextExtraction = await documentApi.getExtraction(
              documentId,
              controller.signal,
            );
          } catch (extractionError) {
            if (!isNotFound(extractionError)) throw extractionError;
          }
        }
        if (!active) return;

        let nextReview: DocumentReview | null = null;
        if (nextExtraction?.status === 'COMPLETED') {
          try {
            nextReview = await documentApi.getReview(documentId, controller.signal);
          } catch (reviewError) {
            if (!isNotFound(reviewError)) throw reviewError;
          }
        }
        if (!active) return;

        setDocument(doc);
        setOcr(nextOcr);
        setExtraction(nextExtraction);
        setReview(nextReview);
        if (nextOcr) setOcrQueued(false);
        if (nextExtraction) setExtractionQueued(false);
        setError(null);
        setLoading(false);

        const needsPolling =
          doc.status === 'PROCESSING' ||
          isPending(nextOcr?.status) ||
          isPending(nextExtraction?.status) ||
          (nextOcr?.status === 'COMPLETED' && nextExtraction === null);

        if (needsPolling) {
          const delay = attempt < 4 ? 3000 : attempt < 8 ? 5000 : 10000;
          attempt += 1;
          timer = window.setTimeout(() => {
            void run();
          }, delay);
        }
      } catch (loadError) {
        if (!active || isAbortError(loadError)) return;
        setError(getDocumentErrorMessage(loadError, 'load'));
        setLoading(false);
      }
    };

    void run();

    return () => {
      active = false;
      controller.abort();
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [open, documentId, reloadKey]);

  const reload = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  async function runAction(
    nextAction: ProcessingAction,
    request: () => Promise<void>,
    successMessage: string,
  ) {
    if (actionRef.current) return false;

    actionRef.current = nextAction;
    setAction(nextAction);
    setActionError(null);
    setActionNotice(null);

    try {
      await request();
      setActionNotice(successMessage);
      setReloadKey((key) => key + 1);
      return true;
    } catch (requestError) {
      setActionError(
        getDocumentErrorMessage(
          requestError,
          nextAction.includes('review') ||
            nextAction === 'approve' ||
            nextAction === 'reject' ||
            nextAction === 'reopen'
            ? 'review'
            : nextAction === 'ocr'
              ? 'ocr'
              : 'extraction',
        ),
      );
      return false;
    } finally {
      actionRef.current = null;
      setAction(null);
    }
  }

  function startOcr() {
    if (
      !documentId ||
      ocrQueued ||
      ocr?.status === 'PENDING' ||
      ocr?.status === 'PROCESSING'
    ) {
      return Promise.resolve(false);
    }
    return runAction(
      'ocr',
      async () => {
        await documentApi.startOcr(documentId);
        setOcrQueued(true);
      },
      'OCR processing was queued.',
    );
  }

  function startExtraction() {
    if (
      !documentId ||
      extractionQueued ||
      extraction?.status === 'PENDING' ||
      extraction?.status === 'PROCESSING'
    ) {
      return Promise.resolve(false);
    }
    return runAction(
      'extraction',
      async () => {
        await documentApi.startExtraction(documentId);
        setExtractionQueued(true);
      },
      'Data extraction was queued.',
    );
  }

  function createReview() {
    if (!documentId) return Promise.resolve(false);
    return runAction(
      'create-review',
      async () => {
        const created = await documentApi.createReview(documentId);
        setReview(created);
      },
      'Review started from the AI extraction.',
    );
  }

  function saveReview(data: StructuredExtractionData) {
    if (!documentId) return Promise.resolve(false);
    return runAction(
      'save-review',
      async () => {
        const saved = await documentApi.updateReview(documentId, data);
        setReview(saved);
      },
      'Review changes saved.',
    );
  }

  function approveReview(comment: string) {
    if (!documentId) return Promise.resolve(false);
    return runAction(
      'approve',
      async () => {
        const approved = await documentApi.approveReview(documentId, comment);
        setReview(approved);
      },
      'Review approved.',
    );
  }

  function rejectReview(comment: string) {
    if (!documentId) return Promise.resolve(false);
    return runAction(
      'reject',
      async () => {
        const rejected = await documentApi.rejectReview(documentId, comment);
        setReview(rejected);
      },
      'Review rejected.',
    );
  }

  function reopenReview() {
    if (!documentId) return Promise.resolve(false);
    return runAction(
      'reopen',
      async () => {
        const reopened = await documentApi.reopenReview(documentId);
        setReview(reopened);
      },
      'Review reopened for editing.',
    );
  }

  return {
    document,
    ocr,
    extraction,
    review,
    loading,
    error,
    ocrQueued,
    extractionQueued,
    action,
    actionError,
    actionNotice,
    reload,
    startOcr,
    startExtraction,
    createReview,
    saveReview,
    approveReview,
    rejectReview,
    reopenReview,
    setActionError,
    setActionNotice,
  };
}
