import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DocumentStatusComponent } from './document-status.component';

describe('DocumentStatusComponent', () => {
  let component: DocumentStatusComponent;
  let fixture: ComponentFixture<DocumentStatusComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DocumentStatusComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DocumentStatusComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
