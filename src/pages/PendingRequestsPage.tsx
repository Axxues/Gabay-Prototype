import React, { useState } from 'react';
import { useLMS } from '../context/LMSContext';
import { PageHeader } from '../components/common/PageHeader';
import { CheckCircle, XCircle, UserPlus, Search } from 'lucide-react';

interface PendingRequestsPageProps {
  courseId: string;
}

export const PendingRequestsPage: React.FC<PendingRequestsPageProps> = ({ courseId }) => {
  const { db, approveEnrollmentRequests, rejectEnrollmentRequests, showAlert } = useLMS();
  const course = db.courses.find(c => c.id === courseId);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const allRequests = db.enrollmentRequests.filter(r => r.courseId === courseId);
  const pendingRequests = allRequests.filter(r => r.status === 'pending');

  const filteredRequests = pendingRequests.filter(r => {
    const q = searchQuery.toLowerCase();
    return r.studentName.toLowerCase().includes(q) || r.type.toLowerCase().includes(q);
  });

  const handleToggle = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleApproveSelected = () => {
    if (selectedIds.length === 0) return;
    approveEnrollmentRequests(selectedIds);
    showAlert({
      title: 'Requests Approved',
      message: `${selectedIds.length} student(s) approved. They can now select their section.`,
      type: 'success'
    });
    setSelectedIds([]);
  };

  const handleApproveAll = () => {
    const allIds = filteredRequests.map(r => r.id);
    approveEnrollmentRequests(allIds);
    showAlert({
      title: 'All Requests Approved',
      message: `${allIds.length} student(s) approved.`,
      type: 'success'
    });
  };

  const handleReject = (ids: string[]) => {
    rejectEnrollmentRequests(ids);
    showAlert({ title: 'Requests Rejected', message: `${ids.length} request(s) rejected.`, type: 'warning' });
    setSelectedIds(prev => prev.filter(i => !ids.includes(i)));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Pending Enrollment Requests"
        description={`${pendingRequests.length} pending request(s) for ${course?.code || 'course'}`}
        actions={
          <div className="flex gap-2">
            {selectedIds.length > 0 && (
              <>
                <button onClick={handleApproveSelected} className="px-3 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl cursor-pointer">
                  Approve Selected ({selectedIds.length})
                </button>
                <button onClick={() => handleReject(selectedIds)} className="px-3 py-2 text-xs font-bold bg-red-500/10 text-red-600 hover:bg-red-500/20 rounded-xl cursor-pointer">
                  Reject Selected
                </button>
              </>
            )}
            {filteredRequests.length > 0 && (
              <button onClick={handleApproveAll} className="px-3 py-2 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl cursor-pointer">
                Approve All
              </button>
            )}
          </div>
        }
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search students..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {filteredRequests.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <UserPlus className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No pending requests</p>
          <p className="text-xs mt-1">All enrollment requests have been processed.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="p-3 text-left w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === filteredRequests.length && filteredRequests.length > 0}
                    onChange={() => {
                      if (selectedIds.length === filteredRequests.length) setSelectedIds([]);
                      else setSelectedIds(filteredRequests.map(r => r.id));
                    }}
                    className="rounded cursor-pointer"
                  />
                </th>
                <th className="p-3 text-left font-bold text-xs">Student</th>
                <th className="p-3 text-left font-bold text-xs">Type</th>
                <th className="p-3 text-left font-bold text-xs">Requested</th>
                <th className="p-3 text-right font-bold text-xs">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map(req => (
                <tr key={req.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(req.id)}
                      onChange={() => handleToggle(req.id)}
                      className="rounded cursor-pointer"
                    />
                  </td>
                  <td className="p-3">
                    <div className="font-semibold text-xs">{req.studentName}</div>
                    <div className="text-[11px] text-muted-foreground">{req.studentId}</div>
                  </td>
                  <td className="p-3">
                    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      req.type === 'self_join' ? 'bg-blue-500/10 text-blue-600' : 'bg-purple-500/10 text-purple-600'
                    }`}>
                      {req.type === 'self_join' ? 'Self-Join' : 'Faculty Enroll'}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {new Date(req.requestedAt).toLocaleDateString()}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => approveEnrollmentRequests([req.id])}
                        className="p-1.5 hover:bg-emerald-500/10 rounded-lg text-emerald-600 cursor-pointer"
                        title="Approve"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleReject([req.id])}
                        className="p-1.5 hover:bg-red-500/10 rounded-lg text-red-500 cursor-pointer"
                        title="Reject"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
