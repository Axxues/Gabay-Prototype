import { describe, it, expect } from 'vitest';
import {
  DEFAULT_COLLEGES,
  DEFAULT_DEPARTMENTS,
  getColleges,
  getDepartmentsByCollege,
  getCollegeById,
  getDepartmentByName,
  generateAutomaticSchoolYears,
  DEFAULT_SCHOOL_YEARS,
  getUserCollege,
  getUserCollegeCode,
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
    expect(ccsDepts.some(d => d.name === 'Computer Science')).toBe(true);
  });

  it('retrieves a college by ID and department by name', () => {
    const ccs = getCollegeById('col-ccs');
    expect(ccs?.name).toBe('College of Computer Science');
    const csDept = getDepartmentByName('Department of Computer Science');
    expect(csDept?.code).toBe('CS');
    expect(csDept?.name).toBe('Computer Science');
  });

  it('provides all expected colleges and departments in default data sets', () => {
    expect(DEFAULT_COLLEGES.length).toBe(1);
    expect(DEFAULT_COLLEGES[0].name).toBe('College of Computer Science');

    expect(DEFAULT_DEPARTMENTS.length).toBe(1);
    expect(DEFAULT_DEPARTMENTS[0].name).toBe('Computer Science');
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
    expect(csDept?.name).toBe('Computer Science');

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

  it('generates automatic school years with 5 years in advance', () => {
    const schoolYears = generateAutomaticSchoolYears(2025, 5);
    expect(schoolYears.length).toBeGreaterThanOrEqual(6);
    expect(schoolYears[0].year).toBe('2025-2026');
    expect(schoolYears.some(sy => sy.year === '2025-2026' && sy.isActive)).toBe(true);

    // Verify DEFAULT_SCHOOL_YEARS is populated with generated years
    expect(DEFAULT_SCHOOL_YEARS.length).toBeGreaterThanOrEqual(6);
    expect(DEFAULT_SCHOOL_YEARS[0].id).toContain('sy-univ-');
  });

  describe('getUserCollege & getUserCollegeCode', () => {
    const colleges = [
      { id: 'col-ccs', name: 'College of Computer Science', code: 'CCS', deanId: 'dean-1' },
      { id: 'col-coe', name: 'College of Education', code: 'COED', deanId: 'dean-coe' },
    ];
    const departments = [
      { id: 'dept-cs', collegeId: 'col-ccs', name: 'Computer Science', code: 'CS' },
      { id: 'dept-elem', collegeId: 'col-coe', name: 'Elementary Education', code: 'ELED' },
    ];

    it('resolves college by collegeId or collegeCode', () => {
      expect(getUserCollegeCode({ collegeId: 'col-ccs' }, colleges, departments)).toBe('CCS');
      expect(getUserCollegeCode({ collegeCode: 'COED' }, colleges, departments)).toBe('COED');
      expect(getUserCollegeCode({ collegeId: 'col-coe' }, colleges, departments)).toBe('COED');
    });

    it('resolves college by deanId', () => {
      expect(getUserCollegeCode({ id: 'dean-1' }, colleges, departments)).toBe('CCS');
      expect(getUserCollegeCode({ id: 'dean-coe' }, colleges, departments)).toBe('COED');
    });

    it('resolves college by collegeName or partial keyword', () => {
      expect(getUserCollegeCode({ collegeName: 'College of Computer Science' }, colleges, departments)).toBe('CCS');
      expect(getUserCollegeCode({ collegeName: 'Education' }, colleges, departments)).toBe('COED');
    });

    it('resolves college by department name', () => {
      expect(getUserCollegeCode({ department: 'Computer Science' }, colleges, departments)).toBe('CCS');
      expect(getUserCollegeCode({ department: 'Program in Computer Science' }, colleges, departments)).toBe('CCS');
      expect(getUserCollegeCode({ department: 'Elementary Education' }, colleges, departments)).toBe('COED');
    });

    it('returns undefined for users with no college affiliation', () => {
      expect(getUserCollegeCode(null)).toBeUndefined();
      expect(getUserCollegeCode({})).toBeUndefined();
      expect(getUserCollegeCode({ department: 'Office of the Chancellor' }, colleges, departments)).toBeUndefined();
    });
  });
});
