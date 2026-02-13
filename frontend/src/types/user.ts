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
  // Zero-knowledge fields returned on login/register
  encrypted_private_key?: string | null;
  public_key?: string | null;
  kdf_iterations?: number | null;
  encrypted_org_key?: string | null;
}

export interface RegisterData {
  email: string;
  password: string;
  full_name: string;
  // Zero-knowledge fields
  master_password_hash?: string;
  encrypted_private_key?: string;
  public_key?: string;
  encrypted_org_key?: string;
  recovery_encrypted_private_key?: string;
  kdf_iterations?: number;
}

export interface LoginData {
  email: string;
  password: string;
  // Zero-knowledge: client sends hash instead of password
  master_password_hash?: string;
}

export interface PreloginResponse {
  kdf_iterations: number;
  email: string;
}
