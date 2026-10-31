// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const mocks = vi.hoisted(() => ({
  isLoading: false,
  isSyncing: false,
  activeRole: 'faculty' as string,
  db: { activities: [], submissions: [] } as any,
  effectiveTerms: ['midterm', 'finals'] as string[],
  submitActivity: vi.fn(),
  showConfirm: vi.fn(),
}));

vi.mock('../../shared/context/LMSContext', () => ({
  useLMS: () => ({
    activeRole: mocks.activeRole,
    activeUser: { id: 'u-fac-1', name: 'Faculty', role: 'faculty' },
    db: mocks.db,
    effectiveTermsForCourse: () => mocks.effectiveTerms,
    isLoading: mocks.isLoading,
    isSyncing: mocks.isSyncing,
    submitActivity: mocks.submitActivity,
    deleteActivity: vi.fn(),
    openSpeedGrader: vi.fn(),
    showAlert: vi.fn(),
    showConfirm: mocks.showConfirm,
  }),
}));

import { ActivitiesView } from './ActivitiesView';

function renderPage(selectedActivityId: string | null = null) {
  return render(
    <ActivitiesView
      courseId="c1"
      selectedActivityId={selectedActivityId}
      onSelectActivity={() => {}}
      onBackToModules={() => {}}
    />
  );
}

describe('ActivitiesView refresh loading', () => {
  beforeEach(() => {
    mocks.isLoading = false;
    mocks.isSyncing = false;
    mocks.activeRole = 'faculty';
    mocks.db = { activities: [], submissions: [] } as any;
    mocks.effectiveTerms = ['midterm', 'finals'];
  });

  test('shows loading skeleton (not empty text) while bootstrapping', () => {
    mocks.isLoading = true;
    renderPage();
    expect(screen.getByTestId('activities-loading')).toBeInTheDocument();
    expect(screen.queryByText(/no activities published/i)).not.toBeInTheDocument();
  });

  test('shows loading skeleton while background sync fills activities', () => {
    mocks.isSyncing = true;
    renderPage();
    expect(screen.getByTestId('activities-loading')).toBeInTheDocument();
  });

  test('shows empty state only once loading settles', () => {
    renderPage();
    expect(screen.getByText(/no activities published/i)).toBeInTheDocument();
    expect(screen.queryByTestId('activities-loading')).not.toBeInTheDocument();
  });
});

