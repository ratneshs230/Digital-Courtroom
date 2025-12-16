import * as pdfjsLib from 'pdfjs-dist';
import { CaseFile } from '../types';

// In some ESM builds (like esm.sh), the library is often on the .default property
// We cast to any to perform a runtime check and avoid TS errors
const pdf: any = (pdfjsLib as any).default || pdfjsLib;

// Configure the worker for pdfjs-dist
// Ensure GlobalWorkerOptions exists before setting
if (pdf.GlobalWorkerOptions) {
    pdf.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
} else {
    console.warn("PDF.js GlobalWorkerOptions not found. PDF parsing may fail.");
}

export interface ProcessFilesResult {
  files: CaseFile[];
  failedFiles: string[];
}

// Enhanced result with detailed failure information
export interface FailedFileInfo {
  fileName: string;
  file: File;
  error: string;
  errorCode: 'NETWORK_ERROR' | 'API_ERROR' | 'PARSE_ERROR' | 'NO_CONTENT' | 'UNKNOWN';
  retryable: boolean;
  attemptCount: number;
}

export interface EnhancedProcessFilesResult {
  files: CaseFile[];
  failedFiles: FailedFileInfo[];
  hasRetryable: boolean;
}

// Check if a file is an image
const isImageFile = (file: File): boolean => {
  const imageTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/bmp'];
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'];
  return imageTypes.includes(file.type) || imageExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
};

// Convert file to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix to get just the base64
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
};

// Convert PDF page to image using canvas
const pdfPageToImage = async (page: any, scale: number = 2): Promise<string> => {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.height = viewport.height;
  canvas.width = viewport.width;

  await page.render({
    canvasContext: context,
    viewport: viewport
  }).promise;

  // Convert canvas to base64 PNG
  const dataUrl = canvas.toDataURL('image/png');
  return dataUrl.split(',')[1];
};

// Extract text from image using Gemini Vision API
const extractTextFromImage = async (base64Image: string, mimeType: string = 'image/png'): Promise<string> => {
  const apiKey = localStorage.getItem('gemini_api_key');
  if (!apiKey) {
    throw new Error('No API key found for image processing');
  }

  // Parse multiple API keys
  const keys = apiKey.split(',').map(k => k.trim()).filter(k => k.length > 0);
  let lastError: Error | null = null;

  for (const key of keys) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: `Extract ALL text from this document image. This is a legal document, so be thorough and accurate.

INSTRUCTIONS:
1. Extract every piece of text visible in the image
2. Maintain the structure and formatting where possible
3. Include headers, footers, page numbers, stamps, signatures descriptions
4. If handwritten text is present, do your best to transcribe it
5. Note any tables, forms, or structured data
6. If text is unclear, indicate with [unclear] but try to make your best guess

Output the extracted text in a clean, readable format.`
              },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Image
                }
              }
            ]
          }]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `API error: ${response.status}`);
      }

      const data = await response.json();
      const extractedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (extractedText) {
        return extractedText;
      }
      throw new Error('No text extracted from image');
    } catch (error) {
      lastError = error as Error;
      console.warn(`Failed with key, trying next...`);
      continue;
    }
  }

  throw lastError || new Error('Failed to extract text from image');
};

// Process image-based PDF by converting pages to images and using OCR
const processImagePdf = async (arrayBuffer: ArrayBuffer, fileName: string): Promise<string> => {
  const loadingTask = pdf.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;

  let fullText = '';
  const totalPages = pdfDoc.numPages;

  // Process pages (limit to first 20 pages to avoid token limits)
  const maxPages = Math.min(totalPages, 20);

  for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
    try {
      const page = await pdfDoc.getPage(pageNum);
      const base64Image = await pdfPageToImage(page);
      const pageText = await extractTextFromImage(base64Image, 'image/png');
      fullText += `--- Page ${pageNum} ---\n${pageText}\n\n`;
    } catch (error) {
      console.error(`Error processing page ${pageNum} of ${fileName}:`, error);
      fullText += `--- Page ${pageNum} ---\n[Error extracting text from this page]\n\n`;
    }
  }

  if (totalPages > maxPages) {
    fullText += `\n[Note: Only first ${maxPages} of ${totalPages} pages were processed]\n`;
  }

  return fullText;
};

