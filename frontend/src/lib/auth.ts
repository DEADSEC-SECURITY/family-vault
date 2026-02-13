const TOKEN_KEY = "familyvault_token";
const USER_KEY = "familyvault_user";
const ORG_KEY = "familyvault_org_id";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(ORG_KEY);
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  migration_items_v1?: number;
  migration_files_v1?: number;
}

export function getStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStoredUser(user: User): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/** Update specific fields on the stored user without replacing the whole object. */
export function updateStoredUser(updates: Partial<User>): void {
  const current = getStoredUser();
  if (!current) return;
  setStoredUser({ ...current, ...updates });
}

export function getActiveOrgId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ORG_KEY);
}

export function setActiveOrgId(orgId: string): void {
  localStorage.setItem(ORG_KEY, orgId);
}

export function isAuthenticated(): boolean {
  return !!getToken();
}
