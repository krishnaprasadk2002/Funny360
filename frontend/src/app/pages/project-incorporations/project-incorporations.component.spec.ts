import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectIncorporationsComponent } from './project-incorporations.component';

describe('ProjectIncorporationsComponent', () => {
  let component: ProjectIncorporationsComponent;
  let fixture: ComponentFixture<ProjectIncorporationsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectIncorporationsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProjectIncorporationsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
