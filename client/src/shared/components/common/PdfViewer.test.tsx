// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { PdfViewer } from './PdfViewer';

describe('PdfViewer Client-Side Canvas Renderer', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders the canvas and controls without any iframe, embed, or object elements', async () => {
    render(
      <PdfViewer
        url="data:application/pdf;base64,JVBERi0xLjQK"
        title="Sample_Lecture.pdf"
      />
    );

    // Assert that no bare binary embedding tags exist
    expect(document.querySelector('iframe')).toBeNull();
    expect(document.querySelector('embed')).toBeNull();
    expect(document.querySelector('object')).toBeNull();

    // Assert client-side viewer container and canvas are rendered
    const viewer = screen.getByTestId('pdf-canvas-viewer');
    expect(viewer).toBeInTheDocument();
    expect(screen.getByTestId('pdf-canvas')).toBeInTheDocument();
    expect(screen.getByText('Sample_Lecture.pdf')).toBeInTheDocument();
  });

  it('provides zoom in, zoom out, and reset zoom controls', async () => {
    render(
      <PdfViewer
        url="data:application/pdf;base64,JVBERi0xLjQK"
        title="Test Doc"
        initialScale={1.0}
      />
    );

    // Initial scale is 100%
    expect(screen.getByText('100%')).toBeInTheDocument();

    // Zoom In
    const zoomInBtn = screen.getByLabelText('Zoom In');
    fireEvent.click(zoomInBtn);
    expect(screen.getByText('120%')).toBeInTheDocument();

    // Zoom In again
    fireEvent.click(zoomInBtn);
    expect(screen.getByText('140%')).toBeInTheDocument();

    // Zoom Out
    const zoomOutBtn = screen.getByLabelText('Zoom Out');
    fireEvent.click(zoomOutBtn);
    expect(screen.getByText('120%')).toBeInTheDocument();

    // Reset Zoom
    const resetBtn = screen.getByLabelText('Reset Zoom');
    fireEvent.click(resetBtn);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('renders download link pointing directly to the file source', () => {
    const fileUrl = 'https://example.com/handout.pdf';
    render(<PdfViewer url={fileUrl} title="handout.pdf" />);

    const downloadLink = screen.getByLabelText('Download Document');
    expect(downloadLink).toBeInTheDocument();
    expect(downloadLink).toHaveAttribute('href', fileUrl);
    expect(downloadLink).toHaveAttribute('download', 'handout.pdf');
    expect(downloadLink).toHaveAttribute('target', '_blank');
  });

  it('displays a graceful fallback when given an empty url or invalid document', async () => {
    render(<PdfViewer url="" title="Empty Document" />);

    expect(screen.getByText('Client-Side Render Notice')).toBeInTheDocument();
    expect(screen.getByText('No PDF URL provided.')).toBeInTheDocument();
    expect(document.querySelector('iframe')).toBeNull();
  });
});