describe('ActivitiesView term filter', () => {
  beforeEach(() => {
    mocks.isLoading = false;
    mocks.isSyncing = false;
    mocks.activeRole = 'faculty';
    mocks.db = { activities: [], submissions: [] } as any;
    mocks.effectiveTerms = ['midterm', 'finals'];
  });

  test('shows a term filter on the Activities list', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /filter by term/i })).toBeInTheDocument();
  });

  test('filters classic activities and question sets by term', () => {
    mocks.db = {
      activities: [
        {
          id: 'asg-mid',
          courseId: 'c1',
          title: 'Midterm Lab',
          instructions: '',
          term: 'midterm',
          format: 'classic',
          pointsPossible: 100,
          dueDate: new Date().toISOString(),
          submissionTypes: ['online_text'],
          published: true,
          category: 'Activities',
          weight: 20,
          rubric: [],
        },
        {
          id: 'asg-fin',
          courseId: 'c1',
          title: 'Finals Lab',
          instructions: '',
          term: 'finals',
          format: 'classic',
          pointsPossible: 100,
          dueDate: new Date().toISOString(),
          submissionTypes: ['online_text'],
          published: true,
          category: 'Activities',
          weight: 20,
          rubric: [],
        },
        {
          id: 'act-mid',
          courseId: 'c1',
          title: 'Midterm Set',
          instructions: '',
          term: 'midterm',
          format: 'questionset',
          questions: [],
          pointsPossible: 10,
          published: true,
        },
      ],
      submissions: [],
    } as any;
    renderPage();
    expect(screen.getByText('Midterm Lab')).toBeInTheDocument();
    expect(screen.getByText('Finals Lab')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /filter by term/i }));
    fireEvent.click(screen.getByRole('option', { name: 'Midterm' }));

    expect(screen.getByText('Midterm Lab')).toBeInTheDocument();
    expect(screen.queryByText('Finals Lab')).not.toBeInTheDocument();
  });

  test('renders classic and question-set activities side by side', () => {
    mocks.db = {
      activities: [
        {
          id: 'asg-1',
          courseId: 'c1',
          title: 'Classic Lab Activity',
          instructions: '',
          term: 'midterm',
          format: 'classic',
          pointsPossible: 100,
          dueDate: new Date().toISOString(),
          submissionTypes: ['online_text'],
          published: true,
          category: 'Activities',
          weight: 20,
          rubric: [],
        },
        {
          id: 'act-1',
          courseId: 'c1',
          title: 'Question Set Activity',
          instructions: '',
          term: 'midterm',
          format: 'questionset',
          questions: [],
          pointsPossible: 10,
          published: true,
        },
      ],
      submissions: [],
    } as any;
    renderPage();
    expect(screen.getByText('Classic Lab Activity')).toBeInTheDocument();
    expect(screen.getByText('Question Set Activity')).toBeInTheDocument();
  });
  test('renders detail view with file upload only and omits Available to', () => {
    mocks.db = {
      activities: [
        {
          id: 'act-file-only',
          courseId: 'c1',
          title: 'Activity 1 (File Upload)',
          instructions: 'Upload your file',
          term: 'midterm',
          format: 'classic',
          pointsPossible: 20,
          dueDate: new Date().toISOString(),
          submissionTypes: ['file'],
          published: true,
          category: 'Activities',
          weight: 20,
          rubric: [],
        },
      ],
      submissions: [],
    } as any;

    renderPage('act-file-only');

    expect(screen.getByText('Activity 1 (File Upload)')).toBeInTheDocument();
    expect(screen.getByText('Submissions')).toBeInTheDocument();
    expect(screen.getByText('File upload')).toBeInTheDocument();
    expect(screen.queryByText(/File upload, text entry/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Available to/i)).not.toBeInTheDocument();
  });

  test('renders attached files with View and Download buttons and opens preview modal on View click', () => {
    mocks.db = {
      activities: [
        {
          id: 'act-with-files',
          courseId: 'c1',
          title: 'Activity with Attachments',
          instructions: 'Check attached files',
          term: 'midterm',
          format: 'classic',
          pointsPossible: 50,
          submissionTypes: ['file'],
          published: true,
          attachments: [
            {
              name: 'ThesisManuscript.docx',
              size: '3.8 MB',
              url: '/likha/assets/thesis-file-id'
            },
            {
              name: 'Diagram.png',
              size: '176.9 KB',
              url: '/likha/assets/diagram-file-id'
            }
          ]
        }
      ],
      submissions: []
    } as any;

    renderPage('act-with-files');

    expect(screen.getByText('Reference & Starter Handouts')).toBeInTheDocument();
    expect(screen.getByText('ThesisManuscript.docx')).toBeInTheDocument();
    expect(screen.getByText('Diagram.png')).toBeInTheDocument();

    const viewButtons = screen.getAllByRole('button', { name: /view/i });
    expect(viewButtons.length).toBeGreaterThanOrEqual(2);

    const downloadLinks = screen.getAllByRole('link', { name: /download/i });
    expect(downloadLinks.length).toBeGreaterThanOrEqual(2);

    fireEvent.click(viewButtons[0]);
    expect(screen.getByRole('dialog', { name: /preview of ThesisManuscript\.docx/i })).toBeInTheDocument();
  });

  test('renders activities sorted with latest at the top and oldest at the bottom', () => {
    mocks.db = {
      modules: [
        {
          id: 'mod-1',
          courseId: 'c1',
          title: 'Module 1',
          items: [
            { id: 'i1', type: 'activity', activityId: 'act-1', order: 3 },
            { id: 'i2', type: 'activity', activityId: 'act-2', order: 4 },
            { id: 'i3', type: 'activity', activityId: 'act-3', order: 5 },
            { id: 'i4', type: 'activity', activityId: 'act-4', order: 1793255351 },
            { id: 'i5', type: 'activity', activityId: 'asg-activity-act-5', order: 1793255600 },
          ],
        },
      ],
      activities: [
        { id: 'act-3', courseId: 'c1', title: 'Activity 3 (Both)', format: 'classic', published: true, term: 'midterm' },
        { id: 'act-2', courseId: 'c1', title: 'Activity 2 (Text Entry)', format: 'classic', published: true, term: 'midterm' },
        { id: 'act-4', courseId: 'c1', title: 'Activity 4 (No Criteria)', format: 'classic', published: true, term: 'midterm' },
        { id: 'act-1', courseId: 'c1', title: 'Activity 1 (File Upload)', format: 'classic', published: true, term: 'midterm' },
        { id: 'act-5', courseId: 'c1', title: 'Activity 5 (new Question Set)', format: 'questionset', questions: [], published: true, term: 'finals' },
      ],
      submissions: [],
    } as any;

    renderPage();

    const titles = screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent);
    expect(titles).toEqual([
      'Activity 5 (new Question Set)',
      'Activity 4 (No Criteria)',
      'Activity 3 (Both)',
      'Activity 2 (Text Entry)',
      'Activity 1 (File Upload)',
    ]);
  });
});

