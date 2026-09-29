import { TestBed } from '@angular/core/testing';
import { EmbeddingService } from './embedding.service';

describe('EmbeddingService', () => {
  let service: EmbeddingService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [EmbeddingService],
    });

    service = TestBed.inject(EmbeddingService);
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });
});
