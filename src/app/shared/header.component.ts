import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-header',
  standalone: true,
  templateUrl: './header.component.html',
})
export class HeaderComponent {
  readonly section = input<'upload' | 'chat'>('upload');
  readonly documentName = input<File | string | null>(null);
  readonly back = output<void>();

  onBackClick(): void {
    this.back.emit();
  }
}