export const processFiles = async (
  fileList: FileList | null,
  onProgress?: (status: string, current: number, total: number) => void
): Promise<ProcessFilesResult> => {
  if (!fileList) return { files: [], failedFiles: [] };

  const processedFiles: CaseFile[] = [];
  const failedFiles: string[] = [];
  const total = fileList.length;

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    let content = '';

    onProgress?.(`Processing ${file.name}...`, i + 1, total);

    try {
      // Check for PDF via Mime type OR extension (more robust)
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isImage = isImageFile(file);

      if (isImage) {
        // Process image file using AI vision
        onProgress?.(`Extracting text from image: ${file.name}...`, i + 1, total);
        const base64 = await fileToBase64(file);
        const mimeType = file.type || 'image/png';
        content = await extractTextFromImage(base64, mimeType);
        content = `[Extracted from image: ${file.name}]\n\n${content}`;
      } else if (isPdf) {
        const arrayBuffer = await file.arrayBuffer();
        // Load the PDF document
        const loadingTask = pdf.getDocument({ data: arrayBuffer });
        const pdfDoc = await loadingTask.promise;

        let fullText = '';
        let hasTextContent = false;

        // First, try to extract text normally
        onProgress?.(`Extracting text from PDF: ${file.name}...`, i + 1, total);
        for (let j = 1; j <= pdfDoc.numPages; j++) {
          const page = await pdfDoc.getPage(j);
          const textContent = await page.getTextContent();

          // Join the text items with space
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ')
            .trim();

          if (pageText.length > 50) {
            hasTextContent = true;
          }

          fullText += `--- Page ${j} ---\n${pageText}\n\n`;
        }

        // Check if the PDF has meaningful text content
        const cleanedText = fullText.replace(/---\s*Page\s*\d+\s*---/g, '').trim();

        if (cleanedText.length < 100 || !hasTextContent) {
          // This is likely an image-based PDF, use OCR
          onProgress?.(`Image PDF detected, using AI OCR: ${file.name}...`, i + 1, total);
          try {
            content = await processImagePdf(arrayBuffer, file.name);
            content = `[Extracted via OCR from image-based PDF: ${file.name}]\n\n${content}`;
          } catch (ocrError) {
            console.error(`OCR failed for ${file.name}:`, ocrError);
            // Fall back to whatever text we got
            content = fullText.length > 0 ? fullText : '[Unable to extract text from this PDF - it may be password protected or corrupted]';
          }
        } else {
          content = fullText;
        }
      } else {
        // For txt, docx (raw text read), etc.
        content = await file.text();
      }
    } catch (e) {
      console.error(`Failed to read file ${file.name}`, e);
      failedFiles.push(file.name);
      continue;
    }

    // Only add files that were successfully processed with actual content
    if (content && content.trim().length > 0) {
      processedFiles.push({
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        type: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : isImageFile(file) ? 'image/png' : 'text/plain'),
        content: content
      });
    } else {
      console.warn(`File ${file.name} produced no content, skipping.`);
      failedFiles.push(file.name);
    }
  }

  return { files: processedFiles, failedFiles };
};

/**
 * Classify an error to determine if it's retryable
 */
const classifyError = (error: unknown): { code: FailedFileInfo['errorCode']; retryable: boolean } => {
  const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('connection')) {
    return { code: 'NETWORK_ERROR', retryable: true };
  }
  if (errorMessage.includes('api') || errorMessage.includes('rate') || errorMessage.includes('429') || errorMessage.includes('503')) {
    return { code: 'API_ERROR', retryable: true };
  }
  if (errorMessage.includes('parse') || errorMessage.includes('json') || errorMessage.includes('syntax')) {
    return { code: 'PARSE_ERROR', retryable: false };
  }
  if (errorMessage.includes('no content') || errorMessage.includes('empty') || errorMessage.includes('no text')) {
    return { code: 'NO_CONTENT', retryable: false };
  }
  return { code: 'UNKNOWN', retryable: true };
};

/**
 * Enhanced file processing with detailed failure tracking and recovery support
 */
