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

export const processFiles = async (fileList: FileList | null): Promise<ProcessFilesResult> => {
  if (!fileList) return { files: [], failedFiles: [] };

  const processedFiles: CaseFile[] = [];
  const failedFiles: string[] = [];

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    let content = '';
    
    try {
      // Check for PDF via Mime type OR extension (more robust)
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

      if (isPdf) {
        const arrayBuffer = await file.arrayBuffer();
        // Load the PDF document
        const loadingTask = pdf.getDocument({ data: arrayBuffer });
        const pdfDoc = await loadingTask.promise;
        
        let fullText = '';
        
        // Extract text from each page
        for (let j = 1; j <= pdfDoc.numPages; j++) {
          const page = await pdfDoc.getPage(j);
          const textContent = await page.getTextContent();
          
          // Join the text items with space
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');
            
          fullText += `--- Page ${j} ---\n${pageText}\n\n`;
        }
        content = fullText;
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
        type: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'text/plain'),
        content: content
      });
    } else {
      console.warn(`File ${file.name} produced no content, skipping.`);
      failedFiles.push(file.name);
    }
  }

  return { files: processedFiles, failedFiles }
};