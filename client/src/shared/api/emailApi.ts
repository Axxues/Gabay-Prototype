export interface SendActivationEmailParams {
  email: string;
  recipientName?: string;
  activationUrl: string;
}

export function getEmailApiHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const clientKey = import.meta.env.VITE_RAG_CLIENT_KEY;
  if (clientKey && typeof clientKey === 'string' && clientKey.trim()) {
    headers['X-Gabay-Client-Key'] = clientKey.trim();
  }
  return headers;
}

export function getEmailApiUrl(): string {
  const envUrl = import.meta.env.VITE_RAG_API_URL;
  const baseUrl = (envUrl && typeof envUrl === 'string' && envUrl.trim()
    ? envUrl.trim()
    : 'http://localhost:8000').replace(/\/+$/, '');
  return `${baseUrl}/api/auth/send-activation-email`;
}

export async function sendActivationEmail(
  params: SendActivationEmailParams
): Promise<{ success: boolean; message?: string; delivered?: boolean; simulated?: boolean }> {
  try {
    const res = await fetch(getEmailApiUrl(), {
      method: 'POST',
      headers: getEmailApiHeaders(),
      body: JSON.stringify({
        email: params.email,
        recipient_name: params.recipientName,
        activation_url: params.activationUrl,
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      return { success: false, message: err || `Request failed (${res.status})` };
    }

    return await res.json();
  } catch (err: any) {
    return { success: false, message: err?.message || 'Failed to dispatch activation email' };
  }
}

export interface SendLeadershipCodeEmailParams {
  email: string;
  recipientName?: string;
  code?: string;
  roleType?: 'dean' | 'chairperson';
  unitName?: string;
}

export function getLeadershipCodeEmailApiUrl(): string {
  const envUrl = import.meta.env.VITE_RAG_API_URL;
  const baseUrl = (envUrl && typeof envUrl === 'string' && envUrl.trim()
    ? envUrl.trim()
    : 'http://localhost:8000').replace(/\/+$/, '');
  return `${baseUrl}/api/auth/send-leadership-code`;
}

export async function sendLeadershipCodeEmail(
  params: SendLeadershipCodeEmailParams
): Promise<{ success: boolean; message?: string; delivered?: boolean; simulated?: boolean; code?: string }> {
  try {
    const res = await fetch(getLeadershipCodeEmailApiUrl(), {
      method: 'POST',
      headers: getEmailApiHeaders(),
      body: JSON.stringify({
        email: params.email,
        recipient_name: params.recipientName,
        role_type: params.roleType || 'dean',
        unit_name: params.unitName || '',
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      return { success: false, message: err || `Request failed (${res.status})` };
    }

    return await res.json();
  } catch (err: any) {
    // If backend RAG service is unreachable, fallback only in dev
    if (import.meta.env.DEV) {
      return {
        success: true,
        simulated: true,
        delivered: false,
        code: params.code,
        message: 'Verification code simulated (service running in standalone mode).',
      };
    }
    return {
      success: false,
      delivered: false,
      message: err?.message || 'Failed to dispatch verification code email.',
    };
  }
}

export async function verifyLeadershipCode(
  email: string,
  code: string
): Promise<{ success: boolean; message: string }> {
  try {
    const envUrl = import.meta.env.VITE_RAG_API_URL;
    const baseUrl = (envUrl && typeof envUrl === 'string' && envUrl.trim()
      ? envUrl.trim()
      : 'http://localhost:8000').replace(/\/+$/, '');
    const res = await fetch(`${baseUrl}/api/auth/verify-leadership-code`, {
      method: 'POST',
      headers: getEmailApiHeaders(),
      body: JSON.stringify({ email, code }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      return { success: false, message: err || `Verification failed (${res.status})` };
    }

    return await res.json();
  } catch (err: any) {
    if (import.meta.env.DEV) {
      return { success: true, message: 'Code verified (development fallback).' };
    }
    return { success: false, message: err?.message || 'Failed to verify leadership code.' };
  }
}

export interface CourseInvitationPayload {
  recipientEmail: string;
  recipientName?: string;
  instructorName?: string;
  courseCode: string;
  courseTitle: string;
  section?: string;
  term?: string;
  joinUrl: string;
  requestId?: string;
}

export function getCourseInvitationEmailApiUrl(): string {
  const envUrl = import.meta.env.VITE_RAG_API_URL;
  const baseUrl = (envUrl && typeof envUrl === 'string' && envUrl.trim()
    ? envUrl.trim()
    : 'http://localhost:8000').replace(/\/+$/, '');
  return `${baseUrl}/api/courses/send-course-invitations`;
}

export async function sendCourseInvitations(
  invitations: CourseInvitationPayload[]
): Promise<{ success: boolean; total: number; sent: number; simulated?: boolean; message?: string }> {
  try {
    const res = await fetch(getCourseInvitationEmailApiUrl(), {
      method: 'POST',
      headers: getEmailApiHeaders(),
      body: JSON.stringify({
        invitations: invitations.map(inv => ({
          recipient_email: inv.recipientEmail,
          recipient_name: inv.recipientName || '',
          instructor_name: inv.instructorName || 'Your Instructor',
          course_code: inv.courseCode,
          course_title: inv.courseTitle,
          section: inv.section || '',
          term: inv.term || '',
          join_url: inv.joinUrl,
          request_id: inv.requestId,
        })),
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      return {
        success: false,
        total: invitations.length,
        sent: 0,
        message: err || `Request failed (${res.status})`,
      };
    }

    return await res.json();
  } catch (err: any) {
    if (import.meta.env.DEV) {
      return {
        success: true,
        simulated: true,
        total: invitations.length,
        sent: invitations.length,
        message: 'Course invitations simulated (development fallback).',
      };
    }
    return {
      success: false,
      total: invitations.length,
      sent: 0,
      message: err?.message || 'Failed to dispatch course invitations.',
    };
  }
}
