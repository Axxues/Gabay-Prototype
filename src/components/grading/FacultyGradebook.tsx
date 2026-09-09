import React, { useState } from 'react';
import { useLMS } from '../../context/LMSContext';
import {
  FileSpreadsheet,
  Download,
  Search,
  Lock,
  Globe,
  Award
} from 'lucide-react';

interface FacultyGradebookProps {
  courseId: string;
}

export const FacultyGradebook: React.FC<FacultyGradebookProps> = ({ courseId }) => {
  const { db, gradeSubmission, openSpeedGrader } = useLMS();

  const course = db.courses.find(c => c.id === courseId);
  const courseAssignments = db.assignments.filter(a => a.courseId === courseId);
  const students = db.users.filter(u => u.role === 'student');

  const [postingPolicy, setPostingPolicy] = useState<'manual' | 'automatic'>('manual');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.studentId && s.studentId.includes(searchQuery))
  );

  const handleScoreEdit = (subId: string | undefined, val: string) => {
    const num = Number(val);
    if (isNaN(num)) return;

    if (subId) {
      const existing = db.submissions.find(s => s.id === subId);
      gradeSubmission(subId, num, existing?.rubricScores || {}, "Direct score edit in Gradebook spreadsheet.");
    } else {
      const newSubId = `sub-${Date.now()}`;
      gradeSubmission(newSubId, num, {}, "Direct score edit in Gradebook spreadsheet.");
    }
  };

  const handleExportCSV = () => {
    alert("Exporting official GABAY Gradebook CSV file for Likha ERP sync...");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-border gap-4">
        <div>
          <h2 className="heading-3 text-foreground flex items-center space-x-2">
            <FileSpreadsheet className="w-5 h-5 text-pink-700 dark:text-pink-400" />
            <span>Faculty Gradebook Matrix</span>
          </h2>
          <p className="text-xs text-muted-foreground font-mono">
            {course?.code} ({course?.section}) • High-Density Assessment Grid
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setPostingPolicy(prev => (prev === 'manual' ? 'automatic' : 'manual'))}
            className="px-3.5 py-2 rounded-xl border border-border text-xs font-mono font-bold flex items-center space-x-2 transition-all bg-card text-foreground hover:bg-muted shadow-soft active:scale-[0.98]"
          >
            {postingPolicy === 'manual' ? (
              <>
                <Lock className="w-3.5 h-3.5 text-amber-500" />
                <span>Policy: Manual Posting</span>
              </>
            ) : (
              <>
                <Globe className="w-3.5 h-3.5 text-emerald-500" />
                <span>Policy: Automatic Posting</span>
              </>
            )}
          </button>

          <button
            onClick={handleExportCSV}
            className="px-4 py-2 text-xs font-bold bg-pink-700 hover:bg-pink-800 text-white rounded-xl transition-all flex items-center space-x-1.5 shadow-subtle active:scale-[0.98]"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="flex items-center space-x-3 max-w-md">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search student by name or ID (e.g. 2021-SLUC)..."
            className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl text-xs font-mono text-foreground focus:outline-hidden focus:ring-2 focus:ring-pink-600/30 shadow-subtle"
          />
        </div>
      </div>

      {/* Spreadsheet Matrix Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-subtle">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/50 font-mono text-muted-foreground">
                <th className="p-3.5 border-r border-border min-w-[220px]">
                  Student Roster Name & ID
                </th>
                {courseAssignments.map(asg => (
                  <th key={asg.id} className="p-3.5 border-r border-border text-center min-w-[150px]">
                    <div className="font-bold text-foreground truncate max-w-[140px] mx-auto">
                      {asg.title}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-normal mt-0.5">
                      Out of {asg.pointsPossible} pts ({asg.weight}%)
                    </div>
                  </th>
                ))}
                <th className="p-3.5 text-center min-w-[130px] font-bold text-pink-700 dark:text-pink-400">
                  Calculated Total %
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredStudents.map(student => {
                let totalEarned = 0;
                let totalPossible = 0;

                return (
                  <tr key={student.id} className="hover:bg-muted/40 transition-colors">
                    <td className="p-3.5 border-r border-border font-bold text-foreground">
                      <div className="flex items-center space-x-2.5">
                        <img src={student.avatar} alt={student.name} className="w-7 h-7 rounded-full object-cover border border-border shadow-soft" />
                        <div>
                          <div>{student.name}</div>
                          <div className="text-[10px] font-mono text-muted-foreground">{student.studentId || '2021-SLUC-0492'}</div>
                        </div>
                      </div>
                    </td>

                    {courseAssignments.map(asg => {
                      const sub = db.submissions.find(
                        s => s.assignmentId === asg.id && s.studentId === student.id
                      );

                      if (sub?.grade !== undefined) {
                        totalEarned += (sub.grade / asg.pointsPossible) * asg.weight;
                        totalPossible += asg.weight;
                      }

                      return (
                        <td key={asg.id} className="p-2.5 border-r border-border text-center">
                          <div className="flex items-center justify-center space-x-1.5">
                            <input
                              type="number"
                              min={0}
                              max={asg.pointsPossible}
                              value={sub?.grade ?? ''}
                              onChange={e => handleScoreEdit(sub?.id, e.target.value)}
                              placeholder="-"
                              className="w-16 p-2 bg-background border border-border rounded-lg text-center font-mono text-xs font-bold text-foreground focus:outline-hidden focus:ring-2 focus:ring-pink-600/30 shadow-soft"
                            />
                            {sub && (
                              <button
                                title="Open SpeedGrader for this submission"
                                onClick={() => openSpeedGrader(sub.id)}
                                className="p-1 text-muted-foreground hover:text-pink-600 transition-colors"
                              >
                                <Award className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      );
                    })}

                    <td className="p-3.5 text-center font-mono font-extrabold text-sm text-emerald-600 dark:text-emerald-400">
                      {totalPossible > 0
                        ? `${Math.round((totalEarned / totalPossible) * 100)}%`
                        : 'N/A'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
