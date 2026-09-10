import React, { useState } from 'react';
import { useLMS } from '../context/LMSContext';
import {
  BookOpen,
  Mail,
  FileText,
  Shield,
  RefreshCw,
  ArrowLeft,
  Search,
  CheckCircle2,
  ExternalLink,
  ChevronDown,
  Phone,
  Clock,
  Layers,
  Award
} from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';

interface HelpPageProps {
  onNavigateTab?: (tab: string) => void;
}

export const HelpPage: React.FC<HelpPageProps> = ({ onNavigateTab }) => {
  const { resetData, showAlert, showConfirm } = useLMS();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFaqId, setActiveFaqId] = useState<number | null>(null);
  const [resetAlert, setResetAlert] = useState(false);

  const faqs = [
    {
      id: 1,
      question: "How do faculty instructors assess student submissions using SpeedGrader™?",
      answer: "Navigate to your assigned course shell, select Assignments, and click 'Launch SpeedGrader' next to any pending submission. You can review the attached document, enter scores directly into CHED-compliant rubric criteria, type private feedback comments, and post grades directly to the faculty gradebook matrix."
    },
    {
      id: 2,
      question: "How does the student 'What-If' grade calculator work?",
      answer: "Under the student Grades tab, students can move interactive range sliders next to unsubmitted or hypothetical assignments to simulate score projections. The calculated total course grade updates in real-time, allowing students to test passing requirements or honor standing without modifying actual instructor records."
    },
    {
      id: 3,
      question: "How does GABAY LMS enforce CHED CMO 25 s. 2015 OBE compliance?",
      answer: "Every syllabus and course shell has Course Learning Outcomes (CLOs) mapped to program educational objectives. Modules, assignments, and speedgrader rubrics link directly to specific CLO competencies to generate institutional compliance evidence for accreditation."
    },
    {
      id: 4,
      question: "How is student data privacy protected under RA 10173?",
      answer: "Role-Based Access Control (RBAC) strictly prevents unauthorized visibility. Non-teaching staff are restricted to enrollment metrics and audit timestamps; students can only view their own submissions and grades; and faculty can only view course shells to which they are assigned as instructor of record."
    },
    {
      id: 5,
      question: "How can faculty configure office hours and academic advising slots?",
      answer: "On the Calendar tab, faculty members can click '+ Advising Slot' to open 30-minute advising time blocks specifying physical room or virtual meeting locations. Students can book open slots with a single click."
    }
  ];

  const filteredFaqs = faqs.filter(
    f =>
      f.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleReset = () => {
    showConfirm(
      "Reset prototype data back to the initial seed state? This will clear any newly created courses, submissions, or custom entries.",
      () => {
        resetData();
        setResetAlert(true);
        setTimeout(() => setResetAlert(false), 4000);
      },
      "Reset Database"
    );
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 animate-fade-in pb-16 select-none">
      {/* Top Header Bar */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => onNavigateTab && onNavigateTab('dashboard')}
          className="p-2 bg-card border border-border hover:bg-muted text-muted-foreground hover:text-foreground rounded-xl transition-all shadow-subtle cursor-pointer active:scale-[0.98] shrink-0 mt-0.5"
          title="Back to Dashboard"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <PageHeader
            title="Help & Support"
            description="Frequently asked questions and guides."
            actions={
              <span className="px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-sans font-bold text-emerald-700 dark:text-emerald-400 self-start sm:self-auto shadow-soft">
                All Services Operational
              </span>
            }
          />
        </div>
      </div>

      {resetAlert && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center space-x-2 text-xs font-sans font-bold text-emerald-700 dark:text-emerald-400 animate-fade-in shadow-soft">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>GABAY prototype seed database has been successfully reset to initial factory state!</span>
        </div>
      )}

      {/* Search Input */}
      <div className="p-4 bg-card border border-border rounded-2xl shadow-subtle">
        <div className="relative max-w-xl">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search guides, policies, or frequently asked questions..."
            className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl text-xs font-sans text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 shadow-inner"
          />
        </div>
      </div>

      {/* 2-Column Grid: Manuals & Support */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Official Documentation */}
        <div className="p-6 bg-card border border-border rounded-2xl shadow-subtle space-y-4">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-4 h-4 text-primary" />
            <h2 className="font-bold text-sm text-foreground uppercase tracking-wider text-[11px]">
              DMMMSU-SLUC Academic User Manuals
            </h2>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Download or view comprehensive instructional documentation for faculty authoring and student learning activities.
          </p>

          <div className="space-y-2.5 pt-2">
            <a
              href="#faculty-manual"
              onClick={e => {
                e.preventDefault();
                showAlert({
                  title: "Documentation",
                  message: "Downloading GABAY Faculty Guide v2.4 (PDF)...",
                  type: "info"
                });
              }}
              className="p-3.5 rounded-xl border border-border bg-muted/30 hover:bg-muted/60 flex items-center justify-between transition-all group card-hover"
            >
              <div className="flex items-center space-x-3">
                <FileText className="w-4 h-4 text-primary" />
                <div>
                  <h4 className="font-bold text-xs text-foreground group-hover:text-primary transition-colors">
                    Faculty LMS Authoring & SpeedGrader Guide
                  </h4>
                  <p className="text-[10px] font-sans text-muted-foreground mt-0.5">
                    Covers rubrics, gradebook calculations, and OBE matrix mapping
                  </p>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </a>

            <a
              href="#student-manual"
              onClick={e => {
                e.preventDefault();
                showAlert({
                  title: "Documentation",
                  message: "Downloading GABAY Student Guide v2.4 (PDF)...",
                  type: "info"
                });
              }}
              className="p-3.5 rounded-xl border border-border bg-muted/30 hover:bg-muted/60 flex items-center justify-between transition-all group card-hover"
            >
              <div className="flex items-center space-x-3">
                <Award className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <div>
                  <h4 className="font-bold text-xs text-foreground group-hover:text-primary transition-colors">
                    Student Orientation & What-If Calculator Manual
                  </h4>
                  <p className="text-[10px] font-sans text-muted-foreground mt-0.5">
                    Assignment submissions, quiz taking, and grade projections
                  </p>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </a>

            <a
              href="#ched-matrix"
              onClick={e => {
                e.preventDefault();
                showAlert({
                  title: "Documentation",
                  message: "Opening CHED CMO 25 s. 2015 Accreditation Framework Document...",
                  type: "info"
                });
              }}
              className="p-3.5 rounded-xl border border-border bg-muted/30 hover:bg-muted/60 flex items-center justify-between transition-all group card-hover"
            >
              <div className="flex items-center space-x-3">
                <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <h4 className="font-bold text-xs text-foreground group-hover:text-primary transition-colors">
                    CHED CMO 25 s. 2015 Curriculum Matrix
                  </h4>
                  <p className="text-[10px] font-sans text-muted-foreground mt-0.5">
                    Outcome-Based Education BS Computer Science syllabus specs
                  </p>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </a>
          </div>
        </div>

        {/* Card 2: ICT Support & Ticketing Desk */}
        <div className="p-6 bg-card border border-border rounded-2xl shadow-subtle space-y-4">
          <div className="flex items-center space-x-2">
            <Mail className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="font-bold text-sm text-foreground uppercase tracking-wider text-[11px]">
              DMMMSU ICT Services Ticketing Desk
            </h2>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Direct support contact channels for account authentication, password recovery, or LMS system troubleshooting.
          </p>

          <div className="space-y-3 pt-2 text-xs">
            <div className="p-3.5 bg-muted/30 rounded-xl border border-border space-y-1">
              <div className="flex items-center space-x-2 text-muted-foreground">
                <Mail className="w-3.5 h-3.5 text-primary" />
                <span className="font-bold text-foreground">ICT Services Email Support</span>
              </div>
              <p className="font-sans text-foreground font-semibold text-[11px] pl-5.5">
                it.support@dmmmsu.edu.ph
              </p>
            </div>

            <div className="p-3.5 bg-muted/30 rounded-xl border border-border space-y-1">
              <div className="flex items-center space-x-2 text-muted-foreground">
                <Phone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="font-bold text-foreground">Campus Helpdesk Hotline</span>
              </div>
              <p className="font-sans text-foreground font-semibold text-[11px] pl-5.5">
                +63 (072) 710-0492 / Local Ext. 402
              </p>
            </div>

            <div className="p-3.5 bg-muted/30 rounded-xl border border-border space-y-1">
              <div className="flex items-center space-x-2 text-muted-foreground">
                <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span className="font-bold text-foreground">Physical Office Hours</span>
              </div>
              <p className="text-[11px] text-muted-foreground pl-5.5">
                Monday to Friday • 8:00 AM to 5:00 PM (SLUC ICT Center, 2nd Floor)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Compliance & Security Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-5 bg-card border border-border rounded-2xl shadow-subtle space-y-2">
          <div className="flex items-center space-x-2 font-bold text-sm text-foreground">
            <FileText className="w-4 h-4 text-primary" />
            <span>CHED CMO 25 s. 2015 Compliance Guard</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            All course shells, grading weights, and syllabi conform to the Commission on Higher Education (CHED) Policies, Standards and Guidelines for the Bachelor of Science in Computer Science (BSCS) program.
          </p>
        </div>

        <div className="p-5 bg-card border border-border rounded-2xl shadow-subtle space-y-2">
          <div className="flex items-center space-x-2 font-bold text-sm text-foreground">
            <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>Republic Act 10173 (Data Privacy Act)</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Student assignment payloads, individual grades, private instructor annotations, and identity records are guarded by strict role-based access control and encrypted session transport.
          </p>
        </div>
      </div>

      {/* Frequently Asked Questions (Accordion) */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-subtle space-y-4">
        <h2 className="font-bold text-sm text-foreground uppercase tracking-wider text-[11px]">
          Frequently Asked Questions (FAQ)
        </h2>

        <div className="space-y-2.5">
          {filteredFaqs.map(faq => {
            const isOpen = activeFaqId === faq.id;
            return (
              <div
                key={faq.id}
                className="border border-border rounded-xl overflow-hidden bg-muted/20 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => setActiveFaqId(isOpen ? null : faq.id)}
                  className="w-full p-4 flex items-center justify-between text-left font-bold text-xs text-foreground hover:bg-muted/40 transition-colors cursor-pointer"
                >
                  <span>{faq.question}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ease-out shrink-0 ml-2 ${
                      isOpen ? 'rotate-180' : 'rotate-0'
                    }`}
                  />
                </button>
                <div
                  className={`grid transition-all duration-300 ease-in-out overflow-hidden ${
                    isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                  }`}
                >
                  <div className="overflow-hidden min-h-0">
                    <div className="p-4 pt-1 text-xs text-muted-foreground leading-relaxed border-t border-border/50">
                      {faq.answer}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Prototype Reset Card */}
      <div className="p-6 bg-card border border-border rounded-2xl shadow-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="font-bold text-sm text-foreground uppercase tracking-wider text-[11px]">
            Prototype Database Management
          </h3>
          <p className="text-xs text-muted-foreground">
            Reset mock courses, assignments, quizzes, and submissions back to initial seed data.
          </p>
        </div>
        <button
          onClick={handleReset}
          className="inline-flex items-center space-x-2 px-4 py-2.5 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl transition-all shadow-primary-sm active:scale-[0.98] cursor-pointer shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reset Mock Database</span>
        </button>
      </div>
    </div>
  );
};
