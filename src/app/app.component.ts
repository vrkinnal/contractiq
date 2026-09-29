import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatComponent } from './chat/chat.component';
import { UploadComponent } from './upload/upload.component';
import { HeaderComponent } from './shared/header.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, HeaderComponent, UploadComponent, ChatComponent],
  template: `
    <app-header
      [section]="currentScreen()"
      [documentName]="uploadedDocument()"
      (back)="currentScreen.set('upload')">
    </app-header>

    <main class="px-4 py-6">
      <app-upload
        *ngIf="currentScreen() === 'upload'"
        (documentReady)="onDocumentReady($event)">
      </app-upload>

      <app-chat
        *ngIf="currentScreen() === 'chat'"
        [document]="uploadedDocument()">
      </app-chat>
    </main>
  `,
})
export class App {
  currentScreen = signal<'upload' | 'chat'>('upload');
  uploadedDocument = signal<any>(null);

  onDocumentReady(payload: any): void {
    this.uploadedDocument.set(payload);
    this.currentScreen.set('chat');
  }
}