describe('ActivitiesView student submission badge', () => {
  beforeEach(() => {
    mocks.isLoading = false;
    mocks.isSyncing = false;
    mocks.activeRole = 'student';
    mocks.effectiveTerms = ['midterm', 'finals'];
    mocks.db = {
      activities: [
        {
          id: 'act-1',
          courseId: 'c1',
          title: 'Activity 1 (File Upload)',
          format: 'classic',
          published: true,
          term: 'midterm',
          pointsPossible: 20,
          category: 'Activities',
        },
        {
          id: 'act-2',
          courseId: 'c1',
          title: 'Activity 2 (Text Entry)',
          format: 'classic',
          published: true,
          term: 'midterm',
          pointsPossible: 100,
          category: 'Activities',
        },
      ],
      submissions: [
        // Rows loaded back from Likha ERP are keyed by the synthetic
        // `asg-activity-<id>` key rather than the raw activity id.
        {
          id: 'sub-1',
          activityKey: 'asg-activity-act-1',
          activityId: 'act-1',
          studentId: 'u-fac-1',
          submittedAt: new Date().toISOString(),
          submissionType: 'file',
          status: 'submitted',
          rubricScores: {},
          comments: [],
        },
        // In-session writes can carry the raw activity id instead.
        {
          id: 'sub-2',
          activityKey: 'act-2',
          activityId: 'act-2',
          studentId: 'u-fac-1',
          submittedAt: new Date().toISOString(),
          submissionType: 'online_text',
          status: 'submitted',
          rubricScores: {},
          comments: [],
        },
      ],
    } as any;
  });

  test('marks both key conventions as submitted instead of Not submitted', () => {
    renderPage();
    expect(screen.getAllByText('Submitted')).toHaveLength(2);
    expect(screen.queryByText('Not submitted')).not.toBeInTheDocument();
  });

  test('shows instructor feedback comments on the submission status card', () => {
    mocks.db = {
      activities: [
        {
          id: 'act-1',
          courseId: 'c1',
          title: 'Activity 1 (File Upload)',
          format: 'classic',
          published: true,
          term: 'midterm',
          pointsPossible: 20,
          category: 'Activities',
          submissionTypes: ['file'],
        },
      ],
      submissions: [
        {
          id: 'sub-1',
          activityKey: 'asg-activity-act-1',
          activityId: 'act-1',
          studentId: 'u-fac-1',
          submittedAt: new Date().toISOString(),
          submissionType: 'file',
          status: 'graded',
          grade: 15,
          rubricScores: {},
          comments: [
            {
              id: 'sc-1',
              authorId: 'u-fac-2',
              authorName: 'Raymund Dilan',
              authorRole: 'faculty',
              createdAt: new Date().toISOString(),
              text: 'Well explained, revise part 2.',
            },
          ],
        },
      ],
    } as any;

    renderPage('act-1');

    expect(screen.getByText('Instructor Feedback:')).toBeInTheDocument();
    expect(screen.getByText('Well explained, revise part 2.')).toBeInTheDocument();
    expect(screen.getByText('Raymund Dilan')).toBeInTheDocument();
  });

  test('falls back to the mirrored feedback note when the comment thread is unavailable', () => {
    mocks.db = {
      activities: [
        {
          id: 'act-1',
          courseId: 'c1',
          title: 'Activity 1 (File Upload)',
          format: 'classic',
          published: true,
          term: 'midterm',
          pointsPossible: 20,
          category: 'Activities',
          submissionTypes: ['file'],
        },
      ],
      submissions: [
        {
          id: 'sub-1',
          activityKey: 'asg-activity-act-1',
          activityId: 'act-1',
          studentId: 'u-fac-1',
          submittedAt: new Date().toISOString(),
          submissionType: 'file',
          status: 'graded',
          grade: 15,
          feedback: 'Pwede na',
          rubricScores: {},
          comments: [],
        },
      ],
    } as any;

    renderPage('act-1');

    expect(screen.getByText('Instructor Feedback:')).toBeInTheDocument();
    expect(screen.getByText('Pwede na')).toBeInTheDocument();
  });
});

