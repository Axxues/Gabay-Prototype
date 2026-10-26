export type QuickLoginTone = 'admin' | 'dean' | 'chair' | 'faculty' | 'staff' | 'student';

export interface QuickLoginAccount {
  label: string;
  email: string;
  password: string;
  tone?: QuickLoginTone;
}

const VALID_TONES = new Set<QuickLoginTone>(['admin', 'dean', 'chair', 'faculty', 'staff', 'student']);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Parse local-only quick-login accounts.
 *
 * The raw value is a base64-encoded JSON array stored in `client/.env.local`.
 * A missing or malformed value is treated as "no quick login" rather than
 * crashing the login page. The `isDev` guard is deliberately required so a
 * production build can never render these accounts even if the env file is
 * present on the build machine.
 */
export function parseQuickLoginAccounts(
  raw: string | undefined,
  isDev: boolean
): QuickLoginAccount[] {
  if (!isDev || !raw || !raw.trim()) return [];

  try {
    const decoded = atob(raw.trim());
    const parsed: unknown = JSON.parse(decoded);
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((entry): QuickLoginAccount[] => {
      if (!entry || typeof entry !== 'object') return [];
      const candidate = entry as Record<string, unknown>;
      if (
        !isNonEmptyString(candidate.label) ||
        !isNonEmptyString(candidate.email) ||
        !isNonEmptyString(candidate.password)
      ) {
        return [];
      }

      const account: QuickLoginAccount = {
        label: candidate.label.trim(),
        email: candidate.email.trim(),
        password: candidate.password,
      };

      if (isNonEmptyString(candidate.tone) && VALID_TONES.has(candidate.tone as QuickLoginTone)) {
        account.tone = candidate.tone as QuickLoginTone;
      }

      return [account];
    });
  } catch {
    return [];
  }
}

export function loadQuickLoginAccounts(): QuickLoginAccount[] {
  return parseQuickLoginAccounts(
    import.meta.env.VITE_QUICK_LOGIN_ACCOUNTS_B64,
    import.meta.env.DEV
  );
}
