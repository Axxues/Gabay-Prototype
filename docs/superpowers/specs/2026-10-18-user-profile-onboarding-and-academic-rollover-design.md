# User Profile Onboarding and Academic Rollover Design

## Context & Problem Statement
Currently in Gabay LMS:
- When newly approved students and faculty/staff log in, they land on `/dashboard` with minimal profile data.
- User profile data is missing key institutional records needed for academic affairs:
  - Students need birthday, permanent & present address (with same-as toggle), contact number, normalized parent/guardian info, and a trackable year level (1-4).
  - Faculty/Staff need address, contact number, birthday, years of teaching experience, and structured educational background (degree levels, institutions, graduation years, specializations).
- School year rollover does not currently update student year progression or faculty teaching tenure.

## Core Requirements

### 1. First-Login & Incomplete Profile Navigation Flow
- When an authenticated user logs in (or visits the portal) and their role-specific required profile fields are incomplete:
  - They are initially routed to the User Profile page (`/profile`).
  - A persistent, prominent notification banner appears across the portal:
    *"Please complete your profile information to ensure your academic and institutional records are up to date."* with a direct action button to `/profile`.
  - The user can still navigate to other pages (dashboard, courses, inbox, etc.), but the banner persists on every page until the profile is complete.

### 2. Student Profile Requirements
- **Birthday**: Date picker / input (`YYYY-MM-DD`).
- **Address**:
  - `permanentAddress` (required string).
  - `sameAsPermanentAddress` checkbox: "Present address is the same as permanent address".
  - `presentAddress`: If `sameAsPermanentAddress` is true, automatically matches `permanentAddress` and is read-only/disabled; if false, user types their present address.
- **Contact Number**: Student phone number.
- **Parent / Guardian Details**:
  - Toggle / radio: "Parents (Mother & Father)" vs "Guardian".
  - If Parents:
    - Mother: First Name, Middle Name, Last Name.
    - Father: First Name, Middle Name, Last Name.
  - If Guardian:
    - Guardian: First Name, Middle Name, Last Name.
  - Parent / Guardian Contact Number.
- **Year Level**:
  - Initial default is `1`.
  - Not editable by the student on their own profile page.
  - Editable by Dean and Chairperson in Account Management (`EditAccountPage`).
  - Automatically incremented by `1` when the Dean rolls over to a new school year, capped at `4`.

### 3. Faculty & Staff Profile Requirements
- **Address**: Home address string.
- **Contact Number**: Primary contact phone number.
- **Birthday**: Date input (`YYYY-MM-DD`).
- **Years of Teaching Experience**: Number of years. Automatically incremented by `1` when the Dean rolls over the school year.
- **Educational Background**:
  - Supports multiple degree entries.
  - Degree level: `Bachelors`, `Masters`, `Post-Masters`, `Doctorate`, `Post-Doctorate`.
  - School / Institution where obtained.
  - Year Graduated.
  - Field of Specialization.

### 4. Dean & Chairperson Academic Year Rollover
- In `LMSContext` (`setActiveSchoolYear`):
  - When the active school year is advanced for a college:
    - Students under that college have `yearLevel` incremented: `Math.min(4, (student.yearLevel || 1) + 1)`.
    - Faculty/Staff under that college have `yearsOfTeaching` incremented: `(faculty.yearsOfTeaching || 0) + 1`.

## Data Model & Interfaces

```typescript
export interface NormalizedPersonName {
  firstName: string;
  middleName?: string;
  lastName: string;
}

export type DegreeLevel = 'bachelors' | 'masters' | 'post_masters' | 'doctorate' | 'post_doctorate';

export interface EducationalDegree {
  id: string;
  degreeLevel: DegreeLevel;
  school: string;
  yearGraduated: number | string;
  specialization: string;
}

export interface User {
  // Existing fields...
  // Extended profile fields:
  birthday?: string;
  contactNumber?: string;
  
  // Student specific:
  permanentAddress?: string;
  presentAddress?: string;
  sameAsPermanentAddress?: boolean;
  hasGuardianOnly?: boolean;
  motherName?: NormalizedPersonName;
  fatherName?: NormalizedPersonName;
  guardianName?: NormalizedPersonName;
  parentContactNumber?: string;
  yearLevel?: number; // 1 to 4

  // Faculty/Staff specific:
  address?: string;
  yearsOfTeaching?: number;
  educationalBackground?: EducationalDegree[];

  profileCompleted?: boolean;
}
```

## Non-Goals & Constraints
- No Directus DDL/schema modifications via REST API. Everything is managed through client-side state, local storage persistence, and standard `/items/:collection` operations.
- Do not block navigation hard; the user is redirected on login but can browse freely while the banner persists.
