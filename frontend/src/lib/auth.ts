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

export function getStoredUser(): { id: string; email: string; full_name: string } | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStoredUser(user: {
  id: string;
  email: string;
  full_name: string;
}): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
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
