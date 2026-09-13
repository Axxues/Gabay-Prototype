import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Plus,
  Search,
  Send,
  Trash2,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  Paperclip,
  Mic,
  PanelLeftClose,
  PanelLeftOpen,
  FileText,
  BookOpen,
  CalendarDays,
  GraduationCap,
  X,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sources?: { label: string; detail: string }[];
}

interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
}

const SUGGESTIONS = [
  { icon: <BookOpen className="h-4 w-4" />, title: 'Explain a module topic', prompt: 'Can you explain the key concepts from Module 3 of my course?' },
  { icon: <CalendarDays className="h-4 w-4" />, title: 'Check my schedule', prompt: 'What assignments and quizzes are due this week?' },
  { icon: <GraduationCap className="h-4 w-4" />, title: 'Study help', prompt: 'Help me review for my upcoming quiz with practice questions.' },
  { icon: <FileText className="h-4 w-4" />, title: 'Summarize a file', prompt: 'Summarize the course syllabus and grading breakdown.' },
];

function getMockResponse(query: string): { content: string; sources: { label: string; detail: string }[] } {
  const q = query.toLowerCase();
  if (q.includes('syllabus') || q.includes('grading') || q.includes('grade breakdown')) {
    return {
      content: 'Based on your course syllabus, here is the grading breakdown:\n\n• Activities & laboratory exercises — 30%\n• Quizzes — 20%\n• Major examinations — 30%\n• Attendance & participation — 20%\n\nA passing mark requires a final grade of 75% or higher. Let me know if you want the full week-by-week topic outline.',
      sources: [
        { label: 'Syllabus_CMSC131.pdf', detail: 'Section 4 · Grading system' },
        { label: 'Course outline', detail: 'Week 1–16 schedule' },
      ],
    };
  }
  if (q.includes('due') || q.includes('deadline') || q.includes('assignment') || q.includes('quiz')) {
    return {
      content: 'Here is what I found due this week:\n\n• Lab Activity 4: ER Diagramming — due Friday, 11:59 PM\n• Quiz 3: Normalization (Modules 4–5) — due Sunday, 11:59 PM\n• Announcement: make-up class on Saturday, 9:00 AM\n\nWant me to draft a study plan for Quiz 3?',
      sources: [
        { label: 'Calendar', detail: 'This week · 3 items' },
        { label: 'Modules 4–5', detail: 'Normalization handouts' },
      ],
    };
  }
  if (q.includes('module 3') || q.includes('explain') || q.includes('concept')) {
    return {
      content: 'Module 3 covers relational modeling in three ideas:\n\n1. Entities become tables — each entity set maps to a table with a primary key.\n2. Relationships become keys — one-to-many relationships use foreign keys; many-to-many relationships need a junction table.\n3. Constraints protect data — NOT NULL, UNIQUE, and referential integrity keep rows consistent.\n\nTry this check: in a Students–Courses enrollment, which table holds the foreign keys, and why?',
      sources: [
        { label: 'Module 3 handout', detail: 'Relational modeling · pp. 4–9' },
        { label: 'Lab 3 rubric', detail: 'ER-to-relational mapping' },
      ],
    };
  }
  if (q.includes('review') || q.includes('practice') || q.includes('study')) {
    return {
      content: 'Great — here is a quick 3-question review to start:\n\n1. What is the difference between a primary key and a foreign key?\n2. When does a many-to-many relationship require a junction table?\n3. Which normal form removes partial dependencies?\n\nReply with your answers and I will check them one by one.',
      sources: [{ label: 'Quiz bank', detail: 'Modules 1–5 · sample items' }],
    };
  }
  if (q.includes('enroll') || q.includes('join code') || q.includes('section')) {
    return {
      content: 'To join a course section, open Courses, pick your course, and enter the join code shared by your instructor (it looks like GABAY-XXXX). If the code does not work, confirm you are enrolling in the correct section — codes are section-specific.',
      sources: [{ label: 'Help guide', detail: 'Enrollment · join codes' }],
    };
  }
  return {
    content: 'I searched your course materials for that. Here is a helpful starting point — tell me which course or module this is about and I can pull the exact handout, announcement, or rubric section.\n\nMeanwhile, you can ask me to explain a topic, summarize the syllabus, list what is due this week, or quiz you for review.',
    sources: [{ label: 'Course materials', detail: 'Top matches across modules' }],
  };
}

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const GabayRAGPage: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([
    {
      id: 'welcome-thread',
      title: 'Getting started with Gabay',
      createdAt: new Date().toISOString(),
      messages: [
        {
          id: 'welcome-msg',
          role: 'assistant',
          timestamp: new Date().toISOString(),
          content: 'Hi! I am Gabay RAG — I answer from your course materials: modules, syllabus, announcements, and rubrics. Ask me anything about your classes.',
          sources: [{ label: 'Course materials', detail: 'Connected · 12 documents' }],
        },
      ],
    },
  ]);
  const [activeId, setActiveId] = useState<string>('welcome-thread');
  const [input, setInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);

  const feedRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimer = useRef<number | null>(null);

  const activeConversation = useMemo(
    () => conversations.find(c => c.id === activeId) ?? conversations[0] ?? null,
    [conversations, activeId]
  );

  const filteredConversations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      c =>
        c.title.toLowerCase().includes(q) ||
        c.messages.some(m => m.content.toLowerCase().includes(q))
    );
  }, [conversations, searchQuery]);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' });
  }, [activeConversation?.messages.length, isTyping, streamingId]);

  useEffect(() => {
    return () => {
      if (typingTimer.current) window.clearTimeout(typingTimer.current);
    };
  }, []);

  const autoGrow = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const startNewChat = () => {
    const convo: Conversation = {
      id: uid(),
      title: 'New conversation',
      createdAt: new Date().toISOString(),
      messages: [],
    };
    setConversations(prev => [convo, ...prev]);
    setActiveId(convo.id);
    setMobileHistoryOpen(false);
    setInput('');
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const streamAssistantReply = (convoId: string, fullContent: string, sources: ChatMessage['sources']) => {
    const msgId = uid();
    setStreamingId(msgId);
    const pending: ChatMessage = { id: msgId, role: 'assistant', content: '', timestamp: new Date().toISOString(), sources };
    setConversations(prev =>
      prev.map(c => (c.id === convoId ? { ...c, messages: [...c.messages, pending] } : c))
    );
    let i = 0;
    const chunk = Math.max(2, Math.ceil(fullContent.length / 90));
    const timer = window.setInterval(() => {
      i += chunk;
      const slice = fullContent.slice(0, i);
      setConversations(prev =>
        prev.map(c =>
          c.id === convoId
            ? { ...c, messages: c.messages.map(m => (m.id === msgId ? { ...m, content: slice } : m)) }
            : c
        )
      );
      if (i >= fullContent.length) {
        window.clearInterval(timer);
        setStreamingId(null);
        setIsTyping(false);
      }
    }, 18);
  };

  const handleSend = (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || isTyping || !activeConversation) return;
    const convoId = activeConversation.id;
    const userMsg: ChatMessage = { id: uid(), role: 'user', content: text, timestamp: new Date().toISOString() };
    setConversations(prev =>
      prev.map(c => {
        if (c.id !== convoId) return c;
        const title = c.messages.length <= 1 && c.title === 'New conversation' ? text.slice(0, 42) : c.title;
        return { ...c, title, messages: [...c.messages, userMsg] };
      })
    );
    setInput('');
    requestAnimationFrame(() => {
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    });
    setIsTyping(true);
    const { content, sources } = getMockResponse(text);
    typingTimer.current = window.setTimeout(() => streamAssistantReply(convoId, content, sources), 750);
  };

  const handleDelete = (id: string) => {
    setConversations(prev => {
      const next = prev.filter(c => c.id !== id);
      if (next.length === 0) {
        const fresh: Conversation = { id: uid(), title: 'New conversation', createdAt: new Date().toISOString(), messages: [] };
        setActiveId(fresh.id);
        return [fresh];
      }
      if (id === activeId) setActiveId(next[0].id);
      return next;
    });
  };

  const handleCopy = async (id: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      /* clipboard unavailable in some contexts */
    }
  };

  const historyPanel = (
    <div className="flex h-full flex-col">
      <div className="p-3">
        <button
          type="button"
          onClick={startNewChat}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-xs font-bold text-primary-foreground shadow-primary-sm transition-all hover:bg-primary/90 active:scale-[0.98] cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          New chat
        </button>
        <div className="relative mt-3">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search chats..."
            className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-8 text-xs text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground cursor-pointer"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      <div className="custom-scrollbar flex-1 space-y-1 overflow-y-auto px-2 pb-2">
        {filteredConversations.length === 0 ? (
          <p className="px-2 py-6 text-center text-[11px] text-muted-foreground">No conversations found.</p>
        ) : (
          filteredConversations.map(c => {
            const selected = c.id === activeId;
            const preview = c.messages.length > 0 ? c.messages[c.messages.length - 1].content : 'No messages yet';
            return (
              <div
                key={c.id}
                className={`group relative rounded-xl border px-3 py-2.5 transition-all ${selected ? 'border-primary/30 bg-primary/10' : 'border-transparent hover:bg-muted/70'}`}
              >
                <button
                  type="button"
                  onClick={() => { setActiveId(c.id); setMobileHistoryOpen(false); }}
                  className="w-full text-left cursor-pointer"
                >
                  <p className={`truncate text-xs font-bold ${selected ? 'text-primary' : 'text-foreground'}`}>{c.title}</p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{preview}</p>
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(c.id)}
                  title="Delete conversation"
                  className="absolute right-2 top-2 hidden rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive group-hover:block cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2">
          <span className="live-dot shrink-0" />
          <p className="text-[10px] leading-snug text-muted-foreground">Prototype mode — answers are simulated from sample course materials.</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden bg-background font-sans">
      {/* Desktop history sidebar */}
      {sidebarOpen && (
        <aside className="hidden w-72 shrink-0 flex-col border-r border-border bg-card/60 backdrop-blur-md md:flex lg:w-80">
          {historyPanel}
        </aside>
      )}
      {/* Mobile history drawer */}
      {mobileHistoryOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="overlay-backdrop absolute inset-0" onClick={() => setMobileHistoryOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-card shadow-xl animate-slide-in-right">
            {historyPanel}
          </aside>
        </div>
      )}

      {/* Main chat column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-card/80 px-3 py-2.5 backdrop-blur-md sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileHistoryOpen(true)}
              className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground md:hidden cursor-pointer"
              aria-label="Open chat history"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setSidebarOpen(v => !v)}
              className="hidden rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground md:block cursor-pointer"
              aria-label="Toggle chat history"
              title="Toggle chat history"
            >
              {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </button>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-sm font-black text-white shadow-primary-sm">G</div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-extrabold tracking-tight text-foreground">Gabay RAG</h1>
              <p className="truncate text-[11px] text-muted-foreground">{activeConversation?.title ?? 'New conversation'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={startNewChat}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-foreground shadow-subtle transition-all hover:border-primary/40 hover:text-primary cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">New chat</span>
          </button>
        </div>

        {/* Feed */}
        <div ref={feedRef} className="custom-scrollbar flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
            {(activeConversation?.messages.length ?? 0) === 0 ? (
              <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-2xl font-black text-white shadow-primary-sm">
                  G
                </div>
                <h2 className="mt-4 text-xl font-black tracking-tight text-foreground sm:text-2xl">How can Gabay help you study today?</h2>
                <p className="mt-1.5 max-w-md text-xs leading-relaxed text-muted-foreground">
                  I retrieve answers from your enrolled course materials — modules, syllabus, announcements, and rubrics.
                </p>
                <div className="mt-6 grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {SUGGESTIONS.map(s => (
                    <button
                      key={s.title}
                      type="button"
                      onClick={() => handleSend(s.prompt)}
                      className="card-hover group rounded-2xl border border-border bg-card p-3.5 text-left shadow-subtle cursor-pointer"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                        {s.icon}
                      </span>
                      <span className="mt-2.5 block text-xs font-bold text-foreground">{s.title}</span>
                      <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{s.prompt}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-5 pb-4">
                {activeConversation?.messages.map(msg =>
                  msg.role === 'user' ? (
                    <div key={msg.id} className="flex justify-end">
                      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-[13px] leading-relaxed text-primary-foreground shadow-primary-sm sm:max-w-[75%]">
                        <p className="whitespace-pre-line">{msg.content}</p>
                      </div>
                    </div>
                  ) : (
                    <div key={msg.id} className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-xs font-black text-white">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-border bg-card px-4 py-3 shadow-subtle">
                        {msg.content ? (
                          <p className="whitespace-pre-line text-[13px] leading-relaxed text-foreground">
                            {msg.content}
                            {streamingId === msg.id && <span className="ml-1 inline-block h-4 w-1.5 animate-pulse rounded bg-primary align-middle" />}
                          </p>
                        ) : (
                          <div className="flex items-center gap-1.5 py-1" aria-label="Gabay is typing">
                            <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
                            <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
                            <span className="h-2 w-2 animate-bounce rounded-full bg-primary" />
                          </div>
                        )}
                        {msg.content && msg.sources && msg.sources.length > 0 && streamingId !== msg.id && (
                          <div className="mt-3 border-t border-border/70 pt-2.5">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sources</p>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {msg.sources.map(s => (
                                <span
                                  key={s.label}
                                  title={s.detail}
                                  className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border bg-muted/60 px-2 py-1 text-[10px] font-semibold text-foreground"
                                >
                                  <FileText className="h-3 w-3 shrink-0 text-primary" />
                                  <span className="truncate">{s.label}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {msg.content && streamingId !== msg.id && (
                          <div className="mt-2 flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleCopy(msg.id, msg.content)}
                              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
                              title="Copy response"
                            >
                              {copiedId === msg.id ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                            </button>
                            <button type="button" className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer" title="Good response">
                              <ThumbsUp className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer" title="Bad response">
                              <ThumbsDown className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                )}
                {isTyping && !streamingId && (
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-xs font-black text-white">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-md border border-border bg-card px-4 py-3.5 shadow-subtle">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-primary" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <div className="shrink-0 border-t border-border bg-card/80 backdrop-blur-md">
          <div className="mx-auto w-full max-w-3xl px-4 py-3 sm:px-6">
            <div className="flex items-end gap-2 rounded-2xl border border-border bg-background p-2 shadow-subtle transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
              <button type="button" title="Attach a file (coming soon)" className="rounded-xl p-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer">
                <Paperclip className="h-4 w-4" />
              </button>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => { setInput(e.target.value); autoGrow(); }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                rows={1}
                placeholder="Ask about your courses, modules, deadlines..."
                className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-1 py-2.5 text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
              />
              <button type="button" title="Voice input (coming soon)" className="rounded-xl p-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer">
                <Mic className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={!input.trim() || isTyping}
                title="Send message"
                className="rounded-xl bg-primary p-2.5 text-primary-foreground shadow-primary-sm transition-all hover:bg-primary/90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-center text-[10px] text-muted-foreground">
              Gabay RAG can make mistakes. Verify important deadlines against official announcements.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
