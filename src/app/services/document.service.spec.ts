import { TestBed } from '@angular/core/testing';
import { DocumentService } from './document.service';

describe('DocumentService', () => {
  let service: DocumentService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DocumentService],
    });

    service = TestBed.inject(DocumentService);
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  it('should split text into 500-word chunks with 50-word overlap', () => {
    const text = Array.from({ length: 620 }, (_, index) => `word${index + 1}`).join(' ');
    const chunks = service.createTextChunks(text);

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].split(/\s+/).length).toBeLessThanOrEqual(500);
    expect(chunks[1].split(/\s+/).length).toBeLessThanOrEqual(500);
  });
});
