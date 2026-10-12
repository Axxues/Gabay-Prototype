import { LIKHA_URL } from '../../env.js';
import { getLikhaAdminToken } from '../client.js';

export function parseJsonField(val: any, fallback: any = null): any {
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return fallback; }
  }
  return val ?? fallback;
}

export function formatLikhaAnnouncement(a: any): any {
  return {
    id: a.id,
    courseId: a.course_id,
    authorId: a.author_id,
    authorName: a.author_name,
    authorAvatar: a.author_avatar || '',
    title: a.title,
    content: a.content,
    pinned: Boolean(a.pinned),
    createdAt: a.created_at,
    likes: parseJsonField(a.likes, []),
    replies: parseJsonField(a.replies, []),
  };
}

export function formatLikhaMessage(m: any): any {
  return {
    id: m.id,
    senderId: m.sender_id,
    senderName: m.sender_name,
    recipientId: m.recipient_id,
    recipientName: m.recipient_name,
    courseId: m.course_id || null,
    subject: m.subject,
    body: m.body,
    read: Boolean(m.read),
    createdAt: m.created_at,
    attachmentName: m.attachment_name || null,
    attachmentUrl: m.attachment_url || null,
    groupId: m.group_id || null,
  };
}

export function formatLikhaCalendarEvent(e: any): any {
  return {
    id: e.id,
    title: e.title,
    date: e.date,
    startTime: e.start_time || null,
    endTime: e.end_time || null,
    type: e.type || 'class',
    location: e.location || null,
    description: e.description || null,
    allDay: Boolean(e.all_day),
    courseId: e.course_id || null,
    userId: e.user_id || null,
  };
}

export async function getAnnouncements(courseId: string): Promise<any[]> {
  const token = await getLikhaAdminToken();
  const res = await fetch(`${LIKHA_URL}/items/announcements?filter[course_id][_eq]=${encodeURIComponent(courseId)}&sort=-pinned,-created_at&limit=100`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const json = (await res.json()) as any;
  return (json.data || []).map(formatLikhaAnnouncement);
}

export async function createAnnouncement(data: any): Promise<any> {
  const token = await getLikhaAdminToken();
  const body = {
    id: data.id || `ann-${Date.now().toString(36)}`,
    course_id: data.courseId,
    author_id: data.authorId,
    author_name: data.authorName,
    author_avatar: data.authorAvatar || null,
    title: data.title,
    content: data.content,
    pinned: Boolean(data.pinned),
    created_at: new Date().toISOString(),
    likes: [],
    replies: [],
  };

  const res = await fetch(`${LIKHA_URL}/items/announcements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as any;
  return formatLikhaAnnouncement(json.data);
}

export async function getMessagesForUser(userId: string): Promise<any[]> {
  const token = await getLikhaAdminToken();
  const res = await fetch(
    `${LIKHA_URL}/items/messages?filter[_or][0][sender_id][_eq]=${encodeURIComponent(userId)}&filter[_or][1][recipient_id][_eq]=${encodeURIComponent(userId)}&sort=-created_at&limit=250`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return [];
  const json = (await res.json()) as any;
  return (json.data || []).map(formatLikhaMessage);
}

export async function sendMessage(data: any): Promise<any> {
  const token = await getLikhaAdminToken();
  const body = {
    id: data.id || `msg-${Date.now().toString(36)}`,
    sender_id: data.senderId,
    sender_name: data.senderName,
    recipient_id: data.recipientId,
    recipient_name: data.recipientName,
    course_id: data.courseId || null,
    subject: data.subject || '',
    body: data.body,
    read: false,
    created_at: new Date().toISOString(),
    attachment_name: data.attachmentName || null,
    attachment_url: data.attachmentUrl || null,
    group_id: data.groupId || null,
  };

  const res = await fetch(`${LIKHA_URL}/items/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as any;
  return formatLikhaMessage(json.data);
}

export async function getCalendarEvents(userId: string, courseIds: string[] = []): Promise<any[]> {
  const token = await getLikhaAdminToken();
  const res = await fetch(`${LIKHA_URL}/items/calendar_events?limit=250`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const json = (await res.json()) as any;
  return (json.data || []).map(formatLikhaCalendarEvent);
}

export async function createCalendarEvent(data: any): Promise<any> {
  const token = await getLikhaAdminToken();
  const body = {
    id: data.id || `evt-${Date.now().toString(36)}`,
    title: data.title,
    date: data.date,
    start_time: data.startTime || null,
    end_time: data.endTime || null,
    type: data.type || 'class',
    location: data.location || null,
    description: data.description || null,
    all_day: Boolean(data.allDay),
    course_id: data.courseId || null,
    user_id: data.userId || null,
  };

  const res = await fetch(`${LIKHA_URL}/items/calendar_events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as any;
  return formatLikhaCalendarEvent(json.data);
}
