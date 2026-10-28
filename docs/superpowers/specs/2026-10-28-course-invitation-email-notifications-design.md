# Course Invitation Email Notifications (Google Classroom Pattern)

## Intent & The Why
When faculty members add or enroll students into a course via the "Enroll Students in Course" modal in GABAY LMS, student enrollment requests are created (`type: 'faculty_enroll'`, `status: 'pending'`). Currently, students only notice these invitations if they sign into the web application and check their Dashboard or Notification Bell.

To replicate the intuitive and proactive experience of Google Classroom, GABAY should automatically dispatch an institutional email invitation to each invited student. The email features a prominent "JOIN CLASS" button that brings the student straight to the LMS with an invitation acceptance modal, making class onboarding frictionless.

---

## Decisions Made (From Human Consultation)
1. **Landing Experience**: When a student clicks the "JOIN" button in their email, GABAY opens a class preview modal with course details and a 1-click **"Accept & Enter Course"** button. If the user is unauthenticated, they are prompted to sign in first, after which the join modal automatically appears.
2. **Backend Dispatch**: Handled by GABAY's existing Email Dispatch Service in `rag-service` (FastAPI) via a new endpoint `POST /api/courses/send-course-invitations`, leveraging existing SMTP credentials and graceful development/standalone simulation fallback.
3. **Visual Design**: Google Classroom-style rich card rendered in responsive HTML email format, branded with GABAY institutional typography and palette (slate header, emerald accents, instructor info, course code, title, section, academic term, call-to-action button, and fallback direct link).

---

## Goals & Non-Goals

### Goals
- **Automated Dispatch**: When faculty clicks "Send Invitations" in `PeopleView.tsx`, the system creates the enrollment requests in Likha ERP and triggers email dispatches to all selected student accounts.
- **Google Classroom Email Template**: Responsive, mobile-ready HTML email containing:
  - Header: GABAY Institutional LMS branding
  - Announcement: "[Instructor Name] invited you to join [Course Code]: [Course Title]"
  - Course Card: Course Code, Course Title, Section, Academic Term, Instructor Name & Department
  - Prominent Call to Action: **"JOIN CLASS"** button
  - Fallback Link: Plaintext clickable URL for email clients with CSS/links disabled
  - Explanatory footer and security notices
- **1-Click Class Join Workflow**:
  - Email link format: `<origin>/?action=join&courseId=<courseId>&requestId=<requestId>`
  - If authenticated as the invited student: Opens `JoinCourseModal` or class preview dialog pre-loaded with the course info, allowing the student to click "Accept & Enter Class" (which invokes `studentApproveInvitation`).
  - If unauthenticated: Stores the join query in session/URL, routes to login, and upon successful authentication resumes the join flow.
  - If authenticated as a different student/user: Displays a friendly switch-account prompt ("Signed in as [Current User]. This invitation was sent to [Target Email]. [Switch Account] or [Continue]").
- **Resilience & Non-Blocking UX**:
  - Database enrollment request creation is decoupled from email dispatch delivery failure; if an email fails to deliver or SMTP is unavailable, the database invitation remains valid and visible on the student's dashboard.
  - Faculty UI does not freeze during batch invites; emails are dispatched asynchronously or in parallel batch.
  - Development simulation mode when SMTP credentials are unset (mirrors activation email service).

### Non-Goals
- Modifying Likha ERP schema or Directus server container environment (avoids risky backend crashes or direct Directus SMTP reliance).
- Altering the self-enrollment course join code workflow.
- Sending spam reminders or unprompted re-invitations unless faculty re-initiates an invite.

### Anti-Goals
- No blocking the main thread or causing UI freezes when enrolling 50+ students in one action.
- No loose unauthenticated endpoints: the email dispatch endpoint requires client key validation (`X-Gabay-Client-Key`).
- No hardcoded origins or base URLs: respects `window.location.origin` / `VITE_APP_URL`.

---

## Architecture & Data Flow

```
[Faculty in PeopleView]
         │
         ▼
[enrollStudentsInCourse(studentIds, courseId)]
         │
         ├─────────────────────────────────────────┐
         ▼                                         ▼
1. Likha ERP (Directus)                   2. GABAY Email Service (FastAPI)
   POST /items/gabay_requests                POST /api/courses/send-course-invitations
   (type: 'faculty_enroll', status: 'pending')  ├── Resolves student emails & names
   Creates DB invitation rows                  ├── Renders Google Classroom HTML template
         │                                    └── Dispatches via SMTP (or simulated)
         ▼                                         │
[Student Dashboard (Pending Tab)]                  ▼
   Visible immediately in app            [Student's Email Inbox]
                                                   │
                                                   ▼ Student clicks "JOIN CLASS"
                                         [GABAY LMS Landing: ?action=join&courseId=...]
                                                   │
                                                   ▼
                                         [Course Join Modal]
                                         "Accept & Enter Course"
                                                   │
                                                   ▼
                                         [studentApproveInvitation] -> Enrolled!
```

---

## Detailed Specifications

### 1. Backend Service (`rag-service`)

#### 1.1 Endpoint
`POST /api/courses/send-course-invitations`
Protected by `verify_client_key` dependency.

**Request Schema (`CourseInvitationBatchRequest`):**
```python
class CourseInvitationItem(BaseModel):
    recipient_email: str = Field(..., min_length=3, max_length=254)
    recipient_name: Optional[str] = Field(None, max_length=150)
    instructor_name: Optional[str] = Field("Your Instructor", max_length=150)
    course_code: str = Field(..., max_length=50)
    course_title: str = Field(..., max_length=200)
    section: Optional[str] = Field(None, max_length=50)
    term: Optional[str] = Field(None, max_length=100)
    join_url: str = Field(..., min_length=1)
    request_id: Optional[str] = None

class CourseInvitationBatchRequest(BaseModel):
    invitations: List[CourseInvitationItem]
```

