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

  // Grade posting policy state: 'manual' | 'automatic'
  const [postingPolicy, setPostingPolicy] = useState<'manual' | 'automatic'>('manual');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter students by search
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
      // Create new submission entry
      const newSubId = `sub-${Date.now()}`;
      gradeSubmission(newSubId, num, {}, "Direct score edit in Gradebook spreadsheet.");
    }
  };

  const handleExportCSV = () => {
    alert("Exporting official GABAY Gradebook CSV file for Likha ERP sync...");
  };

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800 gap-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center space-x-2">
            <FileSpreadsheet className="w-5 h-5 text-red-700 dark:text-red-400" />
            <span>Faculty Gradebook Matrix</span>
          </h2>
          <p className="text-xs text-zinc-500 font-mono">
            {course?.code} ({course?.section}) • High-Density Assessment Grid
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-3">
          {/* Posting Policy Selector */}
          <button
            onClick={() => setPostingPolicy(prev => (prev === 'manual' ? 'automatic' : 'manual'))}
            className="px-3 py-1.5 rounded border text-xs font-mono font-semibold flex items-center space-x-1.5 transition-colors bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            {postingPolicy === 'manual' ? (
              <>
                <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Policy: Manual Posting</span>
              </>
            ) : (
              <>
                <Globe className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Policy: Automatic Posting</span>
              </>
            )}
          </button>

          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 text-xs font-semibold bg-red-800 hover:bg-red-900 text-white rounded transition-colors flex items-center space-x-1.5 shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center space-x-3 max-w-md">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search student by name or ID (e.g. 2021-SLUC)..."
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-red-600"
          />
        </div>
      </div>

      {/* High-Density Spreadsheet Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950 font-mono text-zinc-600 dark:text-zinc-400">
                <th className="p-3 border-r border-zinc-200 dark:border-zinc-800 min-w-[200px]">
                  Student Roster Name & ID
                </th>
                {courseAssignments.map(asg => (
                  <th key={asg.id} className="p-3 border-r border-zinc-200 dark:border-zinc-800 text-center min-w-[140px]">
                    <div className="font-bold text-zinc-900 dark:text-zinc-100 truncate max-w-[130px] mx-auto">
                      {asg.title}
                    </div>
                    <div className="text-[10px] text-zinc-500 font-normal mt-0.5">
                      Out of {asg.pointsPossible} pts ({asg.weight}%)
                    </div>
                  </th>
                ))}
                <th className="p-3 text-center min-w-[120px] font-bold text-red-700 dark:text-red-400">
                  Calculated Total %
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {filteredStudents.map(student => {
                let totalEarned = 0;
                let totalPossible = 0;

                return (
                  <tr key={student.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-950/80">
                    {/* Student Name */}
                    <td className="p-3 border-r border-zinc-200 dark:border-zinc-800 font-semibold text-zinc-900 dark:text-zinc-100">
                      <div className="flex items-center space-x-2">
                        <img src={student.avatar} alt={student.name} className="w-6 h-6 rounded-full object-cover border border-zinc-300" />
                        <div>
                          <div>{student.name}</div>
                          <div className="text-[10px] font-mono text-zinc-500">{student.studentId || '2021-SLUC-0492'}</div>
                        </div>
                      </div>
                    </td>

                    {/* Assignment Grade Cells */}
                    {courseAssignments.map(asg => {
                      const sub = db.submissions.find(
                        s => s.assignmentId === asg.id && s.studentId === student.id
                      );

                      if (sub?.grade !== undefined) {
                        totalEarned += (sub.grade / asg.pointsPossible) * asg.weight;
                        totalPossible += asg.weight;
                      }

                      return (
                        <td key={asg.id} className="p-2 border-r border-zinc-200 dark:border-zinc-800 text-center">
                          <div className="flex items-center justify-center space-x-1">
                            <input
                              type="number"
                              min={0}
                              max={asg.pointsPossible}
                              value={sub?.grade ?? ''}
                              onChange={e => handleScoreEdit(sub?.id, e.target.value)}
                              placeholder="-"
                              className="w-16 p-1.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded text-center font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-red-600"
                            />
                            {sub && (
                              <button
                                title="Open SpeedGrader for this submission"
                                onClick={() => openSpeedGrader(sub.id)}
                                className="p-1 text-zinc-400 hover:text-red-600 transition-colors"
                              >
                                <Award className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      );
                    })}

                    {/* Final Grade Calculation Cell */}
                    <td className="p-3 text-center font-mono font-bold text-sm text-emerald-700 dark:text-emerald-400">
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
