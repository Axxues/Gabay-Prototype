import React, { useState } from 'react';
import { useLMS } from '../context/LMSContext';
import { Inbox as InboxIcon, Plus } from 'lucide-react';

export const InboxPage: React.FC = () => {
  const { activeRole, activeUser, db, sendMessage } = useLMS();

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
      alert("Please complete all message fields.");
      return;
    }

    sendMessage(recipientId, subject.trim(), body.trim(), selectedCourseId);
    setShowComposeModal(false);
    setSubject('');
    setBody('');
    alert("Message sent via GABAY Messaging Network!");
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
    alert(`Mass message sent to ${unsubmittedStudents.length} students with pending submissions!`);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800 gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center space-x-2">
            <InboxIcon className="w-5 h-5 text-red-700 dark:text-red-400" />
            <span>Institutional Inbox & Conversations</span>
          </h1>
          <p className="text-xs text-zinc-500 font-mono">
            Role-Guarded Academic Messaging Engine
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {activeRole === 'faculty' && (
            <button
              onClick={handleMassMessageUnsubmitted}
              className="px-3 py-1.5 text-xs font-semibold bg-zinc-800 hover:bg-zinc-900 text-white rounded transition-colors"
            >
              Mass Message Unsubmitted Students
            </button>
          )}

          <button
            onClick={() => {
              if (allowedRecipients.length > 0) setRecipientId(allowedRecipients[0].id);
              setShowComposeModal(true);
            }}
            className="px-4 py-1.5 text-xs font-semibold bg-red-800 hover:bg-red-900 text-white rounded transition-colors flex items-center space-x-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Compose Message</span>
          </button>
        </div>
      </div>

      {/* Two-Column Master Detail Client */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden grid grid-cols-1 md:grid-cols-3 min-h-[500px] shadow-2xs">
        {/* Left Column: Messages List */}
        <div className="border-r border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-200 dark:divide-zinc-800 overflow-y-auto">
          {userMessages.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-500">
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
                      ? 'bg-red-50/50 dark:bg-red-950/20 border-l-2 border-red-700'
                      : 'hover:bg-zinc-50 dark:hover:bg-zinc-950'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-zinc-900 dark:text-zinc-100">
                      {msg.senderId === activeUser.id ? `To: ${msg.recipientName}` : msg.senderName}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400">
                      {new Date(msg.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                    {msg.subject}
                  </div>
                  <p className="text-[11px] text-zinc-500 truncate">
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
                  <span className="text-xs font-mono text-zinc-500">
                    {new Date(selectedMessage.timestamp).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center space-x-2 text-xs text-zinc-600 dark:text-zinc-400 font-mono">
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
      {showComposeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 space-y-4 shadow-xl">
            <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
              Compose GABAY Academic Message
            </h3>

            <form onSubmit={handleSendNewMessage} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Recipient (RBAC Filtered):
                </label>
                <select
                  value={recipientId}
                  onChange={e => setRecipientId(e.target.value)}
                  className="w-full p-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded font-mono"
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
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Message Body:
                </label>
                <textarea
                  rows={4}
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  placeholder="Type your message text here..."
                  className="w-full p-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded font-sans"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowComposeModal(false)}
                  className="px-4 py-2 font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-semibold bg-red-800 hover:bg-red-900 text-white rounded shadow-sm"
                >
                  Send Message
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
