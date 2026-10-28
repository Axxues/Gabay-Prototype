# Course Invitation Email Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement automated Google Classroom-style email invitations when faculty enrolls students into courses, complete with responsive HTML email rendering, batch dispatch, and a 1-click Join Course confirmation modal.

**Architecture:** A FastAPI backend endpoint (`POST /api/courses/send-course-invitations`) in `rag-service` renders and dispatches Google Classroom-style HTML emails via institutional SMTP (with dev simulation fallback). The frontend `PeopleView` invokes this endpoint upon creating enrollment requests in Likha ERP, and an application-level URL query handler (`action=join`) loads a dedicated `CourseInvitationAcceptModal` for 1-click enrollment and section navigation.

**Tech Stack:** Python 3.12, FastAPI, Pydantic v2, smtplib, React 18, TypeScript 5, Tailwind CSS, Lucide React, Vitest, Pytest.

**Spec:** [`docs/superpowers/specs/2026-10-28-course-invitation-email-notifications-design.md`](file:///d:/4thesis/GabaySystem/Gabay-Prototype/docs/superpowers/specs/2026-10-28-course-invitation-email-notifications-design.md)

---

## Global Constraints

- Backend email dispatch is handled strictly by GABAY's Email Service (`rag-service`), never directly by the frontend client or Directus server configurations.
- Client key authentication (`X-Gabay-Client-Key`) must protect all email dispatch endpoints.
- Strict account authorization: a logged-in student can only accept an invitation matching their own user ID (`studentId === activeUser.id`).
- All frontend components must adhere to feature-based domain encapsulation (`client/src/features/courses/`, `client/src/features/people/`) and expose clean barrel exports (`index.ts`).
- Failure of email dispatch must be non-blocking: database enrollment requests in Likha ERP must succeed even if SMTP or email dispatch encounters a network failure.

## Review Focus

1. **Unauthenticated Invitation Link**: Opening `/?action=join&courseId=...&requestId=...` while signed out must persist the pending invitation in `sessionStorage` (`gabay_pending_join`), show the login screen, and immediately restore the invitation modal once the user signs in.
2. **Account Mismatch Protection**: If a user is signed in under Account A but clicks an invitation link addressed to Account B, the application must block acceptance, explain the mismatch, and offer "Switch Account" or "Dismiss".
3. **Stale or Already Processed Invitation**: Opening an invitation that has already been approved, declined, or removed must display a friendly notice rather than throwing an unhandled exception or blank screen.
4. **Already Enrolled Student**: If the student is already enrolled in the course when clicking the invitation link, the modal must show "You are already enrolled" with a direct "Enter Course" button.
5. **Batch Dispatch Resilience**: When faculty invites multiple students, students with missing or invalid email addresses must not crash the batch dispatch loop.

---

## Task Structure

### Task 1: HTML Invitation Email Template & Dispatch Function (`rag-service`)

**Files:**
- Modify: `rag-service/app/services/email_service.py`
- Modify: `rag-service/tests/test_email_service.py`

**Interfaces:**
- Produces:
  - `render_course_invitation_email_html(recipient_name: str, instructor_name: str, course_code: str, course_title: str, section: str, term: str, join_url: str) -> str`
  - `send_course_invitation_email(to_email: str, recipient_name: str, instructor_name: str, course_code: str, course_title: str, section: str, term: str, join_url: str) -> Dict[str, Any]`

- [ ] **Step 1: Write failing unit tests for course invitation email template and dispatch**

Add tests to `rag-service/tests/test_email_service.py`:
```python
def test_render_course_invitation_email_html():
    html_output = render_course_invitation_email_html(
        recipient_name="Maria Santos",
        instructor_name="Prof. Alan Turing",
        course_code="CS 311",
        course_title="Software Engineering",
        section="BSCS 3A",
        term="1st Sem 2026-2027",
        join_url="https://gabay.dmmmsu.edu.ph/?action=join&courseId=c1&requestId=req-1",
    )
    assert "Maria Santos" in html_output
    assert "Prof. Alan Turing" in html_output
    assert "CS 311" in html_output
    assert "Software Engineering" in html_output
    assert "BSCS 3A" in html_output
    assert "JOIN CLASS" in html_output
    assert "https://gabay.dmmmsu.edu.ph/?action=join&amp;courseId=c1&amp;requestId=req-1" in html_output or "action=join" in html_output

def test_send_course_invitation_email_simulates_when_unconfigured(monkeypatch):
    from app.core.config import get_settings
    monkeypatch.setattr(get_settings(), "smtp_user", "")
    monkeypatch.setattr(get_settings(), "smtp_password", "")
    res = send_course_invitation_email(
        to_email="student@dmmmsu.edu.ph",
        recipient_name="Maria Santos",
        instructor_name="Prof. Turing",
        course_code="CS 311",
        course_title="Software Engineering",
        section="3A",
        term="1st Sem",
        join_url="http://localhost:5173/?action=join&courseId=c1&requestId=req-1",
    )
    assert res["success"] is True
    assert res["simulated"] is True
    assert res["recipient"] == "student@dmmmsu.edu.ph"
```

- [ ] **Step 2: Run pytest to verify test failures**

Run: `python -m pytest rag-service/tests/test_email_service.py -k "test_render_course_invitation or test_send_course_invitation"`
Expected: FAIL with `ImportError: cannot import name 'render_course_invitation_email_html'`

- [ ] **Step 3: Implement `render_course_invitation_email_html` and `send_course_invitation_email` in `rag-service/app/services/email_service.py`**

Implement Google Classroom-styled responsive email with institutional header, instructor invitation notice, course badge box (code, title, section, term), prominent "JOIN CLASS" button, fallback plaintext link, and SMTP dispatch/simulation logic matching `send_activation_email`.

- [ ] **Step 4: Run pytest to verify test passes**

Run: `python -m pytest rag-service/tests/test_email_service.py -v`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add rag-service/app/services/email_service.py rag-service/tests/test_email_service.py
git commit -m "feat(rag-service): add course invitation html email template and dispatch"
```

---

### Task 2: Backend Batch API Endpoint & Schemas (`rag-service`)

**Files:**
- Modify: `rag-service/app/main.py`
- Modify: `rag-service/tests/test_email_service.py`

**Interfaces:**
- Consumes: `send_course_invitation_email` from `app.services.email_service`
- Produces: `POST /api/courses/send-course-invitations` endpoint

- [ ] **Step 1: Write failing test for batch invitation endpoint**

Add tests to `rag-service/tests/test_email_service.py`:
```python
def test_api_send_course_invitations_batch_success(client, monkeypatch):
    payload = {
        "invitations": [
            {
                "recipient_email": "student1@dmmmsu.edu.ph",
                "recipient_name": "Student One",
                "instructor_name": "Engr. Turing",
                "course_code": "CS 311",
                "course_title": "Software Engineering",
                "section": "BSCS 3A",
                "term": "1st Sem 2026-2027",
                "join_url": "http://localhost:5173/?action=join&courseId=c1&requestId=req-1",
                "request_id": "req-1"
            }
        ]
    }
    response = client.post("/api/courses/send-course-invitations", json=payload, headers={"X-Gabay-Client-Key": "dev-insecure-client-key"})
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["total"] == 1
    assert data["sent"] == 1

def test_api_send_course_invitations_rejects_missing_auth(client):
    response = client.post("/api/courses/send-course-invitations", json={"invitations": []})
    assert response.status_code in (401, 403)
```

- [ ] **Step 2: Run pytest to verify test failures**

Run: `python -m pytest rag-service/tests/test_email_service.py -k "test_api_send_course_invitations"`
Expected: FAIL with 404 Not Found

- [ ] **Step 3: Implement endpoint in `rag-service/app/main.py`**

Define `CourseInvitationItem`, `CourseInvitationBatchRequest`, and `CourseInvitationBatchResponse` schemas.
Implement `@app.post("/api/courses/send-course-invitations", response_model=CourseInvitationBatchResponse)` with `Depends(verify_client_key)`. Loop through invitations, call `send_course_invitation_email`, and return aggregate count of total and sent.

- [ ] **Step 4: Run pytest to verify test passes**

Run: `python -m pytest rag-service/tests/test_email_service.py -v`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add rag-service/app/main.py rag-service/tests/test_email_service.py
git commit -m "feat(rag-service): add batch course invitation endpoint"
```

---

### Task 3: Frontend Email API Client (`client/src/shared/api`)

**Files:**
- Modify: `client/src/shared/api/emailApi.ts`
- Modify: `client/src/shared/api/emailApi.test.ts`

**Interfaces:**
- Produces:
  - `CourseInvitationPayload`
  - `getCourseInvitationEmailApiUrl() -> string`
  - `sendCourseInvitations(invitations: CourseInvitationPayload[]) -> Promise<{ success: boolean; total: number; sent: number; simulated?: boolean; message?: string }>`

- [ ] **Step 1: Write failing unit tests in `emailApi.test.ts`**

Add tests to `client/src/shared/api/emailApi.test.ts`:
```typescript
it('dispatches course invitations batch to the correct endpoint', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, total: 2, sent: 2, message: 'Invitations dispatched.' })
  });
  global.fetch = fetchMock;

  const invitations = [
    {
      recipientEmail: 's1@dmmmsu.edu.ph',
      recipientName: 'Student One',
      instructorName: 'Prof. Turing',
      courseCode: 'CS 311',
      courseTitle: 'Software Engineering',
      section: 'BSCS 3A',
      term: '1st Sem 2026-2027',
      joinUrl: 'http://localhost:5173/?action=join&courseId=c1&requestId=req-1',
      requestId: 'req-1'
    }
  ];

  const res = await sendCourseInvitations(invitations);
  expect(fetchMock).toHaveBeenCalled();
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toContain('/api/courses/send-course-invitations');
  const body = JSON.parse(init.body);
  expect(body.invitations).toHaveLength(1);
  expect(body.invitations[0].recipient_email).toBe('s1@dmmmsu.edu.ph');
  expect(res.success).toBe(true);
  expect(res.sent).toBe(2);
});
```

- [ ] **Step 2: Run vitest to verify test failure**

Run: `npm --prefix client test -- --run src/shared/api/emailApi.test.ts`
Expected: FAIL with `sendCourseInvitations is not defined`

- [ ] **Step 3: Implement `sendCourseInvitations` in `client/src/shared/api/emailApi.ts`**

Map camelCase TS fields to snake_case backend fields, POST to `${baseUrl}/api/courses/send-course-invitations`, handle dev fallback if backend is unreachable, and return standardized response.

- [ ] **Step 4: Run vitest to verify test passes**

Run: `npm --prefix client test -- --run src/shared/api/emailApi.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/shared/api/emailApi.ts client/src/shared/api/emailApi.test.ts
git commit -m "feat(client): add sendCourseInvitations client api"
```

---

### Task 4: Faculty Enrollment Flow Integration (`client/src/features/people`)

**Files:**
- Modify: `client/src/features/people/PeopleView.tsx`
- Modify: `client/src/features/people/PeopleView.test.tsx`

**Interfaces:**
- Consumes: `sendCourseInvitations` from `shared/api/emailApi`, `enrollStudentsInCourse` from `LMSContext`

- [ ] **Step 1: Write test verifying email invitations are triggered when faculty enrolls students**

In `client/src/features/people/PeopleView.test.tsx`:
Add a test verifying that when `handleEnrollSelectedStudents` executes:
1. `enrollStudentsInCourse` is called with the selected student IDs.
2. `sendCourseInvitations` is called with each student's name, email, course details, and generated `joinUrl`.
3. Success alert mentions both enrollment and email invitations sent.

- [ ] **Step 2: Run vitest to verify test failure**

Run: `npm --prefix client test -- --run src/features/people/PeopleView.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement invitation gathering and email dispatch in `PeopleView.tsx`**

In `PeopleView.tsx` `handleEnrollSelectedStudents`:
- For each `studentId` in `selectedStudentIds`:
  - Find student in `db.users`.
  - Build `joinUrl = ${window.location.origin}/?action=join&courseId=${courseId}&studentId=${studentId}`.
  - Compile `CourseInvitationPayload` object.
- Fire `void sendCourseInvitations(invitationPayloads)` asynchronously so UI alert displays immediately without hanging.
- Update success alert copy: `"Invited X students to [Course Code]. Email invitations have been dispatched."`

- [ ] **Step 4: Run vitest to verify test passes**

Run: `npm --prefix client test -- --run src/features/people/PeopleView.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/features/people/PeopleView.tsx client/src/features/people/PeopleView.test.tsx
git commit -m "feat(people): dispatch email invitations on student course enrollment"
```

---

### Task 5: Course Invitation Acceptance Modal Component (`client/src/features/courses`)

**Files:**
- Create: `client/src/features/courses/components/CourseInvitationAcceptModal.tsx`
- Create: `client/src/features/courses/components/CourseInvitationAcceptModal.test.tsx`
- Modify: `client/src/features/courses/index.ts`

**Interfaces:**
- Produces: `CourseInvitationAcceptModal`
  ```typescript
  export interface CourseInvitationAcceptModalProps {
    isOpen: boolean;
    onClose: () => void;
    courseId: string;
    requestId?: string;
    targetStudentId?: string;
    onNavigateCourse: (courseId: string, subView?: string) => void;
  }
  ```

- [ ] **Step 1: Write comprehensive unit tests for `CourseInvitationAcceptModal`**

In `client/src/features/courses/components/CourseInvitationAcceptModal.test.tsx`:
- Test 1: Active Invitation - displays course code, title, section, instructor, and "Accept & Enter Course" button.
- Test 2: Clicking "Accept & Enter Course" calls `studentApproveInvitation(requestId)` and navigates to `onNavigateCourse(courseId, 'section-selection')`.
- Test 3: Account mismatch - when `activeUser.id !== targetStudentId`, displays mismatch warning and provides "Switch Account" and "Dismiss" buttons.
- Test 4: Already enrolled - when `activeUser.enrolledCourseIds.includes(courseId)`, displays "Already enrolled" and provides "Enter Course" button.
- Test 5: Stale invitation - when request is not found or status !== 'pending', displays "Invitation is no longer active" notice.

- [ ] **Step 2: Run vitest to verify test failure**

Run: `npm --prefix client test -- --run src/features/courses/components/CourseInvitationAcceptModal.test.tsx`
Expected: FAIL with module not found

- [ ] **Step 3: Implement `CourseInvitationAcceptModal.tsx` and export in `client/src/features/courses/index.ts`**

Implement modal with `ModalPortal` and `DialogFrame`:
- Look up course from `db.courses`.
- Look up request from `db.enrollmentRequests` or fallback to `courseId`/`requestId`.
- Handle mismatch, already enrolled, stale, and active pending states cleanly.
- Bind "Accept & Enter Course" to `studentApproveInvitation` and route to `onNavigateCourse(courseId, 'section-selection')`.
- Export `CourseInvitationAcceptModal` from `client/src/features/courses/index.ts`.

- [ ] **Step 4: Run vitest to verify test passes**

Run: `npm --prefix client test -- --run src/features/courses/components/CourseInvitationAcceptModal.test.tsx`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/features/courses/components/CourseInvitationAcceptModal.tsx client/src/features/courses/components/CourseInvitationAcceptModal.test.tsx client/src/features/courses/index.ts
git commit -m "feat(courses): add CourseInvitationAcceptModal component"
```

---

### Task 6: App-Level Join URL Query Handler & Auth Session Persistence (`client/src`)

**Files:**
- Modify: `client/src/App.tsx`
- Create: `client/src/App.courseInvitation.test.tsx`

**Interfaces:**
- Consumes: `CourseInvitationAcceptModal` from `features/courses`

- [ ] **Step 1: Write integration tests for app-level URL invitation detection**

In `client/src/App.courseInvitation.test.tsx`:
- Test 1: When URL has `?action=join&courseId=c1&requestId=req-1` and user is logged in as student, `CourseInvitationAcceptModal` opens automatically and cleans URL search params.
- Test 2: When URL has `?action=join...` and user is NOT logged in, pending join params are preserved in `sessionStorage` (`gabay_pending_join`), and login screen displays.
- Test 3: When user completes login with pending join params in `sessionStorage`, modal automatically opens.

- [ ] **Step 2: Run vitest to verify test failure**

Run: `npm --prefix client test -- --run src/App.courseInvitation.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement invitation URL parser and session handler in `App.tsx`**

- On mount, detect `action === 'join'` and extract `courseId`, `requestId`, `studentId`.
- Clean search params from URL with `window.history.replaceState`.
- If `!activeUser`: store in `sessionStorage.setItem('gabay_pending_join', JSON.stringify({ courseId, requestId, studentId }))`.
- If `activeUser`: load invitation state into `invitationModalState`.
- In `handleLoginSuccess`: check `sessionStorage.getItem('gabay_pending_join')`, restore state, and clear storage.
- Render `<CourseInvitationAcceptModal>` when `invitationModalState` is populated.

- [ ] **Step 4: Run vitest to verify test passes**

Run: `npm --prefix client test -- --run src/App.courseInvitation.test.tsx`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/App.tsx client/src/App.courseInvitation.test.tsx
git commit -m "feat(app): add join url query handler and invitation modal lifecycle"
```

---

### Task 7: Full System Verification & Regression Run

**Files:**
- All modified backend and frontend test suites

- [ ] **Step 1: Run all Python tests in `rag-service`**

Run: `python -m pytest rag-service/tests/ -v`
Expected: 100% PASS

- [ ] **Step 2: Run affected frontend test suites in `client`**

Run: `npm --prefix client test -- --run src/shared/api/emailApi.test.ts src/features/people/PeopleView.test.tsx src/features/courses/components/CourseInvitationAcceptModal.test.tsx src/App.courseInvitation.test.tsx`
Expected: 100% PASS

- [ ] **Step 3: Verification commit**

```bash
git commit --allow-empty -m "chore(release): verify all course invitation email notification tests pass"
```
