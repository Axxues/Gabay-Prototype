# Grading Logic Revision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Revise the Course Gradebook grading system to use static weights for term/final calculations (40%/60%) while allowing faculty to configure relative weights for individual assessments and toggle their inclusion in grade calculations.

**Architecture:** 
- Static weights: Term = 40% assessments + 60% exam; Final = 40% midterm + 60% finals
- Assessment weights: Relative percentages set by faculty, normalized to 100% of the assessment portion
- Per-course configuration: Each course maintains its own assessment weight settings
- Backward compatible: Existing data structures preserved, new optional fields added

**Tech Stack:** TypeScript, React, Likha ERP (Directus), Tailwind CSS

**Spec:** Based on user requirements: static term/final weights, faculty-configurable assessment weights with include/exclude toggle

---

## Global Constraints

- All changes must be backward compatible with existing data
- Existing test IDs must be preserved for automated testing
- No breaking changes to API interfaces
- Follow existing code patterns in the GABAY LMS codebase
- Use Tailwind CSS for styling

## Review Focus

1. **Empty assessment list**: If no assessments are included, term grade should be null or exam-only
2. **Weight normalization**: If weights don't sum to 100%, normalize them proportionally
3. **Negative weights**: Validate that weights are non-negative
4. **Mixed include/exclude**: Some activities included, some excluded - verify calculations
5. **All excluded**: If all assessments excluded, term grade should be exam-only (100%)

---

## File Structure

### Backend Schema (Likha ERP - Directus)
- **collections/gabay_activities**: Add `includeInGrades` field (boolean, default: true)
- **collections/gabay_quizzes**: Add `weight` (number) and `includeInGrades` (boolean, default: true) fields

### Frontend Types
- `client/src/shared/types/lms.ts`: Update Activity and Quiz interfaces

### Frontend Utilities
- `client/src/shared/utils/spr.ts`: New weighted calculation functions

### Frontend Components
- `client/src/features/assessments/components/grading/FacultyGradebook.tsx`: Update to display new fields
- Activity/Quiz creation/edit forms: Add weight and includeInGrades controls (future task)

---

## Implementation Tasks

### Task 1: Update Type Definitions

**Files:**
- Modify: `client/src/shared/types/lms.ts`

**Interfaces:**
- Produces: Updated `Activity` and `Quiz` interfaces with new fields

- [ ] **Step 1: Add `includeInGrades` to Activity interface**

```typescript
// In Activity interface (line ~325)
includeInGrades?: boolean;
```

- [ ] **Step 2: Add fields to Quiz interface**

```typescript
// In Quiz interface (line ~403)
weight?: number;
includeInGrades?: boolean;
```

- [ ] **Step 3: Commit**

```bash
git add client/src/shared/types/lms.ts
git commit -m "feat(grades): add weight and includeInGrades fields to assessment types"
```

---

### Task 2: Create Weighted Assessment Calculation Function

**Files:**
- Modify: `client/src/shared/utils/spr.ts`

**Interfaces:**
- Consumes: Activity and Quiz with weight and includeInGrades fields
- Produces: `weightedClassStandingPercent()` function

- [ ] **Step 1: Add weighted class standing calculation function**

```typescript
// Add after classStandingPercent function
export function weightedClassStandingPercent(
  items: Array<{ score: number | null; weight: number | undefined }>,
): number {
  // Filter out null scores and items not included in grades
  const includedItems = items.filter(item => item.score !== null);
  if (includedItems.length === 0) return 0;
  
  // Calculate total weight of included items
  const totalWeight = includedItems.reduce((sum, item) => {
    return sum + (item.weight ?? 1); // Default weight of 1 if not set
  }, 0);
  
  if (totalWeight <= 0) return 0;
  
  // Calculate weighted sum
  const weightedSum = includedItems.reduce((sum, item) => {
    const weight = item.weight ?? 1;
    return sum + ((item.score ?? 0) * weight);
  }, 0);
  
  return (weightedSum / totalWeight);
}
```

- [ ] **Step 2: Add helper to normalize weights**

```typescript
// Add normalization helper
export function normalizeWeights(
  items: Array<{ weight: number | undefined }>,
): Array<{ weight: number }> {
  const included = items.filter(item => item.weight !== undefined && item.weight > 0);
  if (included.length === 0) {
    return items.map(item => ({ weight: 1 }));
  }
  
  const total = included.reduce((sum, item) => sum + (item.weight ?? 0), 0);
  if (total === 0) {
    return items.map(item => ({ weight: 1 }));
  }
  
  return items.map(item => ({
    weight: (item.weight ?? 0) / total * included.length
  }));
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/shared/utils/spr.ts
git commit -m "feat(grades): add weighted assessment calculation functions"
```

---

### Task 3: Update Term Grade Calculation

**Files:**
- Modify: `client/src/shared/utils/spr.ts`

**Interfaces:**
- Consumes: `weightedClassStandingPercent()`, normalized assessment data
- Produces: Updated `termGrade()` function using static 40/60 weights

- [ ] **Step 1: Create new term grade function with static weights**

```typescript
// Add new function that uses static 40/60 weights
export function termGradeStatic(
  csPercent: number,
  examScore: number | null,
  examPerfect: number,
  hasClassStandingData?: boolean,
): number | null {
  // Static 40% assessments, 60% exam
  if (examScore === null || examPerfect <= 0) {
    if (hasClassStandingData) return round2(csPercent);
    return null;
  }
  return round2((csPercent * 40 + ((examScore / examPerfect) * 100 * 60)) / 100);
}
```

