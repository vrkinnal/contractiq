import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

export interface SimilarDocumentChunk {
  id: string;
  content: string;
  name: string;
  pageNumber: number | null;
  similarity: number;
}

@Injectable({
  providedIn: 'root',
})
export class EmbeddingService {
  private readonly supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseAnonKey
    );
  }

  // ─── Friendly error mapper ───
  private friendlyError(raw: string): string {
    if (raw.includes('quota') || raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED') || raw.includes('daily')) {
      return 'quota_exceeded';
    }
    if (raw.includes('Failed to fetch') || raw.includes('NetworkError') || raw.includes('network')) {
      return 'Unable to connect. Please check your internet connection and try again.';
    }
    if (raw.includes('row-level security') || raw.includes('42501')) {
      return 'Database permission error. Please contact support.';
    }
    if (raw.includes('JWT') || raw.includes('auth') || raw.includes('401')) {
      return 'Authentication error. Please refresh the page and try again.';
    }
    if (raw.includes('No embedding returned') || raw.includes('embedding')) {
      return 'AI processing failed. Please try again in a moment.';
    }
    if (raw.includes('No text found') || raw.includes('scanned')) {
      return 'Could not read this PDF. It may be a scanned image without selectable text.';
    }
    if (raw.includes('Failed to create document') || raw.includes('Failed to store')) {
      return 'Failed to save document. Please try again.';
    }
    if (raw.includes('Search failed')) {
      return 'Search failed. Please try asking your question again.';
    }
    if (raw.includes('timeout') || raw.includes('Timeout')) {
      return 'Request timed out. Please try again.';
    }
    // Generic fallback — never show raw error to user
    return 'Something went wrong. Please try again.';
  }

  // ─── Get embedding from Gemini via proxy ───
  private async getEmbedding(text: string): Promise<number[]> {
    let response: Response;

    try {
      response = await fetch('/api/embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: text })
      });
    } catch {
      throw new Error('Unable to connect. Please check your internet connection and try again.');
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(this.friendlyError(errorText));
    }

    const data = await response.json();

    if (!data?.data?.[0]?.embedding) {
      throw new Error('AI processing failed. Please try again in a moment.');
    }

    return data.data[0].embedding;
  }

  // ─── Store multiple files with metadata ───
  async storeChunksWithMetadata(
    items: Array<{ content: string; metadata: any }>,
    sessionId: string
  ): Promise<void> {

    // Group items by documentId
    const grouped = new Map<string, Array<{ content: string; metadata: any }>>();
    for (const item of items) {
      const docId = item.metadata.documentId;
      if (!grouped.has(docId)) grouped.set(docId, []);
      grouped.get(docId)!.push(item);
    }

    // Process each document group
    for (const [, chunks] of grouped) {
      const first = chunks[0].metadata;

      // Step 1 — Create document_files record
      const { data: docData, error: docError } = await this.supabase
        .from('document_files')
        .insert({
          name: first.fileName,
          size: null,
          session_id: sessionId
        })
        .select('id')
        .single();

      if (docError) {
        throw new Error(this.friendlyError(docError.message));
      }

      const documentId = docData.id;

      // Step 2 — Store each chunk
      for (let i = 0; i < chunks.length; i++) {
        const { content, metadata } = chunks[i];
        const embedding = await this.getEmbedding(content);

        const { error } = await this.supabase.from('documents').insert({
          document_id: documentId,
          name: metadata.fileName,
          content,
          embedding,
          session_id: sessionId,
          chunk_index: metadata.chunkIndex ?? i,
          page_number: metadata.pageNumber ?? null
        });

        if (error) {
          throw new Error(this.friendlyError(error.message));
        }
      }
    }
  }

  // ─── Search across all docs or filter by session/document ───
  async searchSimilarChunks(
    question: string,
    documentId: string | null = null,
    sessionId: string | null = null
  ): Promise<SimilarDocumentChunk[]> {
    let embedding: number[];

    try {
      embedding = await this.getEmbedding(question);
    } catch (error: any) {
      throw new Error(this.friendlyError(error?.message ?? ''));
    }

    const { data, error } = await this.supabase.rpc('match_documents', {
      query_embedding: embedding,
      match_count: 5,
      filter_document_id: documentId,
      session_id: sessionId
    });

    if (error) {
      throw new Error(this.friendlyError(error.message));
    }

    return (data ?? []).map((row: any) => ({
      id: String(row.id ?? ''),
      content: String(row.content ?? ''),
      name: String(row.name ?? 'Unknown'),
      pageNumber: row.page_number ?? null,
      similarity: Number(row.similarity ?? 0)
    }));
  }
}