**Response Schema (`CourseInvitationBatchResponse`):**
```python
class CourseInvitationBatchResponse(BaseModel):
    success: bool
    total: int
    sent: int
    simulated: bool = False
    message: str
```

#### 1.2 HTML Email Template (`render_course_invitation_email_html`)
In `rag-service/app/services/email_service.py`:
- Container with subtle border, 580px max width, clean background `#f1f5f9`.
- Header: GABAY branding badge with emerald accents.
- Card banner:
  - Big headline: `Join [Course Code]`
  - Secondary: `[Instructor Name] invited you to join [Course Code] - [Course Title]`
- Highlight box with course metadata:
  - Class Name: `[Course Code] — [Course Title]`
  - Section: `Section [Section]`
  - Academic Term: `[Term / School Year]`
  - Teacher: `[Instructor Name]`
- Primary Button: Large, vibrant emerald/slate button with text: **"JOIN CLASS"** pointing to `join_url`.
- Note: "If you join, your course activities, grades, and announcements will be available in your student portal."
- Fallback link container displaying `join_url` in monospace text.
- Footer: Institutional copyright and automated notification disclaimer.

---

### 2. Frontend Client (`client/src`)

#### 2.1 API Client (`client/src/shared/api/emailApi.ts`)
Add `sendCourseInvitations`:
```typescript
export interface CourseInvitationPayload {
  recipientEmail: string;
  recipientName?: string;
  instructorName?: string;
  courseCode: string;
  courseTitle: string;
  section?: string;
  term?: string;
  joinUrl: string;
  requestId?: string;
}

export async function sendCourseInvitations(
  invitations: CourseInvitationPayload[]
): Promise<{ success: boolean; total: number; sent: number; simulated?: boolean; message?: string }>;
```

#### 2.2 Integration in `PeopleView.tsx` & `LMSContext.tsx`
When faculty triggers `enrollStudentsInCourse`:
1. `enrollStudentsInCourse` creates the request rows in Likha ERP and returns the created request objects with their IDs.
2. For each enrolled student:
   - Match `studentId` with `db.users` to find their `name` and `email`.
   - Build `joinUrl`: `${window.location.origin}/?action=join&courseId=${course.id}&requestId=${req.id}`.
   - Assemble invitation batch payload.
3. Fire `sendCourseInvitations(invitations)` asynchronously.
4. Notify faculty via standard toast/alert: `"Invited X students to [Course Code]. Email invitations have been sent."`

#### 2.3 Invitation Landing Handler (`JoinCourseModal` / `App.tsx`)
1. On app load or route transition, check `window.location.search` for `action=join&courseId=...&requestId=...`.
2. Clean up the URL query params via `window.history.replaceState` (storing state in memory / `sessionStorage`) so refreshing doesn't re-trigger unwanted modals.
3. **Authentication & Identity Verification**:
   - **If unauthenticated**: Store `{ courseId, requestId }` in `sessionStorage.getItem('gabay_pending_join')` and show Login screen with an alert banner ("Please sign in with your student account to join this course"). Upon successful login, the pending join prompt automatically reopens.
   - **If authenticated as a different account (`activeUser.id !== request.studentId`)**:
     - Display account mismatch modal:
       *"Signed in as [activeUser.name] ([activeUser.email]). This course invitation was issued for a different student account."*
     - Actions:
       - **"Switch Account"**: Logs out current session, preserves `gabay_pending_join`, and opens the Login screen.
       - **"Dismiss"**: Closes the dialog and remains logged in as the current user without enrolling. (Under no circumstances can an unauthorized account claim another student's invite; enforced by `studentApproveInvitation`).
   - **If authenticated as the invited student (`activeUser.id === request.studentId`)**:
     - **Already Enrolled**: If `activeUser.enrolledCourseIds` already includes `courseId`, show *"You are already enrolled in [Course Code]"* with a 1-click **"Enter Course"** button.
     - **Stale / Resolved Invitation**: If the request status is no longer `pending` (e.g., previously accepted or declined), show *"This invitation has already been processed or is no longer active"* with a **"Go to Dashboard"** button.
     - **Active Pending Invitation**: Display `JoinCourseModal` with class preview (Course code, title, section, instructor).
       - Primary Action: **"Accept & Enter Course"** -> calls `studentApproveInvitation(requestId)`. Upon success, navigates to `onNavigateCourse(courseId, 'section-selection')` (guaranteeing proper section resolution matching existing LMS standards).
       - Secondary Action: **"Decline"** -> calls `studentDeclineInvitation(requestId)`, closes modal.

---

## Test & Verification Plan
1. **Backend Tests (`rag-service/tests/test_email_service.py` & `test_invitation_api.py`)**:
   - Test HTML rendering of course invitation with all course metadata.
   - Test `POST /api/courses/send-course-invitations` with valid batch payload and client key.
   - Test simulation fallback when SMTP is not configured.
   - Test rejection when invalid email domain or missing required fields.
2. **Frontend Unit Tests**:
   - Test `sendCourseInvitations` in `client/src/shared/api/emailApi.test.ts`.
   - Test `PeopleView.tsx` triggering email dispatch when sending enrollments.
   - Test query param handling for `action=join` in app routing / join modal.
3. **Pressure / Realistic Verification**:
   - Batch enroll 5 students: verify all 5 invitation payloads are sent with correct URLs.
   - Click invitation link in incognito browser (unauthenticated): verify redirect to login, then join modal upon login.
   - Click invitation link as logged in student: verify 1-click accept navigates directly to course page.
