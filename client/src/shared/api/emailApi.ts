export interface SendActivationEmailParams {
  email: string;
  recipientName?: string;
  activationUrl: string;
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
      headers: {
        'Content-Type': 'application/json',
      },
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
  code: string;
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
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: params.email,
        recipient_name: params.recipientName,
        code: params.code,
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
    // If backend RAG service is unreachable (e.g. running mock client or dev server alone),
    // fallback gracefully to simulated dispatch so development and demo continue smoothly.
    return {
      success: true,
      simulated: true,
      delivered: false,
      code: params.code,
      message: 'Verification code simulated (service running in standalone mode).',
    };
  }
}
