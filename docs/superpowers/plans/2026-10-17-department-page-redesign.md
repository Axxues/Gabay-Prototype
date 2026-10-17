# Department Details Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Overview
Redesign and polish `DepartmentDetailsPage.tsx` to span the full canvas width (`w-full`) across widescreen displays, modernizing its visual hierarchy, leadership management card, 4-stat metrics grid, and tabbed directories (Faculty Roster, Course Catalog, Student Directory) with search filtering and refined typography.

## Target File
- `client/src/features/accounts/DepartmentDetailsPage.tsx`
- Verification: `client/src/features/accounts/DepartmentDetailsPage.test.tsx`

---

## Tasks

- [x] **Task 1: Full-Width Canvas & Enhanced Header Layout**
  - Remove `max-w-6xl mx-auto` constraint and replace with `w-full space-y-6 animate-fade-in pb-16`.
  - Refine breadcrumb navigation with clear separators, icons, and accessible labels.
  - Upgrade the header card with a prominent department icon badge, clear typography, department code badge, and affiliated college indicator.

- [x] **Task 2: Modern Department Leadership Card**
  - Redesign Chairperson leadership card with enhanced visual hierarchy.
  - Maintain `data-testid="incumbent-chairperson-card"`, role labels, and action buttons (`Reassign Chairperson` / `Appoint Chairperson`).
  - Improve avatar presentation, designation pill, and contact layout.

- [x] **Task 3: Refined 4-Stat Metrics Grid**
  - Update stat cards to use full width with `grid-cols-2 lg:grid-cols-4 gap-4`.
  - Add polished icon badge containers with subtle borders and theme-harmonized accents.
  - Preserve all `data-testid` attributes (`metric-total-faculty`, `metric-total-students`, `metric-active-courses`, `metric-class-sections`).

- [x] **Task 4: Interactive Directories & Catalog with Search Filtering**
  - Modernize tab selector bar with clean segmented pill styling and count badges.
  - Add interactive search input filtering faculty, courses, and students in real time.
  - Upgrade list items with balanced columns, proper contrast for 0 vs >0 course loads, and responsive layout.

- [x] **Task 5: Test Verification & Build Check**
  - Run `DepartmentDetailsPage.test.tsx` and full test suite.
  - Run `npm run build` to verify clean compilation.