describe('ActivitiesView text-only submission has no phantom attachment', () => {
  const textOnlyActivity = {
    id: 'act-text',
    courseId: 'c1',
    title: 'Lab 1 (Text Entry)',
    format: 'classic',
    published: true,
    term: 'midterm',
    pointsPossible: 50,
    category: 'Activities',
    submissionTypes: ['online_text'],
  };

  beforeEach(() => {
    mocks.isLoading = false;
    mocks.isSyncing = false;
    mocks.activeRole = 'student';
    mocks.effectiveTerms = ['midterm', 'finals'];
    mocks.submitActivity.mockReset();
  });

  test('does not list an Attached File for a text entry that has a stale legacy file name', () => {
    // Legacy row persisted a fabricated file_name with no real file behind it.
    mocks.db = {
      activities: [textOnlyActivity],
      submissions: [
        {
          id: 'sub-text',
          activityKey: 'act-text',
          activityId: 'act-text',
          studentId: 'u-fac-1',
          submittedAt: new Date().toISOString(),
          submissionType: 'online_text',
          status: 'submitted',
          content: 'Eto yung sagot ko',
          fileName: 'CMSC131_Lab_Submission.pdf',
          rubricScores: {},
          comments: [],
        },
      ],
    } as any;

    renderPage('act-text');

    expect(screen.getByText('Online Text Content & Code Submissions:')).toBeInTheDocument();
    expect(screen.queryByText(/Attached File/i)).not.toBeInTheDocument();
    expect(screen.queryByText('CMSC131_Lab_Submission.pdf')).not.toBeInTheDocument();
  });

  test('still lists the Attached File when a real file url exists', () => {
    mocks.db = {
      activities: [textOnlyActivity],
      submissions: [
        {
          id: 'sub-file',
          activityKey: 'act-file',
          activityId: 'act-file',
          studentId: 'u-fac-1',
          submittedAt: new Date().toISOString(),
          submissionType: 'file',
          status: 'submitted',
          fileName: 'Real_Submission.pdf',
          fileUrl: '/likha/assets/real-1',
          rubricScores: {},
          comments: [],
        },
      ],
    } as any;
    mocks.db.activities = [
      { ...textOnlyActivity, id: 'act-file', submissionTypes: ['file'] },
    ];

    renderPage('act-file');

    expect(screen.getByText('Attached File:')).toBeInTheDocument();
    expect(screen.getByText('Real_Submission.pdf')).toBeInTheDocument();
  });

  test('submits a text entry without fabricating a file name', async () => {
    mocks.db = { activities: [textOnlyActivity], submissions: [] } as any;

    renderPage('act-text');

    fireEvent.change(screen.getByPlaceholderText(/Paste your source code/i), {
      target: { value: 'Eto yung sagot ko' },
    });
    fireEvent.click(screen.getByText('Submit Activity to GABAY'));

    await waitFor(() => expect(mocks.submitActivity).toHaveBeenCalledTimes(1));
    const calls = mocks.submitActivity.mock.calls;
    expect(calls.length).toBe(1);
    const [activityId, submissionType, content, fileName] = calls[0];
    expect(activityId).toBe('act-text');
    expect(submissionType).toBe('online_text');
    expect(content).toBe('Eto yung sagot ko');
    expect(fileName).toBeUndefined();
  });
});

