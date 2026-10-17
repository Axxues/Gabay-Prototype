import { describe, it, expect } from 'vitest';
import {
  DEFAULT_COLLEGES,
  DEFAULT_DEPARTMENTS,
  getColleges,
  getDepartmentsByCollege,
  getCollegeById,
  getDepartmentByName
} from './collegesData';

describe('Colleges & Departments Data Store', () => {
  it('contains initial university colleges', () => {
    const colleges = getColleges();
    expect(colleges.length).toBeGreaterThanOrEqual(1);
    expect(colleges.some(c => c.code === 'CCS')).toBe(true);
  });

  it('retrieves departments belonging to a specific college', () => {
    const ccsDepts = getDepartmentsByCollege('col-ccs');
    expect(ccsDepts.length).toBeGreaterThanOrEqual(1);
    expect(ccsDepts.some(d => d.name === 'Department of Computer Science')).toBe(true);
  });

  it('retrieves a college by ID and department by name', () => {
    const ccs = getCollegeById('col-ccs');
    expect(ccs?.name).toBe('College of Computer Science');
    const csDept = getDepartmentByName('Department of Computer Science');
    expect(csDept?.code).toBe('CS');
  });

  it('provides all expected colleges and departments in default data sets', () => {
    expect(DEFAULT_COLLEGES.length).toBe(1);
    expect(DEFAULT_COLLEGES[0].name).toBe('College of Computer Science');

    expect(DEFAULT_DEPARTMENTS.length).toBe(1);
    expect(DEFAULT_DEPARTMENTS[0].name).toBe('Department of Computer Science');
    expect(DEFAULT_DEPARTMENTS[0].code).toBe('CS');
  });

  it('handles safety fallbacks for missing or invalid college queries', () => {
    expect(getCollegeById('non-existent')).toBeUndefined();
    expect(getCollegeById('')).toBeUndefined();
    expect(getDepartmentsByCollege('non-existent')).toEqual([]);
    expect(getDepartmentsByCollege('')).toEqual([]);
    expect(getDepartmentByName('non-existent')).toBeUndefined();
    expect(getDepartmentByName('')).toBeUndefined();
  });

  it('supports lookup by code or shorthand as a fallback', () => {
    const ccsByCode = getCollegeById('CCS');
    expect(ccsByCode?.id).toBe('col-ccs');

    const csDept = getDepartmentByName('CS');
    expect(csDept?.name).toBe('Department of Computer Science');

    const deptsByCode = getDepartmentsByCollege('CCS');
    expect(deptsByCode.length).toBe(1);
  });

  it('allows passing custom colleges and departments lists to accessors', () => {
    const customColleges = [{ id: 'col-custom', name: 'Custom College', code: 'CC' }];
    const customDepartments = [{ id: 'dept-custom', collegeId: 'col-custom', name: 'Custom Dept', code: 'CD' }];

    expect(getColleges(customColleges)).toEqual(customColleges);
    expect(getCollegeById('col-custom', customColleges)?.name).toBe('Custom College');
    expect(getDepartmentsByCollege('col-custom', customDepartments)).toEqual(customDepartments);
    expect(getDepartmentByName('Custom Dept', customDepartments)?.code).toBe('CD');
  });
});
