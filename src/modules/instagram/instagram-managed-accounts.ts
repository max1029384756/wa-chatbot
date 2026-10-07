export const INSTAGRAM_MANAGED_ACCOUNTS_DIAGNOSTIC =
  'INSTAGRAM_MANAGED_ACCOUNTS is missing or invalid: expected a non-empty JSON object mapping numeric account IDs to non-empty usernames. Automatic Instagram replies are disabled.';

export function normalizeInstagramManagedAccounts(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;

  const entries = Object.entries(value);
  if (!entries.length) return undefined;

  const accounts: Record<string, string> = {};
  for (const [id, username] of entries) {
    if (!/^\d+$/.test(id) || typeof username !== 'string' || !username.trim()) return undefined;
    accounts[id] = username.trim().toLowerCase();
  }

  return accounts;
}

export function parseInstagramManagedAccounts(raw: string | undefined): Record<string, string> | undefined {
  if (!raw) return undefined;

  try {
    return normalizeInstagramManagedAccounts(JSON.parse(raw));
  } catch {
    return undefined;
  }
}
