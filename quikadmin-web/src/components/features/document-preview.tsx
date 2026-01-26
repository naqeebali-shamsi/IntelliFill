import { useRef, useState, useEffect, useCallback } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Lazy-load PDF.js only when needed to save ~1MB of memory
// The worker is also only initialized when a PDF is actually rendered
let pdfJsPromise: Promise<typeof import('pdfjs-dist')> | null = null;
let pdfJsLoaded = false;

async function loadPdfJs() {
  if (pdfJsLoaded) {
    return import('pdfjs-dist');
  }

  if (!pdfJsPromise) {
    pdfJsPromise = import('pdfjs-dist').then((pdfjs) => {
      // Initialize worker only once, when PDF.js is first loaded
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      pdfJsLoaded = true;
      return pdfjs;
    });
  }

  return pdfJsPromise;
}

export interface DocumentPreviewProps {
  documentUrl: string;
  fileType: string;
  className?: string;
  initialScale?: number;
}

type LoadingState = 'idle' | 'loading' | 'loaded' | 'error';

export function DocumentPreview({
  documentUrl,
  fileType,
  className,
  initialScale = 1,
}: DocumentPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(initialScale);
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [error, setError] = useState<string | null>(null);

  const isPdf = fileType === 'application/pdf';
  const isImage = fileType.startsWith('image/');

  const loadPdf = useCallback(async () => {
    if (!canvasRef.current || !isPdf) return;

    setLoadingState('loading');
    setError(null);

    try {
      // Lazy-load PDF.js only when needed
      const pdfjsLib = await loadPdfJs();

      // Cancel any existing render task to prevent memory buildup
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }

      // Load PDF document if not already loaded
      if (!pdfDocRef.current) {
        const loadingTask = pdfjsLib.getDocument(documentUrl);
        pdfDocRef.current = await loadingTask.promise;
        setNumPages(pdfDocRef.current.numPages);
      }

      // Get the page
      const page = await pdfDocRef.current.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      // Set canvas dimensions
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Could not get canvas context');
      }

      // Clear previous canvas content to release memory
      context.clearRect(0, 0, canvas.width, canvas.height);

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderTask = page.render({
        canvasContext: context,
        viewport,
        canvas,
      });

      renderTaskRef.current = renderTask;

      await renderTask.promise;
      renderTaskRef.current = null;

      setLoadingState('loaded');
    } catch (err) {
      // Ignore cancellation errors
      if (err instanceof Error && err.name === 'RenderingCancelledException') {
        return;
      }
      console.error('Error loading PDF:', err);
      setError(err instanceof Error ? err.message : 'Failed to load PDF');
      setLoadingState('error');
    }
  }, [documentUrl, pageNum, scale, isPdf]);

  // Load PDF when dependencies change
  useEffect(() => {
    if (isPdf) {
      loadPdf();
    }

    // Cleanup on unmount or URL change
    return () => {
      // Cancel any pending render task
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }

      // Destroy PDF document to release memory
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy();
        pdfDocRef.current = null;
      }

      // Clear canvas to release GPU memory
      if (canvasRef.current) {
        const context = canvasRef.current.getContext('2d');
        if (context) {
          context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
        // Reset canvas dimensions to release memory
        canvasRef.current.width = 0;
        canvasRef.current.height = 0;
      }
    };
  }, [loadPdf, isPdf, documentUrl]);

  // Reset state when document changes
  useEffect(() => {
    setPageNum(1);
    setNumPages(0);
    setScale(initialScale);
    pdfDocRef.current = null;
  }, [documentUrl, initialScale]);

  function handlePrevPage(): void {
    setPageNum((prev) => Math.max(1, prev - 1));
  }

  function handleNextPage(): void {
    setPageNum((prev) => Math.min(numPages, prev + 1));
  }

  function handleZoomIn(): void {
    setScale((prev) => Math.min(3, prev + 0.25));
  }

  function handleZoomOut(): void {
    setScale((prev) => Math.max(0.5, prev - 0.25));
  }

  if (isImage) {
    return (
      <div className={cn('flex flex-col items-center', className)}>
        <img
          src={documentUrl}
          alt="Document preview"
          className="max-w-full h-auto rounded-lg border"
          onError={() => {
            setError('Failed to load image');
            setLoadingState('error');
          }}
        />
      </div>
    );
  }

  if (isPdf) {
    return (
      <div className={cn('flex flex-col items-center space-y-4', className)}>
        <div className="relative border rounded-lg overflow-auto max-h-[600px] bg-muted/20">
          {loadingState === 'loading' && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
          {loadingState === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/50 z-10 p-4">
              <AlertTriangle className="h-8 w-8 text-destructive mb-2" />
              <p className="text-sm text-destructive text-center">
                {error || 'Failed to load PDF'}
              </p>
            </div>
          )}
          <canvas ref={canvasRef} className="block" />
        </div>

        {numPages > 0 && (
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                disabled={pageNum <= 1}
                onClick={handlePrevPage}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground min-w-[80px] text-center">
                Page {pageNum} of {numPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                disabled={pageNum >= numPages}
                onClick={handleNextPage}
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                disabled={scale <= 0.5}
                onClick={handleZoomOut}
                aria-label="Zoom out"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground min-w-[60px] text-center">
                {Math.round(scale * 100)}%
              </span>
              <Button
                variant="outline"
                size="icon"
                disabled={scale >= 3}
                onClick={handleZoomIn}
                aria-label="Zoom in"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 text-muted-foreground',
        className
      )}
    >
      <AlertTriangle className="h-8 w-8 mb-2" />
      <p className="text-sm">Preview not available for this file type</p>
      <p className="text-xs mt-1">{fileType}</p>
    </div>
  );
}
