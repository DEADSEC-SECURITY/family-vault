export interface User {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  active_org_id: string | null;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface RegisterData {
  email: string;
  password: string;
  full_name: string;
}

export interface LoginData {
  email: string;
  password: string;
}
