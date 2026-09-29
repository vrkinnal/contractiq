import { Component, computed, inject, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DocumentService } from '../services/document.service';
import { EmbeddingService } from '../services/embedding.service';

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './upload.component.html',
  styleUrl: './upload.component.scss',
})
export class UploadComponent {
  // ─── Services ───
  private documentService = inject(DocumentService);
  private embeddingService = inject(EmbeddingService);

  // ─── Signals ───
  uploadedFiles = signal<File[]>([]);
  isProcessing = signal(false);
  isReady = signal(false);
  errorMessage = signal<string | null>(null);
  progressMessage = signal<string>('Indexing document...');

  // ─── Output ───
  readonly documentReady = output<any>();

  // ─── Computed ───
  readonly fileName = computed(() =>
    this.uploadedFiles().length > 0
      ? `${this.uploadedFiles().length} document(s) selected`
      : 'No document selected'
  );

  // ─── File selection ───
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    this.addFiles(files);
  }

  // ─── Drag and drop ───
  onDrop(event: DragEvent): void {
    event.preventDefault();
    const files = Array.from(event.dataTransfer?.files ?? []);
    this.addFiles(files);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  // ─── Remove single file ───
  removeFile(index: number): void {
    const list = [...this.uploadedFiles()];
    list.splice(index, 1);
    this.uploadedFiles.set(list);
    this.isReady.set(this.uploadedFiles().length > 0);
    this.errorMessage.set(null);
  }

  // ─── Clear all files ───
  clearAll(): void {
    this.uploadedFiles.set([]);
    this.isProcessing.set(false);
    this.isReady.set(false);
    this.errorMessage.set(null);
  }

  // ─── Add files with validation ───
  private addFiles(files: File[]): void {
    const valid: File[] = [];

    for (const file of files) {
      if (file.type !== 'application/pdf') {
        this.errorMessage.set('Only PDF files are supported.');
        continue;
      }

      const duplicate = this.uploadedFiles().some(
        f => f.name === file.name && f.size === file.size
      );
      if (duplicate) {
        this.errorMessage.set(`"${file.name}" is already selected.`);
        continue;
      }

      valid.push(file);
    }

    if (valid.length === 0) return;

    this.uploadedFiles.set([...this.uploadedFiles(), ...valid]);
    this.isReady.set(true);
    this.isProcessing.set(false);
    this.errorMessage.set(null);
  }

  // ─── Main indexing flow ───
  async startIndexing(): Promise<void> {
    const files = this.uploadedFiles();
    if (files.length === 0 || this.isProcessing()) return;

    this.isProcessing.set(true);
    this.isReady.set(false);
    this.errorMessage.set(null);

    const sessionId = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);

    try {
      const allChunks: Array<{ content: string; metadata: any }>[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Step 1 — Extract text
        this.progressMessage.set(`Extracting text from ${file.name} (${i + 1}/${files.length})...`);
        const pageChunks = await this.documentService.extractDocumentChunksWithPages(file);

        if (pageChunks.length === 0) {
          throw new Error(`No text found in "${file.name}". It may be a scanned image.`);
        }

        // Step 2 — Build chunks with metadata
        this.progressMessage.set(`Preparing chunks for ${file.name}...`);
        const fileId = crypto.randomUUID?.() ?? `${Date.now()}-${i}`;
        const entries: { content: string; metadata: any }[] = [];

        for (let j = 0; j < pageChunks.length; j++) {
          const chunk = pageChunks[j];
          entries.push({
            content: chunk.content,
            metadata: {
              documentId: fileId,
              fileName: file.name,
              documentType: 'pdf',
              sessionId,
              chunkIndex: j,
              pageNumber: chunk.pageNumber ?? null,
            },
          });
        }

        allChunks.push(entries);
      }

      // Step 3 — Store all chunks with embeddings
      const flattened = allChunks.flat();
      this.progressMessage.set(
        `Indexing ${flattened.length} chunks across ${files.length} document(s)...`
      );
      await this.embeddingService.storeChunksWithMetadata(flattened, sessionId);

      // Step 4 — Done
      this.progressMessage.set(`✓ ${files.length} document(s) indexed successfully.`);
      this.isProcessing.set(false);
      this.documentReady.emit({ sessionId, files });

    } catch (error: any) {
      this.isProcessing.set(false);
      this.isReady.set(true);

      // Friendly quota exceeded message
      if (
        error?.message?.includes('quota') ||
        error?.message?.includes('429') ||
        error?.message?.includes('RESOURCE_EXHAUSTED') ||
        error?.message?.includes('daily')
      ) {
        this.errorMessage.set('quota_exceeded');
      } else {
        this.errorMessage.set(error?.message ?? 'Something went wrong. Please try again.');
      }
    }
  }
}