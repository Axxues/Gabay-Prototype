import type { PendingRegistration } from '../types/lms';

/**
 * Deduplicate pending registrations by applicant email address.
 * Prioritizes the latest submission by registration timestamp and preserves
 * emailVerified=true if any duplicate was verified.
 */
export function deduplicatePendingRegistrations(list: PendingRegistration[]): PendingRegistration[] {
  if (!Array.isArray(list) || list.length === 0) return [];

  // Sort descending by registration timestamp so the latest submission is prioritized
  const sorted = [...list].sort((a, b) => {
    // If exact same registration ID, prefer verified status
    if (a.id && b.id && a.id === b.id) {
      if (a.status === 'verified' && b.status !== 'verified') return -1;
      if (b.status === 'verified' && a.status !== 'verified') return 1;
    }
    const timeA = a.registeredAt ? new Date(a.registeredAt).getTime() : 0;
    const timeB = b.registeredAt ? new Date(b.registeredAt).getTime() : 0;
    return timeB - timeA;
  });

  const deduped: PendingRegistration[] = [];
  const seenEmails = new Set<string>();
  const seenIds = new Set<string>();

  for (const item of sorted) {
    const normEmail = (item.email || '').trim().toLowerCase();
    const itemId = item.id;

    if (!normEmail) {
      if (itemId && !seenIds.has(itemId)) {
        seenIds.add(itemId);
        deduped.push(item);
      }
      continue;
    }

    if (!seenEmails.has(normEmail)) {
      seenEmails.add(normEmail);
      if (itemId) seenIds.add(itemId);

      const matching = sorted.filter(s => (s.email || '').trim().toLowerCase() === normEmail);
      const isEmailVerified = Boolean(item.emailVerified || matching.some(s => s.emailVerified));

      deduped.push({
        ...item,
        emailVerified: isEmailVerified,
      });
    }
  }

  return deduped;
}
