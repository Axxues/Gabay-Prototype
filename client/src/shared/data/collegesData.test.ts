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
    expect(colleges.length).toBeGreaterThanOrEqual(2);
    expect(colleges.some(c => c.code === 'CCS')).toBe(true);
  });

  it('retrieves departments belonging to a specific college', () => {
    const ccsDepts = getDepartmentsByCollege('col-ccs');
    expect(ccsDepts.length).toBeGreaterThanOrEqual(3);
    expect(ccsDepts.some(d => d.name === 'Department of Computer Science')).toBe(true);
    expect(ccsDepts.some(d => d.name === 'Department of Information Technology')).toBe(true);
  });

  it('retrieves a college by ID and department by name', () => {
    const ccs = getCollegeById('col-ccs');
    expect(ccs?.name).toBe('College of Computer Science');
    const csDept = getDepartmentByName('Department of Computer Science');
    expect(csDept?.code).toBe('CS');
  });

  it('provides all expected colleges and departments in default data sets', () => {
    expect(DEFAULT_COLLEGES.length).toBe(3);
    expect(DEFAULT_COLLEGES.map(c => c.name)).toContain('College of Computer Science');
    expect(DEFAULT_COLLEGES.map(c => c.name)).toContain('College of Education');
    expect(DEFAULT_COLLEGES.map(c => c.name)).toContain('College of Engineering');

    expect(DEFAULT_DEPARTMENTS.length).toBe(7);
    const deptCodes = DEFAULT_DEPARTMENTS.map(d => d.code);
    expect(deptCodes).toEqual(expect.arrayContaining(['CS', 'IT', 'IS', 'ELED', 'SED', 'CE', 'EE']));
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

    const itDept = getDepartmentByName('IT');
    expect(itDept?.name).toBe('Department of Information Technology');

    const deptsByCode = getDepartmentsByCollege('CCS');
    expect(deptsByCode.length).toBe(3);
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