export const processFilesWithRecovery = async (
  fileList: FileList | File[] | null,
  onProgress?: (status: string, current: number, total: number) => void,
  existingFailures?: FailedFileInfo[]
): Promise<EnhancedProcessFilesResult> => {
  if (!fileList || (Array.isArray(fileList) && fileList.length === 0)) {
    return { files: [], failedFiles: existingFailures || [], hasRetryable: false };
  }

  const processedFiles: CaseFile[] = [];
  const failedFiles: FailedFileInfo[] = [];
  const files = Array.isArray(fileList) ? fileList : Array.from(fileList);
  const total = files.length;

  // Create a map of existing failures for attempt tracking
  const attemptMap = new Map<string, number>();
  if (existingFailures) {
    existingFailures.forEach(f => attemptMap.set(f.fileName, f.attemptCount));
  }

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const attemptCount = (attemptMap.get(file.name) || 0) + 1;
    let content = '';

    onProgress?.(`Processing ${file.name} (attempt ${attemptCount})...`, i + 1, total);

    try {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isImage = isImageFile(file);

      if (isImage) {
        onProgress?.(`Extracting text from image: ${file.name}...`, i + 1, total);
        const base64 = await fileToBase64(file);
        const mimeType = file.type || 'image/png';
        content = await extractTextFromImage(base64, mimeType);
        content = `[Extracted from image: ${file.name}]\n\n${content}`;
      } else if (isPdf) {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdf.getDocument({ data: arrayBuffer });
        const pdfDoc = await loadingTask.promise;

        let fullText = '';
        let hasTextContent = false;

        onProgress?.(`Extracting text from PDF: ${file.name}...`, i + 1, total);
        for (let j = 1; j <= pdfDoc.numPages; j++) {
          const page = await pdfDoc.getPage(j);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ')
            .trim();

          if (pageText.length > 50) {
            hasTextContent = true;
          }
          fullText += `--- Page ${j} ---\n${pageText}\n\n`;
        }

        const cleanedText = fullText.replace(/---\s*Page\s*\d+\s*---/g, '').trim();

        if (cleanedText.length < 100 || !hasTextContent) {
          onProgress?.(`Image PDF detected, using AI OCR: ${file.name}...`, i + 1, total);
          try {
            content = await processImagePdf(arrayBuffer, file.name);
            content = `[Extracted via OCR from image-based PDF: ${file.name}]\n\n${content}`;
          } catch (ocrError) {
            console.error(`OCR failed for ${file.name}:`, ocrError);
            content = fullText.length > 0 ? fullText : '[Unable to extract text from this PDF]';
          }
        } else {
          content = fullText;
        }
      } else {
        content = await file.text();
      }

      // Check if content is valid
      if (!content || content.trim().length === 0) {
        throw new Error('No content extracted from file');
      }

      processedFiles.push({
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        type: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : isImageFile(file) ? 'image/png' : 'text/plain'),
        content: content
      });
    } catch (error) {
      console.error(`Failed to process ${file.name}:`, error);
      const { code, retryable } = classifyError(error);

      failedFiles.push({
        fileName: file.name,
        file: file,
        error: error instanceof Error ? error.message : String(error),
        errorCode: code,
        retryable: retryable && attemptCount < 3, // Max 3 attempts
        attemptCount
      });
    }
  }

  return {
    files: processedFiles,
    failedFiles,
    hasRetryable: failedFiles.some(f => f.retryable)
  };
};

/**
 * Retry processing failed files
 */
export const retryFailedFiles = async (
  failedFiles: FailedFileInfo[],
  onProgress?: (status: string, current: number, total: number) => void
): Promise<EnhancedProcessFilesResult> => {
  const retryableFiles = failedFiles.filter(f => f.retryable);
  const nonRetryableFiles = failedFiles.filter(f => !f.retryable);

  if (retryableFiles.length === 0) {
    return { files: [], failedFiles: nonRetryableFiles, hasRetryable: false };
  }

  const files = retryableFiles.map(f => f.file);
  const result = await processFilesWithRecovery(files, onProgress, retryableFiles);

  // Combine non-retryable failures with any new failures
  return {
    files: result.files,
    failedFiles: [...nonRetryableFiles, ...result.failedFiles],
    hasRetryable: result.hasRetryable
  };
};