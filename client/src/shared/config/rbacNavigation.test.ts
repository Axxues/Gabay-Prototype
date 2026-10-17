import { describe, it, expect } from 'vitest';
import { MAIN_NAV, isVisible, ALL, canAccessAccountManagement } from './navigation';
import { TAB_PATHS, pathToTab } from './routes';

describe('RBAC Navigation Permissions', () => {
  it('allows superadmin and admin to view Manage College Accounts', () => {
    const accountsItem = MAIN_NAV.find(i => i.id === 'accounts');
    expect(accountsItem).toBeDefined();
    expect(isVisible(accountsItem!, 'superadmin')).toBe(true);
    expect(isVisible(accountsItem!, 'admin')).toBe(true);
  });

  it('places Academic Governance immediately above Manage College Accounts in MAIN_NAV', () => {
    const governanceIndex = MAIN_NAV.findIndex(i => i.id === 'governance');
    const accountsIndex = MAIN_NAV.findIndex(i => i.id === 'accounts');
    expect(governanceIndex).toBeGreaterThan(-1);
    expect(accountsIndex).toBeGreaterThan(-1);
    expect(governanceIndex).toBe(accountsIndex - 1);

    const governanceItem = MAIN_NAV[governanceIndex];
    expect(governanceItem.label).toBe('Academic Governance');
    expect(governanceItem.icon).toBe('governance');
    expect(isVisible(governanceItem, 'superadmin')).toBe(true);
    expect(isVisible(governanceItem, 'admin')).toBe(true);
    expect(isVisible(governanceItem, 'faculty')).toBe(false);
    expect(isVisible(governanceItem, 'staff')).toBe(false);
    expect(isVisible(governanceItem, 'student')).toBe(false);
  });

  it('hides Manage College Accounts from regular faculty, staff, and students', () => {
    const accountsItem = MAIN_NAV.find(i => i.id === 'accounts');
    expect(isVisible(accountsItem!, 'faculty')).toBe(false);
    expect(isVisible(accountsItem!, 'staff')).toBe(false);
    expect(isVisible(accountsItem!, 'student')).toBe(false);
  });

  it('ensures faculty teaching tabs remain visible to admin (dual role)', () => {
    const coursesItem = MAIN_NAV.find(i => i.id === 'lms');
    expect(isVisible(coursesItem!, 'admin')).toBe(true);
    expect(isVisible(coursesItem!, 'superadmin')).toBe(true);
  });

  it('canAccessAccountManagement allows admin and superadmin, denies others', () => {
    expect(canAccessAccountManagement('superadmin')).toBe(true);
    expect(canAccessAccountManagement('admin')).toBe(true);
    expect(canAccessAccountManagement('faculty')).toBe(false);
    expect(canAccessAccountManagement('staff')).toBe(false);
    expect(canAccessAccountManagement('student')).toBe(false);
  });

  it('maps register and activate public routes correctly', () => {
    expect(TAB_PATHS['register']).toBe('/register');
    expect(TAB_PATHS['activate']).toBe('/activate');
    expect(pathToTab('/register')).toEqual({ tab: 'register' });
    expect(pathToTab('/activate')).toEqual({ tab: 'activate' });
  });

  it('maps governance route correctly', () => {
    expect(TAB_PATHS['governance']).toBe('/governance');
    expect(pathToTab('/governance')).toEqual({ tab: 'governance' });
  });
});
