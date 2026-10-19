import React, { useState } from 'react';
import { useLMS } from '../../shared/context/LMSContext';
import type { TermId } from '../../shared/types/lms';
import { normalizeTermId } from '../../shared/utils/gradingTerms';
import { TERM_LABELS, TermFilterSelect } from '../../shared/components/common/TermSelect';
import {
  Briefcase,
  Users,
  User,
  Clock,
  CheckCircle2,
  Upload,
  Award,
  Send,
  Plus,
  Trash2,
  ArrowLeft,
  Calendar,
  Globe,
  Code
} from 'lucide-react';
import { PageHeader } from '../../shared/components/common/PageHeader';
import { EmptyState } from '../../shared/components/common/EmptyState';
import { CreateProjectPage } from './CreateProjectPage';
import { canManageCourseContent } from '../../shared/utils/roles';

interface ProjectsViewProps {
  courseId: string;
  selectedProjectId: string | null;
  onSelectProject: (id: string | null) => void;
  onBackToModules?: () => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  courseId,
  selectedProjectId,
  onSelectProject,
  onBackToModules,
}) => {
  const {
    activeRole,
    activeUser,
    db,
    submitActivity,
    deleteActivity,
    openSpeedGrader,
    showAlert,
    showConfirm,
    effectiveTermsForCourse,
  } = useLMS();

  const [termFilter, setTermFilter] = useState<'all' | TermId>('all');
  const [repoUrl, setRepoUrl] = useState('');
  const [demoUrl, setDemoUrl] = useState('');
  const [textContent, setTextContent] = useState('');
  const [simulatedFileName, setSimulatedFileName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const currentCourse = (db.courses || []).find(c => c.id === courseId);
  const isAssignedInstructor = canManageCourseContent(currentCourse, activeUser);

  const effectiveTerms: TermId[] =
    courseId && typeof effectiveTermsForCourse === 'function'
      ? effectiveTermsForCourse(courseId)
      : ['prelim', 'midterm', 'finals'];

  const courseProjects = (db.activities || []).filter(
    a => a.courseId === courseId && a.assessmentType === 'project'
  );

  const visibleProjects = courseProjects.filter(a => {
    if (activeRole === 'student' && !a.published) return false;
    if (termFilter !== 'all' && (normalizeTermId(a.term) ?? 'midterm') !== termFilter) return false;
    return true;
  });

  const selectedProject = selectedProjectId
    ? courseProjects.find(a => a.id === selectedProjectId)
    : null;

  const currentSubmission = selectedProject
    ? (db.submissions || []).find(
        s => (s.activityId === selectedProject.id || s.activityKey === selectedProject.id) && s.studentId === activeUser.id
      )
    : undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;

    if (selectedProject.metadata?.repositoryUrlRequired && !repoUrl.trim()) {
      showAlert('Repository URL is required for this project.');
      return;
    }

    const compiledContent = [
      repoUrl.trim() ? `Repository: ${repoUrl.trim()}` : null,
      demoUrl.trim() ? `Demo: ${demoUrl.trim()}` : null,
      textContent.trim() ? textContent.trim() : null,
    ]
      .filter(Boolean)
      .join('\n\n');

    if (!compiledContent && !simulatedFileName) {
      showAlert('Please provide project submission details or attach files.');
      return;
    }

    setIsSubmitting(true);
    try {
      await submitActivity(
        selectedProject.id,
        simulatedFileName ? 'file' : 'online_text',
        compiledContent,
        simulatedFileName || 'Project_Deliverable.zip'
      );
      showAlert({
        title: 'Project Submitted',
        message: 'Your project deliverable has been recorded successfully.',
        type: 'success',
      });
    } catch {
      // Handled in submitActivity
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    if (!isAssignedInstructor) return;
    showConfirm(
      'Are you sure you want to delete this project and all associated student submissions?',
      () => {
        deleteActivity(id)
          .then(() => onSelectProject(null))
          .catch(() => {});
      },
      'Delete Project'
    );
  };

  if (isCreating && isAssignedInstructor) {
    return (
      <CreateProjectPage
        courseId={courseId}
        onBack={() => setIsCreating(false)}
        onCreated={id => {
          setIsCreating(false);
          onSelectProject(id);
        }}
      />
    );
  }

  // List view
  if (!selectedProject) {
    return (
      <div className="space-y-6 animate-fade-in">
        {onBackToModules && (
          <button
            type="button"
            onClick={onBackToModules}
            className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors flex items-center space-x-1.5 cursor-pointer -mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Modules</span>
          </button>
        )}

        <PageHeader
          eyebrow="COURSE ASSESSMENTS"
          title="Projects"
          description="Capstone projects, team deliverables, and technical portfolios"
          actions={
            <div className="flex items-center gap-2">
              <TermFilterSelect
                terms={effectiveTerms}
                value={termFilter}
                onChange={v => setTermFilter(v as 'all' | TermId)}
              />
              {isAssignedInstructor && (
                <button
                  type="button"
                  onClick={() => setIsCreating(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-primary text-primary-foreground rounded-xl shadow-sm hover:opacity-95 transition-all cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Create Project</span>
                </button>
              )}
            </div>
          }
        />

        {visibleProjects.length === 0 ? (
          <EmptyState
            icon={<Briefcase className="h-8 w-8 text-muted-foreground" />}
            title="No projects found"
            body={
              activeRole === 'student'
                ? 'No projects have been assigned yet.'
                : 'Click "Create Project" to set up a new project deliverable.'
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {visibleProjects.map(project => {
              const mySub = (db.submissions || []).find(
                s => (s.activityId === project.id || s.activityKey === project.id) && s.studentId === activeUser.id
              );
              const subs = (db.submissions || []).filter(
                s => s.activityId === project.id || s.activityKey === project.id
              );
              const pendingGradeCount = subs.filter(s => s.status === 'submitted').length;
              const isGroup = project.metadata?.groupMode === 'group';
              const normTerm = normalizeTermId(project.term);

              return (
                <div
                  key={project.id}
                  onClick={() => onSelectProject(project.id)}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="rounded-xl border border-border bg-emerald-500/10 p-2.5 text-emerald-600 dark:text-emerald-400 mt-0.5">
                      <Briefcase className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-primary/10 text-primary">
                          {normTerm ? TERM_LABELS[normTerm] : (project.term || 'Midterm')}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 flex items-center gap-1">
                          {isGroup ? <Users className="h-3 w-3" /> : <User className="h-3 w-3" />}
                          {isGroup ? 'Group Project' : 'Individual'}
                        </span>
                        {!project.published && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600">
                            Draft
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold truncate">{project.title}</h3>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Award className="h-3 w-3" />
                          {project.pointsPossible} pts
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {project.dueDate
                            ? `Due ${new Date(project.dueDate).toLocaleDateString()}`
                            : 'No due date'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {activeRole === 'student' ? (
                      mySub ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {mySub.status === 'graded' ? `Graded: ${mySub.grade ?? 0}/${project.pointsPossible}` : 'Submitted'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-full">
                          <Clock className="h-3.5 w-3.5" />
                          Pending
                        </span>
                      )
                    ) : (
                      <span className="text-xs text-muted-foreground bg-accent px-2.5 py-1 rounded-full font-medium">
                        {subs.length} submissions {pendingGradeCount > 0 && `(${pendingGradeCount} to grade)`}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Detail & Submission View
  return (
    <div className="space-y-6 max-w-4xl animate-fade-in">
      <button
        type="button"
        onClick={() => onSelectProject(null)}
        className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground cursor-pointer"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Back to Projects</span>
      </button>

      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-primary/10 text-primary">
                {normalizeTermId(selectedProject.term) ? TERM_LABELS[normalizeTermId(selectedProject.term)!] : (selectedProject.term || 'Midterm')}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600">
                {selectedProject.metadata?.groupMode === 'group' ? 'Group Project' : 'Individual'}
              </span>
              <span className="text-xs text-muted-foreground font-semibold">
                {selectedProject.pointsPossible} Points
              </span>
            </div>
            <h1 className="text-xl font-extrabold">{selectedProject.title}</h1>
          </div>

          {activeRole !== 'student' && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const subs = (db.submissions || []).filter(
                    s => s.activityId === selectedProject.id || s.activityKey === selectedProject.id
                  );
                  if (subs.length > 0) openSpeedGrader(subs[0].id);
                  else showAlert('No student submissions to grade yet.');
                }}
                className="flex items-center gap-1.5 rounded-xl bg-accent px-3 py-1.5 text-xs font-bold hover:bg-accent/80 cursor-pointer"
              >
                <Users className="h-3.5 w-3.5" />
                <span>SpeedGrader</span>
              </button>
              {isAssignedInstructor && (
                <button
                  type="button"
                  onClick={() => handleDelete(selectedProject.id)}
                  className="p-1.5 rounded-xl text-destructive hover:bg-destructive/10 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="prose prose-sm dark:prose-invert max-w-none pt-2 border-t border-border">
          <p className="whitespace-pre-line text-sm text-foreground/90">{selectedProject.instructions}</p>
        </div>

        {selectedProject.rubric && selectedProject.rubric.length > 0 && (
          <div className="pt-4 border-t border-border space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Rubric Criteria</h3>
            <div className="space-y-2">
              {selectedProject.rubric.map(r => (
                <div key={r.id} className="rounded-xl border border-border p-3 text-xs bg-accent/30 flex justify-between items-start">
                  <div>
                    <div className="font-bold">{r.title}</div>
                    <div className="text-muted-foreground mt-0.5">{r.description}</div>
                  </div>
                  <div className="font-bold text-primary shrink-0 ml-4">{r.points} pts</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Student Submission Card */}
      {activeRole === 'student' && (
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider">
            {currentSubmission ? 'Your Project Submission' : 'Submit Project Deliverable'}
          </h2>

          {currentSubmission ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" />
                  Submitted on {new Date(currentSubmission.submittedAt).toLocaleString()}
                </span>
                {currentSubmission.grade !== undefined && currentSubmission.grade !== null && (
                  <span className="text-xs font-black text-primary">
                    Grade: {currentSubmission.grade}/{selectedProject.pointsPossible}
                  </span>
                )}
              </div>
              {currentSubmission.content && (
                <div className="text-xs text-foreground/90 whitespace-pre-wrap p-3 rounded-lg bg-background border border-border">
                  {currentSubmission.content}
                </div>
              )}
              {currentSubmission.fileName && (
                <div className="text-xs font-mono text-muted-foreground">
                  Attached file: {currentSubmission.fileName}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1 flex items-center gap-1">
                    <Code className="h-3.5 w-3.5" />
                    Repository URL (GitHub / GitLab)
                  </label>
                  <input
                    type="url"
                    placeholder="https://github.com/organization/project"
                    value={repoUrl}
                    onChange={e => setRepoUrl(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1 flex items-center gap-1">
                    <Globe className="h-3.5 w-3.5" />
                    Live Demo URL (Optional)
                  </label>
                  <input
                    type="url"
                    placeholder="https://project-demo.vercel.app"
                    value={demoUrl}
                    onChange={e => setDemoUrl(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">
                    Project Notes & Architecture Overview
                  </label>
                  <textarea
                    rows={4}
                    value={textContent}
                    onChange={e => setTextContent(e.target.value)}
                    placeholder="Summary of completed milestones and notes for evaluator..."
                    className="w-full rounded-xl border border-border bg-background p-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1 flex items-center gap-1">
                    <Upload className="h-3.5 w-3.5" />
                    Deliverable Archive / Documentation (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Attach file (e.g. project-report.pdf or deliverable.zip)"
                    value={simulatedFileName}
                    onChange={e => setSimulatedFileName(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-95 cursor-pointer disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                <span>{isSubmitting ? 'Submitting...' : 'Submit Project'}</span>
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
};
