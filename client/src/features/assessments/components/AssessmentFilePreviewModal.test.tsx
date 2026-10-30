import React from 'react';
import { describe, expect, test, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AssessmentFilePreviewModal } from './AssessmentFilePreviewModal';

vi.mock('../../../shared/components/common/ModalPortal', () => ({
  ModalPortal: ({ children }: { children: React.ReactNode }) => <div data-testid="modal-portal">{children}</div>
}));

vi.mock('../../../shared/components/common/PdfViewer', () => ({
  PdfViewer: ({ title, url }: { title?: string; url?: string }) => (
    <div data-testid="pdf-viewer" data-url={url}>{title}</div>
  )
}));

describe('AssessmentFilePreviewModal', () => {
  test('returns null when file is null', () => {
    const { container } = render(
      <AssessmentFilePreviewModal file={null} onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  test('renders image preview for image attachments', () => {
    const onClose = vi.fn();
    render(
      <AssessmentFilePreviewModal
        file={{
          name: 'Diagram.png',
          size: '176.9 KB',
          url: '/likha/assets/diagram-uuid',
          type: 'image/png'
        }}
        onClose={onClose}
      />
    );

    expect(screen.getByText('Diagram.png')).toBeInTheDocument();
    expect(screen.getByText('Image')).toBeInTheDocument();
    expect(screen.getByText('176.9 KB')).toBeInTheDocument();

    const img = screen.getByRole('img', { name: 'Diagram.png' });
    expect(img).toBeInTheDocument();
    expect(img.getAttribute('src')).toContain('/assets/diagram-uuid');
  });

  test('renders PdfViewer for pdf attachments', () => {
    const onClose = vi.fn();
    render(
      <AssessmentFilePreviewModal
        file={{
          name: 'Handout.pdf',
          size: '1.2 MB',
          url: '/likha/assets/handout-uuid',
          type: 'application/pdf'
        }}
        onClose={onClose}
      />
    );

    expect(screen.getAllByText('Handout.pdf').length).toBeGreaterThan(0);
    expect(screen.getByText('PDF Document')).toBeInTheDocument();
    expect(screen.getByTestId('pdf-viewer')).toBeInTheDocument();
  });

  test('renders document inspection card for docx attachments with download and open options', () => {
    const onClose = vi.fn();
    render(
      <AssessmentFilePreviewModal
        file={{
          name: 'ThesisManuscript-AntiCheating.docx',
          size: '3.8 MB',
          url: '/likha/assets/thesis-uuid',
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        }}
        onClose={onClose}
      />
    );

    expect(screen.getAllByText('ThesisManuscript-AntiCheating.docx').length).toBeGreaterThan(0);
    expect(screen.getByText('Microsoft Word Document')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Download ThesisManuscript-AntiCheating\.docx/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open in Browser/i })).toBeInTheDocument();
  });

  test('invokes onClose when clicking close button or pressing Escape', () => {
    const onClose = vi.fn();
    render(
      <AssessmentFilePreviewModal
        file={{
          name: 'Sample.pdf',
          url: '/likha/assets/sample-uuid'
        }}
        onClose={onClose}
      />
    );

    const closeBtn = screen.getByTitle('Close viewer');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  test('renders sandboxed iframe for HTML attachments without allow-same-origin', () => {
    const onClose = vi.fn();
    render(
      <AssessmentFilePreviewModal
        file={{
          name: 'report.html',
          url: 'https://gabay.zyberlab.com/assets/report.html',
          type: 'text/html'
        }}
        onClose={onClose}
      />
    );

    const iframe = screen.getByTestId('sandboxed-html-frame');
    expect(iframe).toBeInTheDocument();
    expect(iframe.tagName.toLowerCase()).toBe('iframe');
    expect(iframe.getAttribute('title')).toBe('report.html');
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts');
    expect(iframe.getAttribute('sandbox')).not.toContain('allow-same-origin');
  });

  test('blocks dangerous javascript: URLs from being rendered as links', () => {
    const onClose = vi.fn();
    render(
      <AssessmentFilePreviewModal
        file={{
          name: 'sketchy.docx',
          url: 'javascript:alert(document.cookie)'
        }}
        onClose={onClose}
      />
    );

    // Malicious link must not be rendered as a functional download/external link
    expect(screen.queryByRole('link', { name: /Download sketchy\.docx/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /Open in Browser/i })).toBeNull();
  });
});
