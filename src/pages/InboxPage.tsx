import React, { useState } from 'react';
import { useLMS } from '../context/LMSContext';
import { Inbox as InboxIcon, Plus, X } from 'lucide-react';
import { AnimatedModal } from '../components/common/ModalPortal';

export const InboxPage: React.FC = () => {
  const { activeRole, activeUser, db, sendMessage, showAlert } = useLMS();

  // All messages where user is sender or recipient
  const userMessages = db.messages.filter(
    m => m.senderId === activeUser.id || m.recipientId === activeUser.id
  );

  const [selectedMessage, setSelectedMessage] = useState(userMessages[0] || null);

  // New Message Modal State
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [recipientId, setRecipientId] = useState<string>('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [selectedCourseId] = useState(db.courses[0].id);

  // Filter allowed recipients based on RBAC
  const allowedRecipients = db.users.filter(u => {
    if (u.id === activeUser.id) return false;
    if (activeRole === 'student') {
      // Students can only message faculty or admins
      return u.role === 'faculty' || u.role === 'admin';
    }
    return true; // Faculty/Admin/Staff can message anyone
  });

  const handleSendNewMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientId || !subject.trim() || !body.trim()) {
      showAlert("Please complete all message fields.");
      return;
    }

    sendMessage(recipientId, subject.trim(), body.trim(), selectedCourseId);
    setShowComposeModal(false);
    setSubject('');
    setBody('');
    showAlert({
      title: "Message Sent",
      message: "Your message has been delivered.",
      type: "success"
    });
  };

  const handleMassMessageUnsubmitted = () => {
    // Mass message students who haven't submitted Lab 1
    const unsubmittedStudents = db.users.filter(u => u.role === 'student');
    unsubmittedStudents.forEach(st => {
      sendMessage(
        st.id,
        "REMINDER: Lab 1 Submission Pending",
        `Good day ${st.name},\nThis is an automated reminder regarding your pending submission for Laboratory 1. Please submit your work via SpeedGrader.`,
        "crs-cmsc131"
      );
    });
    showAlert({
      title: "Reminders Sent",
      message: `Mass message sent to ${unsubmittedStudents.length} students with pending submissions.`,
      type: "success"
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-border gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center space-x-2">
            <InboxIcon className="w-5 h-5 text-primary" />
            <span>Inbox</span>
          </h1>
          <p className="text-xs text-muted-foreground">
            Messages and announcements.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {activeRole === 'faculty' && (
            <button
              onClick={handleMassMessageUnsubmitted}
              className="px-3 py-1.5 text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground border border-border rounded-xl transition-colors cursor-pointer"
            >
              Mass Message Unsubmitted Students
            </button>
          )}

          <button
            onClick={() => {
              if (allowedRecipients.length > 0) setRecipientId(allowedRecipients[0].id);
              setShowComposeModal(true);
            }}
            className="px-4 py-2 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl transition-all flex items-center space-x-1.5 shadow-subtle cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Compose Message</span>
          </button>
        </div>
      </div>

      {/* Two-Column Master Detail Client */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden grid grid-cols-1 md:grid-cols-3 min-h-[500px] shadow-subtle">
        {/* Left Column: Messages List */}
        <div className="border-r border-border divide-y divide-border overflow-y-auto custom-scrollbar">
          {userMessages.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No conversations found.
            </div>
          ) : (
            userMessages.map(msg => {
              const isSelected = selectedMessage?.id === msg.id;
              return (
                <div
                  key={msg.id}
                  onClick={() => setSelectedMessage(msg)}
                  className={`p-4 cursor-pointer transition-colors space-y-1 text-xs ${
                    isSelected
                      ? 'bg-primary/10 border-l-2 border-primary'
                      : 'hover:bg-muted/40'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-foreground">
                      {msg.senderId === activeUser.id ? `To: ${msg.recipientName}` : msg.senderName}
                    </span>
                    <span className="text-[10px] font-sans text-muted-foreground">
                      {new Date(msg.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="font-semibold text-foreground truncate">
                    {msg.subject}
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {msg.body}
                  </p>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Message Detail Pane */}
        <div className="md:col-span-2 p-6 flex flex-col justify-between overflow-y-auto bg-zinc-50/30 dark:bg-zinc-950/30">
          {selectedMessage ? (
            <div className="space-y-6">
              <div className="border-b border-zinc-200 dark:border-zinc-800 pb-4 space-y-2">
                <div className="flex justify-between items-start">
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                    {selectedMessage.subject}
                  </h2>
                  <span className="text-xs font-sans text-zinc-500">
                    {new Date(selectedMessage.timestamp).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center space-x-2 text-xs text-zinc-600 dark:text-zinc-400 font-sans">
                  <span>From: <strong className="text-zinc-900 dark:text-zinc-100">{selectedMessage.senderName}</strong> ({selectedMessage.senderRole})</span>
                  <span>•</span>
                  <span>To: <strong className="text-zinc-900 dark:text-zinc-100">{selectedMessage.recipientName}</strong></span>
                </div>
              </div>

              <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg font-sans text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-line shadow-2xs">
                {selectedMessage.body}
              </div>
            </div>
          ) : (
            <div className="m-auto text-center text-xs text-zinc-500">
              Select a conversation thread to view contents.
            </div>
          )}
        </div>
      </div>

      {/* Compose Message Modal */}
      <AnimatedModal
        isOpen={showComposeModal}
        onClose={() => setShowComposeModal(false)}
        panelClassName="w-full max-w-lg bg-card border border-border rounded-2xl p-6 space-y-4 shadow-elevated"
      >
        {({ startClose }) => (
          <>
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="font-bold text-base text-foreground">
                Compose GABAY Academic Message
              </h3>
              <button
                type="button"
                onClick={startClose}
                className="p-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSendNewMessage} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Recipient (RBAC Filtered):
                </label>
                <select
                  value={recipientId}
                  onChange={e => setRecipientId(e.target.value)}
                  className="w-full p-2.5 bg-background border border-border hover:border-primary/40 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl text-foreground text-xs font-sans font-medium outline-none shadow-subtle cursor-pointer transition-all"
                >
                  {allowedRecipients.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role.toUpperCase()} • {u.department})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Subject:
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="e.g. SpeedGrader Feedback Clarification"
                  className="w-full p-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded font-sans"
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Message Body:
                </label>
                <textarea
                  rows={4}
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  placeholder="Type your message text here..."
                  className="w-full p-2.5 bg-background border border-border rounded-xl text-foreground font-sans outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={startClose}
                  className="px-4 py-2 font-semibold text-muted-foreground hover:bg-muted rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-subtle cursor-pointer"
                >
                  Send Message
                </button>
              </div>
            </form>
          </>
        )}
      </AnimatedModal>
    </div>
  );
};
