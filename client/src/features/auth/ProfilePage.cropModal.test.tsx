// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const mockUpdateUser = vi.fn(async () => true);
const mockShowConfirm = vi.fn((_msg: string, onConfirm: () => void) => {
  onConfirm();
});
const mockUploadFileToPublic = vi.fn(async () => ({
  name: 'test.jpg',
  size: '100 KB',
  url: 'https://gabay.zyberlab.com/assets/12345678-1234-1234-1234-123456789abc',
  fileId: '12345678-1234-1234-1234-123456789abc',
}));

let currentActiveUser = {
  id: 'u-crop-test',
  name: 'Crop Tester',
  email: 'croptest@dmmmsu.edu.ph',
  role: 'student',
  avatar: '',
  banner: '',
};

vi.mock('../../shared/context/LMSContext', () => ({
  useLMS: () => ({
    activeUser: currentActiveUser,
    activeRole: 'student',
    db: { courses: [] },
    logout: vi.fn(),
    showConfirm: mockShowConfirm,
    showAlert: vi.fn(),
    updateUser: mockUpdateUser,
    accent: 'emerald',
    customAccentHex: '',
    setAccent: vi.fn(),
    setCustomAccentHex: vi.fn(),
    resetAccent: vi.fn(),
    theme: 'light',
    toggleTheme: vi.fn(),
  }),
  ACCENT_PRESETS: [],
}));

vi.mock('../../shared/utils/fileUploader', () => ({
  uploadFileToPublic: (...args: any[]) => mockUploadFileToPublic(...args),
}));

import { ProfilePage } from './ProfilePage';

describe('ProfilePage image crop modal trigger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('selecting an avatar file opens the arrange modal before saving', async () => {
    render(<ProfilePage />);

    // Find avatar file input (only file input on the page)
    const avatarInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(avatarInput).toBeDefined();

    const file = new File(['mock content'], 'my-photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(avatarInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('Arrange Profile Picture')).toBeInTheDocument();
    });

    expect(mockUploadFileToPublic).not.toHaveBeenCalled();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  test('banner upload and remove elements are completely removed from profile page', () => {
    render(<ProfilePage />);

    expect(screen.queryByTitle('Upload banner')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Change banner')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Remove banner')).not.toBeInTheDocument();
    expect(document.querySelectorAll('input[type="file"]').length).toBe(1);
  });

  test('clicking remove profile photo button triggers confirmation modal', async () => {
    currentActiveUser = {
      ...currentActiveUser,
      avatar: 'https://gabay.zyberlab.com/assets/12345678-1234-1234-1234-123456789abc',
    };
    render(<ProfilePage />);

    const removeBtn = screen.getByTitle('Remove profile photo');
    expect(removeBtn).toBeInTheDocument();

    fireEvent.click(removeBtn);

    expect(mockShowConfirm).toHaveBeenCalledWith(
      expect.stringContaining('Are you sure you want to remove your profile picture?'),
      expect.any(Function),
      'Remove Photo'
    );
    expect(mockUpdateUser).toHaveBeenCalledWith('u-crop-test', { avatar: '' });
  });
});
