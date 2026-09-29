import { Injectable } from '@angular/core';
import * as pdfjsLib from 'pdfjs-dist';

const WORDS_PER_CHUNK = 1000;  
const WORD_OVERLAP = 100;

@Injectable({ providedIn: 'root' })
export class DocumentService {
  async extractText(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const pages: string[] = [];

    for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex++) {
      const page = await pdf.getPage(pageIndex);
      const textContent = await page.getTextContent();
      const text = textContent.items
        .map((item: any) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      pages.push(text);
    }

    return pages.join('\n\n');
  }

  async extractTextFromPdf(file: File): Promise<string> {
    return this.extractText(file);
  }

  splitIntoChunks(text: string): string[] {
    const words = text.split(/\s+/).filter(Boolean);

    if (words.length === 0) {
      return [];
    }

    const chunks: string[] = [];
    const step = WORDS_PER_CHUNK - WORD_OVERLAP;

    for (let index = 0; index < words.length; index += step) {
      const chunk = words.slice(index, index + WORDS_PER_CHUNK).join(' ');

      if (chunk.trim().length === 0) {
        continue;
      }

      chunks.push(chunk);

      if (index + WORDS_PER_CHUNK >= words.length) {
        break;
      }
    }

    return chunks;
  }

 

  async extractDocumentChunks(file: File): Promise<string[]> {
    const text = await this.extractText(file);
    return this.splitIntoChunks(text);
  }

  // Returns chunks with page numbers when possible
  async extractDocumentChunksWithPages(file: File): Promise<Array<{ content: string; pageNumber?: number }>> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const results: Array<{ content: string; pageNumber?: number }> = [];

    for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex++) {
      const page = await pdf.getPage(pageIndex);
      const textContent = await page.getTextContent();
      const text = textContent.items
        .map((item: any) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (!text) continue;

      const chunks = this.splitIntoChunks(text);
      for (const chunk of chunks) {
        results.push({ content: chunk, pageNumber: pageIndex });
      }
    }

    return results;
  }

  createTextChunks(text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const chunks: string[] = [];
  const step = WORDS_PER_CHUNK - WORD_OVERLAP;

  for (let index = 0; index < words.length; index += step) {
    const chunk = words.slice(index, index + WORDS_PER_CHUNK).join(' ');
    if (chunk.trim().length === 0) continue;
    chunks.push(chunk);
    if (chunks.length >= 20) break;  // ← max 20 chunks per document
    if (index + WORDS_PER_CHUNK >= words.length) break;
  }

  return chunks;
}
}
