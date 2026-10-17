// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { GabayChatProvider, useGabayChat } from './GabayChatContext';
import { LMSContext } from './LMSContext';
import * as ragApi from '../api/rag';

describe('GabayChatContext FastAPI Integration', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  const mockLmsValue = {
    activeUser: { id: 'usr-student-1', name: 'Alex Mercer', role: 'student' },
    activeCourseId: 'crs-cmsc131',
    db: {
      courses: [
        { id: 'crs-cmsc131', code: 'CMSC131', title: 'Data Structures' },
      ],
    },
  };

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <LMSContext.Provider value={mockLmsValue as any}>
      <GabayChatProvider userId="usr-student-1">{children}</GabayChatProvider>
    </LMSContext.Provider>
  );

  it('passes student_name, active_course, and conversation history to sendRagMessage', async () => {
    const sendRagMessageSpy = vi.spyOn(ragApi, 'sendRagMessage').mockResolvedValue({
      reply: 'Hello Alex, the prerequisite is CMSC128. [Syllabus / Prerequisites]',
      category: 'curriculum_and_instruction',
      sources: [{ label: 'Syllabus / Prerequisites', detail: 'Curriculum' }],
    });

    const { result } = renderHook(() => useGabayChat(), { wrapper });

    await act(async () => {
      await result.current.sendMessage('What is the prerequisite?');
    });

    expect(sendRagMessageSpy).toHaveBeenCalledOnce();
    const [msg, opts] = sendRagMessageSpy.mock.calls[0];
    expect(msg).toBe('What is the prerequisite?');
    expect(opts).toMatchObject({
      student_name: 'Alex Mercer',
      active_course: 'CMSC131',
      history: [],
    });

    // Verify assistant reply is stored in conversation
    const activeConvo = result.current.activeConversation;
    expect(activeConvo.messages).toHaveLength(2);
    expect(activeConvo.messages[1].content).toBe(
      'Hello Alex, the prerequisite is CMSC128. [Syllabus / Prerequisites]'
    );
  });

  it('includes up to 6 prior completed turns in history for subsequent messages', async () => {
    const sendRagMessageSpy = vi
      .spyOn(ragApi, 'sendRagMessage')
      .mockResolvedValueOnce({
        reply: 'Reply 1',
        category: 'curriculum_and_instruction',
        sources: [],
      })
      .mockResolvedValueOnce({
        reply: 'Reply 2',
        category: 'curriculum_and_instruction',
        sources: [],
      });

    const { result } = renderHook(() => useGabayChat(), { wrapper });

    await act(async () => {
      await result.current.sendMessage('First turn prompt');
    });

    await act(async () => {
      await result.current.sendMessage('Second turn prompt');
    });

    expect(sendRagMessageSpy).toHaveBeenCalledTimes(2);
    const secondCallOpts = sendRagMessageSpy.mock.calls[1][1] as ragApi.SendRagMessageOptions;
    expect(secondCallOpts.history).toEqual([
      { role: 'user', content: 'First turn prompt' },
      { role: 'assistant', content: 'Reply 1' },
    ]);
  });

  it('updates assistant message with new academic assistant unavailable fallback on error', async () => {
    vi.spyOn(ragApi, 'sendRagMessage').mockRejectedValue(
      new Error('Connection refused')
    );

    const { result } = renderHook(() => useGabayChat(), { wrapper });

    await act(async () => {
      await result.current.sendMessage('Trigger error');
    });

    const activeConvo = result.current.activeConversation;
    const assistantMsg = activeConvo.messages.find((m) => m.role === 'assistant');
    expect(assistantMsg?.content).toContain(
      'Sorry, the Gabay academic assistant is currently unavailable. Please ensure the RAG service is running.'
    );
    expect(assistantMsg?.content).not.toContain('n8n');
  });
});
