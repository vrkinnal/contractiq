import { Component, computed, inject, input, signal, OnDestroy } from '@angular/core';
import { EmbeddingService } from '../services/embedding.service';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  isError?: boolean;
}

@Component({
  selector: 'app-chat',
  standalone: true,
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss',
})
export class ChatComponent implements OnDestroy {
  private readonly embeddingService = inject(EmbeddingService);

  // ─── Inputs ───
  readonly document = input<any>(null);

  // ─── Signals ───
  readonly messages = signal<Message[]>([]);
  readonly question = signal('');
  readonly isSubmitting = signal(false);
  readonly searchingChunks = signal(false);
  readonly textareaFocused = signal(false);
  readonly citations = signal<{ content: string; name: string; pageNumber: number | null }[]>([]);

  // ─── Computed ───
  readonly canSubmit = computed(() =>
    this.question().trim().length > 0 && !this.isSubmitting()
  );

  // ─── Friendly error mapper ───
  private friendlyError(raw: string): string {
    if (raw.includes('quota') || raw.includes('429') || raw.includes('daily') || raw.includes('RESOURCE_EXHAUSTED')) {
      return 'The daily AI limit has been reached. Please try again after midnight Pacific Time.';
    }
    if (raw.includes('Failed to fetch') || raw.includes('NetworkError') || raw.includes('network')) {
      return 'Connection error. Please check your internet and try again.';
    }
    if ((raw.includes('model') && raw.includes('not found')) || raw.includes('decommissioned')) {
      return 'AI model unavailable. Please try again in a moment.';
    }
    if (raw.includes('Search failed') || raw.includes('embedding')) {
      return 'Could not search the document. Please try asking your question again.';
    }
    if (raw.includes('No response body') || raw.includes('stream')) {
      return 'Response stream failed. Please try again.';
    }
    return 'Something went wrong. Please try again.';
  }

  // ─── Submit question ───
  async submitQuestion(): Promise<void> {
    const text = this.question().trim();
    if (!text || this.isSubmitting()) return;

    // Add user message
    this.messages.update(m => [...m, { role: 'user', content: text }]);
    this.question.set('');
    this.isSubmitting.set(true);
    this.citations.set([]);

    // Add empty assistant message placeholder
    this.messages.update(m => [...m, { role: 'assistant', content: '' }]);
    const lastIndex = this.messages().length - 1;

    try {
      const sessionId = this.document()?.sessionId ?? null;

      // Step 1 — search relevant chunks
      this.searchingChunks.set(true);
      const similarChunks = await this.embeddingService.searchSimilarChunks(
        text,
        null,
        sessionId
      );
      this.searchingChunks.set(false);

      // Step 2 — build citations
      this.citations.set(similarChunks.map(c => ({
        content: c.content,
        name: c.name,
        pageNumber: c.pageNumber
      })));

      const context = similarChunks.map(c => c.content).join('\n\n');
      const documentLabel = this.document()?.files
        ? this.document().files.map((f: File) => f.name).join(', ')
        : 'uploaded document';

      // Step 3 — improved RAG prompt
      const ragPrompt = `You are a helpful document assistant.

The user has uploaded a document called "${documentLabel}".
Here are the most relevant sections from that document:

---
${context}
---

Based ONLY on the sections above, answer this question:
${text}

Rules:
- Answer directly and clearly using only the context provided above
- If the document mentions specific numbers, dates or names related to the question, include them
- If the answer cannot be found in the sections above, say exactly: "I could not find this information in the uploaded documents"
- Do not make up information or use knowledge outside the provided context`;

      // Step 4 — stream response
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'openai/gpt-oss-120b',
          messages: [{ role: 'user', content: ragPrompt }],
          temperature: 0.1,
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      if (!response.body) throw new Error('No response body');

      // Step 5 — stream tokens into last message
      let streamedAnswer = '';
      for await (const token of this.parseStream(response.body)) {
        streamedAnswer += token;
        this.messages.update(msgs => {
          const updated = [...msgs];
          updated[lastIndex] = { role: 'assistant', content: streamedAnswer };
          return updated;
        });
      }

    } catch (error: any) {
      this.searchingChunks.set(false);
      const friendly = this.friendlyError(error?.message ?? '');
      this.messages.update(msgs => {
        const updated = [...msgs];
        updated[lastIndex] = {
          role: 'assistant',
          content: friendly,
          isError: true
        };
        return updated;
      });
    } finally {
      this.isSubmitting.set(false);
      this.searchingChunks.set(false);
    }
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.submitQuestion();
    }
  }

  private keyHandler = (event: KeyboardEvent) => {
    if (event.key !== 'Enter') return;
    if (this.textareaFocused()) return;
    if (this.isSubmitting()) return;
    if (!this.canSubmit()) return;
    event.preventDefault();
    void this.submitQuestion();
  };

  constructor() {
    document.addEventListener('keydown', this.keyHandler);
  }

  ngOnDestroy(): void {
    document.removeEventListener('keydown', this.keyHandler);
  }

  private async *parseStream(body: ReadableStream<Uint8Array>): AsyncGenerator<string, void, unknown> {
    const reader = body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split(/\n\n/);
      buffer = parts.pop() ?? '';

      for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;

        const payload = trimmed.replace(/^data: /, '');
        try {
          const parsed = JSON.parse(payload);
          const token = parsed.choices?.[0]?.delta?.content;
          if (token) yield token;
        } catch {
          // ignore malformed chunks
        }
      }
    }
  }
}