describe('ActivitiesView submitted text is visible and guarded before editing', () => {
  const textActivity = {
    id: 'act-text',
    courseId: 'c1',
    title: 'Lab 1 (Text Entry)',
    format: 'classic',
    published: true,
    term: 'midterm',
    pointsPossible: 50,
    category: 'Activities',
    submissionTypes: ['online_text'],
  };

  const submittedTextRow = {
    id: 'sub-text',
    activityKey: 'act-text',
    activityId: 'act-text',
    studentId: 'u-fac-1',
    submittedAt: new Date().toISOString(),
    submissionType: 'online_text',
    status: 'submitted',
    content: 'Eto yung sagot ko',
    rubricScores: {},
    comments: [],
  };

  beforeEach(() => {
    mocks.isLoading = false;
    mocks.isSyncing = false;
    mocks.activeRole = 'student';
    mocks.effectiveTerms = ['midterm', 'finals'];
    mocks.submitActivity.mockReset();
    mocks.showConfirm.mockReset();
    mocks.db = { activities: [textActivity], submissions: [submittedTextRow] } as any;
  });

  test('prefills the editable box with the previously submitted text', () => {
    renderPage('act-text');

    expect(screen.getByDisplayValue('Eto yung sagot ko')).toBeInTheDocument();
  });

  test('shows confirmation when clicking Resubmit Activity with a prior text response', () => {
    renderPage('act-text');

    const box = screen.getByDisplayValue('Eto yung sagot ko');
    fireEvent.change(box, { target: { value: 'Modified answer' } });

    const submitButton = screen.getByText('Resubmit Activity');
    fireEvent.click(submitButton);

    expect(mocks.showConfirm).toHaveBeenCalledTimes(1);
    expect(mocks.showConfirm).toHaveBeenCalledWith(
      'You already submitted a response for this activity. Resubmitting will replace your previous answer.',
      expect.any(Function),
      'Resubmit Activity?'
    );
  });

  test('does not resubmit when the confirmation is dismissed', () => {
    renderPage('act-text');

    const submitButton = screen.getByText('Resubmit Activity');
    fireEvent.click(submitButton);

    // Cancel by not calling the onConfirm callback
    expect(mocks.submitActivity).not.toHaveBeenCalled();
  });
});

describe('ActivitiesView scopes the text box to the selected activity', () => {
  const classicTextActivity = (id: string, title: string) => ({
    id,
    courseId: 'c1',
    title,
    format: 'classic',
    published: true,
    term: 'midterm',
    pointsPossible: 50,
    category: 'Activities',
    submissionTypes: ['online_text'],
  });

  beforeEach(() => {
    mocks.isLoading = false;
    mocks.isSyncing = false;
    mocks.activeRole = 'student';
    mocks.effectiveTerms = ['midterm', 'finals'];
    mocks.submitActivity.mockReset();
    mocks.showConfirm.mockReset();
    mocks.db = {
      activities: [
        classicTextActivity('act-a', 'Activity A (Text Entry)'),
        classicTextActivity('act-b', 'Activity B (Text Entry)'),
      ],
      submissions: [],
    } as any;
  });

  test('does not carry typed text into another activity', () => {
    const { rerender } = renderPage('act-a');

    fireEvent.change(screen.getByPlaceholderText(/Paste your source code/i), {
      target: { value: 'Eto yung sagot ko' },
    });
    expect(screen.getByPlaceholderText(/Paste your source code/i)).toHaveValue('Eto yung sagot ko');

    rerender(
      <ActivitiesView
        courseId="c1"
        selectedActivityId="act-b"
        onSelectActivity={() => {}}
        onBackToModules={() => {}}
      />
    );

    expect(screen.getByPlaceholderText(/Paste your source code/i)).toHaveValue('');
  });

  test('clears a submitted activity response when moving to a new activity', () => {
    mocks.db = {
      ...mocks.db,
      submissions: [
        {
          id: 'sub-a',
          activityKey: 'act-a',
          activityId: 'act-a',
          studentId: 'u-fac-1',
          submittedAt: new Date().toISOString(),
          submissionType: 'online_text',
          status: 'submitted',
          content: 'Eto yung sagot ko',
          rubricScores: {},
          comments: [],
        },
      ],
    };

    const { rerender } = renderPage('act-a');
    expect(screen.getByDisplayValue('Eto yung sagot ko')).toBeInTheDocument();

    rerender(
      <ActivitiesView
        courseId="c1"
        selectedActivityId="act-b"
        onSelectActivity={() => {}}
        onBackToModules={() => {}}
      />
    );

    expect(screen.getByPlaceholderText(/Paste your source code/i)).toHaveValue('');
  });
});
