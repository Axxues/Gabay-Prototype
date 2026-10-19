import { describe, it, expect } from 'vitest';
import { isLmsSectionTab } from './navigation';

describe('standalone page navigation', () => {
  it('hides the Learning Management navigation on the profile, history, and help pages', () => {
    expect(isLmsSectionTab('profile')).toBe(false);
    expect(isLmsSectionTab('history')).toBe(false);
    expect(isLmsSectionTab('help')).toBe(false);
  });

  it('still shows the Learning Management navigation on the LMS tabs', () => {
    expect(isLmsSectionTab('dashboard')).toBe(true);
    expect(isLmsSectionTab('courses')).toBe(true);
    expect(isLmsSectionTab('calendar')).toBe(true);
    expect(isLmsSectionTab('inbox')).toBe(true);
  });

  it('keeps the existing exclusions intact', () => {
    expect(isLmsSectionTab('gabay-rag')).toBe(false);
    expect(isLmsSectionTab('page1')).toBe(false);
    expect(isLmsSectionTab('page2')).toBe(false);
    expect(isLmsSectionTab('page3')).toBe(false);
    expect(isLmsSectionTab('governance')).toBe(false);
    expect(isLmsSectionTab('accounts')).toBe(false);
    expect(isLmsSectionTab('create-account')).toBe(false);
    expect(isLmsSectionTab('edit-account')).toBe(false);
  });

  it('hides the Learning Management navigation on the Create Leadership Account page', () => {
    expect(isLmsSectionTab('create-leadership')).toBe(false);
  });
});