- [ ] **Step 2: Create static weights constant**

```typescript
// Add at the top of the file, after imports
export const STATIC_GRADING_WEIGHTS: SPRWeights = {
  csWeight: 40,
  examWeight: 60,
  mtWeight: 40,
  ftWeight: 60,
  formulaLabel: 'Term 40% Assessments + 60% Exam • Final 40% MT + 60% FT',
};
```

- [ ] **Step 3: Commit**

```bash
git add client/src/shared/utils/spr.ts
git commit -m "feat(grades): add static grading weights and termGradeStatic function"
```

---

### Task 4: Update Final Grade Calculation

**Files:**
- Modify: `client/src/shared/utils/spr.ts`

**Interfaces:**
- Consumes: `STATIC_GRADING_WEIGHTS`, term grades
- Produces: Updated `finalPercentTerms()` usage with static weights

- [ ] **Step 1: Update finalPercentTerms to use static weights**

```typescript
// Modify finalPercentTerms to accept weights or use static
export function finalPercentTerms(
  termGrades: Record<TermId, number | null>,
  weights: Record<TermId, number> = STATIC_GRADING_WEIGHTS,
): number | null {
  let acc = 0;
  for (const [term, weight] of Object.entries(weights) as [TermId, number][]) {
    const g = termGrades[term];
    if (g === null || g === undefined) return null;
    acc += (g * weight) / 100;
  }
  return round2(acc);
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/shared/utils/spr.ts
git commit -m "feat(grades): update finalPercentTerms to use static weights"
```

---

### Task 5: Update FacultyGradebook to Use New Logic

**Files:**
- Modify: `client/src/features/assessments/components/grading/FacultyGradebook.tsx`

**Interfaces:**
- Consumes: New grading functions from spr.ts
- Produces: Updated gradebook with static weights and weighted assessments

- [ ] **Step 1: Import new functions and constants**

```typescript
import {
  // ... existing imports
  STATIC_GRADING_WEIGHTS,
  termGradeStatic,
  weightedClassStandingPercent,
} from '../../../../shared/utils/spr';
```

- [ ] **Step 2: Update SPR rows computation to use static weights**

Replace the termGrade call with termGradeStatic and use weighted class standing:

```typescript
// In sprRows computation, replace:
// perTerm[term] = { cells, exam: exam.score, grade: termGrade(cs, exam.score, exam.perfect, weights, hasCSData || exam.score !== null) };

// With:
const weightedCs = weightedClassStandingPercent(
  cells.map(c => ({ score: c.score, weight: getActivityWeight(col) }))
);
perTerm[term] = { cells, exam: exam.score, grade: termGradeStatic(weightedCs, exam.score, exam.perfect, hasCSData || exam.score !== null) };

// Helper to get weight from activity/quiz
const getActivityWeight = (col: SPRColumn): number | undefined => {
  if (!col.linkedSource) return undefined;
  const dbRef = col.linkedSource.kind === 'activity' ? db.activities : db.quizzes;
  const item = dbRef?.find(i => i.id === col.linkedSource?.sourceId);
  return item?.weight;
};
```

- [ ] **Step 3: Update final grade calculation**

```typescript
// Replace:
// const final = finalPercentTerms(termGrades, termWeights);

// With:
const final = finalPercentTerms(termGrades, STATIC_GRADING_WEIGHTS);
```

- [ ] **Step 4: Update weights display in UI**

```typescript
// Update the formula badge to show static formula
<div className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-bold shadow-xs">
  <Calculator className="w-3.5 h-3.5" />
  <span>{STATIC_GRADING_WEIGHTS.formulaLabel}</span>
</div>
```

- [ ] **Step 5: Add visual indicators for included/excluded assessments**

In the table header for each assessment column, add an indicator:

```typescript
// In the table header rendering
<th key={`${term}-${col.id}`} className={`px-2 py-2 text-center min-w-[76px] animate-gradebook-cell-in ${colIdx === 0 ? 'border-l border-border' : ''}`}>
  <div className="font-semibold text-foreground truncate max-w-[96px] mx-auto flex items-center gap-1" title={col.title}>
    {getActivityWeight(col) !== undefined && (
      <span className="text-xs">{getActivityWeight(col)}%</span>
    )}
    {col.title}
    {!isIncludedInGrades(col) && (
      <span title="Not included in grade calculation" className="text-muted-foreground">✕</span>
    )}
  </div>
  <div className="text-[11px] text-muted-foreground font-normal mt-0.5 tabular-nums">
    / {col.perfectScore}
  </div>
</th>
```

- [ ] **Step 6: Commit**

```bash
git add client/src/features/assessments/components/grading/FacultyGradebook.tsx
git commit -m "feat(grades): update FacultyGradebook to use static weights and weighted assessments"
```

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-10-31-grading-logic-revision.md`.**

This plan covers:
- Type definition updates for new fields
- Weighted assessment calculation logic
- Static weights for term and final grades
- FacultyGradebook UI updates
- Backward compatibility maintained

For this plan I recommend **Native** execution - I implement every task myself in this session, since the tasks are interdependent (each builds on the previous) and the codebase is already loaded in context.

Does the plan capture what you want? If so, I'll proceed with implementation using the `executing-plans` skill.
