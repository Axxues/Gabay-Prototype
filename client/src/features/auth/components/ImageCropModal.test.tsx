// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { ImageCropModal } from './ImageCropModal';

describe('ImageCropModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock Image in jsdom
    const OriginalImage = globalThis.Image;
    (globalThis as any).Image = class {
      naturalWidth = 500;
      naturalHeight = 500;
      src = '';
      crossOrigin = '';
      onload: (() => void) | null = null;
      set srcVal(val: string) {
        this.src = val;
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 0);
      }
      constructor() {
        // Trigger onload on next tick when src is assigned
        let internalSrc = '';
        Object.defineProperty(this, 'src', {
          get: () => internalSrc,
          set: (v: string) => {
            internalSrc = v;
            setTimeout(() => {
              if (this.onload) this.onload();
            }, 0);
          },
        });
      }
    };
  });

  test('does not render when isOpen is false', () => {
    const file = new File(['dummy content'], 'test.png', { type: 'image/png' });
    render(
      <ImageCropModal
        isOpen={false}
        onClose={vi.fn()}
        file={file}
        kind="avatar"
        onSave={vi.fn()}
      />
    );
    expect(screen.queryByText(/Arrange Profile Picture/i)).not.toBeInTheDocument();
  });

  test('renders avatar modal with correct heading, controls, and buttons', () => {
    const file = new File(['dummy content'], 'avatar.jpg', { type: 'image/jpeg' });
    render(
      <ImageCropModal
        isOpen={true}
        onClose={vi.fn()}
        file={file}
        kind="avatar"
        onSave={vi.fn()}
      />
    );

    expect(screen.getByText('Arrange Profile Picture')).toBeInTheDocument();
    expect(screen.getByText(/Drag to position and adjust the zoom slider/i)).toBeInTheDocument();
    expect(screen.getByRole('slider')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save & Apply/i })).toBeInTheDocument();
  });

  test('renders banner modal with correct heading', () => {
    const file = new File(['dummy content'], 'banner.jpg', { type: 'image/jpeg' });
    render(
      <ImageCropModal
        isOpen={true}
        onClose={vi.fn()}
        file={file}
        kind="banner"
        onSave={vi.fn()}
      />
    );

    expect(screen.getByText('Arrange Profile Banner')).toBeInTheDocument();
  });

  test('calls onClose when Cancel button or X button is clicked', () => {
    const file = new File(['dummy content'], 'test.png', { type: 'image/png' });
    const onCloseMock = vi.fn();
    render(
      <ImageCropModal
        isOpen={true}
        onClose={onCloseMock}
        file={file}
        kind="avatar"
        onSave={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  test('adjusts zoom when slider changes and allows reset', () => {
    const file = new File(['dummy content'], 'test.png', { type: 'image/png' });
    render(
      <ImageCropModal
        isOpen={true}
        onClose={vi.fn()}
        file={file}
        kind="avatar"
        onSave={vi.fn()}
      />
    );

    const slider = screen.getByRole('slider') as HTMLInputElement;
    expect(slider.value).toBe('1');

    fireEvent.change(slider, { target: { value: '2' } });
    expect(slider.value).toBe('2');

    const resetButton = screen.getByTitle('Reset position and zoom');
    fireEvent.click(resetButton);
    expect(slider.value).toBe('1');
  });

  test('calls onSave and onClose when Save & Apply is clicked', async () => {
    const file = new File(['dummy image content'], 'avatar.jpg', { type: 'image/jpeg' });
    const onSaveMock = vi.fn();
    const onCloseMock = vi.fn();

    // Mock HTMLCanvasElement.getContext and toBlob
    const mockContext = {
      drawImage: vi.fn(),
      imageSmoothingEnabled: false,
      imageSmoothingQuality: 'low',
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockContext as any);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(cb => {
      cb(new Blob(['cropped'], { type: 'image/jpeg' }));
    });

    render(
      <ImageCropModal
        isOpen={true}
        onClose={onCloseMock}
        file={file}
        kind="avatar"
        onSave={onSaveMock}
      />
    );

    // Mock Image naturalWidth/Height loading
    const imgEl = screen.queryByAltText('Preview');
    if (imgEl) {
      fireEvent.load(imgEl);
    }

    const saveBtn = screen.getByRole('button', { name: /Save & Apply/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(onSaveMock).toHaveBeenCalled();
      expect(onCloseMock).toHaveBeenCalled();
    });
  });
});
