import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { InputComponent } from './input.component';
import { AnalysisService } from '../../core/analysis.service';
import { SessionService } from '../../core/session.service';
import { SessionStatus } from '@smart-backlog/shared';

const MOCK_SESSION_STATE = {
  status$: new BehaviorSubject(SessionStatus.Idle),
  stories$: new BehaviorSubject([]),
  requirementsSummary$: new BehaviorSubject(null),
  analysisError$: new BehaviorSubject(null),
  startAnalysis: jest.fn(),
};

describe('InputComponent', () => {
  let fixture: ComponentFixture<InputComponent>;
  let component: InputComponent;
  let mockAnalysis: { startAnalysis: jest.Mock };
  let router: Router;

  beforeEach(async () => {
    mockAnalysis = { startAnalysis: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [InputComponent, RouterTestingModule],
      providers: [
        { provide: AnalysisService, useValue: mockAnalysis },
        { provide: SessionService, useValue: MOCK_SESSION_STATE },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InputComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  describe('mode switching', () => {
    it('defaults to text mode', () => {
      expect(component.inputMode).toBe('text');
    });

    it('switches to pdf mode', () => {
      component.setMode('pdf');
      expect(component.inputMode).toBe('pdf');
    });

    it('clears pdfError when switching modes', () => {
      component.pdfError = 'some error';
      component.setMode('text');
      expect(component.pdfError).toBeNull();
    });
  });

  describe('canSubmit', () => {
    it('returns false when text mode and textContent is empty', () => {
      component.inputMode = 'text';
      component.textContent = '';
      expect(component.canSubmit).toBe(false);
    });

    it('returns true when text mode and textContent has content', () => {
      component.inputMode = 'text';
      component.textContent = 'some requirements';
      expect(component.canSubmit).toBe(true);
    });

    it('returns false in pdf mode with no file selected', () => {
      component.inputMode = 'pdf';
      component.pdfFile = null;
      expect(component.canSubmit).toBe(false);
    });

    it('returns true in pdf mode with a valid file', () => {
      component.inputMode = 'pdf';
      component.pdfFile = new File(['content'], 'spec.pdf', { type: 'application/pdf' });
      expect(component.canSubmit).toBe(true);
    });

    it('returns false in pdf mode when pdfError is set', () => {
      component.inputMode = 'pdf';
      component.pdfFile = new File(['x'], 'big.pdf');
      component.pdfError = 'File too large';
      expect(component.canSubmit).toBe(false);
    });
  });

  describe('onPdfSelected', () => {
    const makePdfEvent = (size: number): Event => {
      const file = new File([new ArrayBuffer(size)], 'test.pdf', { type: 'application/pdf' });
      return { target: { files: [file], value: '' } } as unknown as Event;
    };

    it('accepts a file within size limit', () => {
      const event = makePdfEvent(100);
      component.onPdfSelected(event);
      expect(component.pdfFile).not.toBeNull();
      expect(component.pdfError).toBeNull();
    });

    it('rejects a file over 10 MB and sets pdfError', () => {
      const event = makePdfEvent(11 * 1024 * 1024);
      component.onPdfSelected(event);
      expect(component.pdfFile).toBeNull();
      expect(component.pdfError).toContain('10 MB');
    });
  });

  describe('onBacklogSelected', () => {
    it('stores the selected backlog file', () => {
      const file = new File(['[]'], 'backlog.json', { type: 'application/json' });
      const event = { target: { files: [file] } } as unknown as Event;
      component.onBacklogSelected(event);
      expect(component.backlogFile).toBe(file);
    });
  });

  describe('onSubmit', () => {
    it('does nothing when canSubmit is false', () => {
      component.inputMode = 'text';
      component.textContent = '';
      component.onSubmit();
      expect(mockAnalysis.startAnalysis).not.toHaveBeenCalled();
    });

    it('calls startAnalysis with FormData for text mode and navigates to /analysis', () => {
      const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);
      component.inputMode = 'text';
      component.textContent = 'user requirements';
      component.onSubmit();

      expect(mockAnalysis.startAnalysis).toHaveBeenCalledTimes(1);
      const formData: FormData = mockAnalysis.startAnalysis.mock.calls[0][0] as FormData;
      expect(formData.get('inputType')).toBe('text');
      expect(formData.get('textContent')).toBe('user requirements');
      expect(navigateSpy).toHaveBeenCalledWith(['/analysis']);
    });

    it('appends pdfFile to FormData in pdf mode', () => {
      const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);
      component.inputMode = 'pdf';
      const file = new File(['pdf bytes'], 'spec.pdf');
      component.pdfFile = file;
      component.onSubmit();

      const formData: FormData = mockAnalysis.startAnalysis.mock.calls[0][0] as FormData;
      expect(formData.get('inputType')).toBe('pdf');
      expect(formData.get('pdfFile')).toBe(file);
      expect(navigateSpy).toHaveBeenCalledWith(['/analysis']);
    });

    it('appends backlogJson when backlogFile is set', () => {
      jest.spyOn(router, 'navigate').mockResolvedValue(true);
      component.inputMode = 'text';
      component.textContent = 'reqs';
      const backlog = new File(['[]'], 'backlog.json');
      component.backlogFile = backlog;
      component.onSubmit();

      const formData: FormData = mockAnalysis.startAnalysis.mock.calls[0][0] as FormData;
      expect(formData.get('backlogJson')).toBe(backlog);
    });
  });
});
