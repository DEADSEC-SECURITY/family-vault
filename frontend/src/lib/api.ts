/**
 * api.ts — Centralized API client for FamilyVault frontend.
 *
 * All backend communication goes through the `api` object exported below.
 * Uses fetchAPI() which handles auth tokens, 401 redirects, and JSON parsing.
 *
 * API MODULES:
 *   api.auth       — login, register, logout, me
 *   api.categories — list all categories, get category detail (with subcategories + fields)
 *   api.items      — CRUD for items (insurance policies, IDs, business docs)
 *   api.files      — upload, download (blob URL), delete file attachments
 *   api.reminders  — list, create, delete custom reminders
 *   api.search     — full-text search across items
 *   api.providers  — insurance provider lookup + detail (auto-populates contacts)
 *   api.contacts   — CRUD + reorder for linked contacts (phone, email, url, address)
 *   api.coverage   — coverage rows, plan limits, in-network providers
 *   api.vehicles   — org-wide vehicle CRUD + per-item assign/unassign
 *
 * TYPE EXPORTS (bottom of file):
 *   CategoryListItem, CategoryDetail, SubcategoryInfo, FieldDefinition,
 *   Item, ItemCreate, ItemUpdate, Reminder, ItemContact, ItemContactCreate,
 *   CoverageRow, PlanLimit, InNetworkProviderType, Vehicle, etc.
 *
 * ENV: NEXT_PUBLIC_API_URL (build-time) — defaults to http://localhost:8000/api
 */
import { getToken, getActiveOrgId, removeToken } from "./auth";
import { keyStore } from "./key-store";
import { encryptString, decryptString, encryptFile, decryptFile } from "./crypto";
import type { AuthResponse, LoginData, PreloginResponse, RegisterData, User } from "@/types";

/** Backend API base URL. Set via NEXT_PUBLIC_API_URL env var (build-time). */
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

class ApiError extends Error {
  constructor(
    public status: number,
    public data: Record<string, unknown>,
  ) {
    super(
      (data?.detail as string) || `API error: ${status}`,
    );
  }
}

async function fetchAPI<T>(
  path: string,
  options?: RequestInit & { skipContentType?: boolean },
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  if (!options?.skipContentType) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options?.headers as Record<string, string> | undefined),
    },
  });

  if (!res.ok) {
    // On 401, redirect to login UNLESS this is already an auth request
    // (login/register return 401 for invalid credentials — we want to show
    // the error, not redirect and lose the message).
    const isAuthEndpoint =
      path.startsWith("/auth/login") ||
      path.startsWith("/auth/register") ||
      path.startsWith("/auth/accept-invite") ||
      path.startsWith("/auth/validate-invite") ||
      path.startsWith("/auth/forgot-password") ||
      path.startsWith("/auth/validate-reset") ||
      path.startsWith("/auth/reset-password") ||
      path.startsWith("/auth/prelogin");
    if (res.status === 401 && !isAuthEndpoint) {
      removeToken();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      // Return a never-resolving promise so callers don't receive an error
      // while the browser is navigating to the login page.
      return new Promise<T>(() => {});
    }
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, data as Record<string, unknown>);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Zero-knowledge encryption helpers ─────────────────────────────

/** Get the org key if the user has ZK keys initialized. */
function getOrgKeyIfAvailable(): Uint8Array | null {
  const orgId = getActiveOrgId();
  if (!orgId || !keyStore.isInitialized) return null;
  try {
    return keyStore.getOrgKey(orgId);
  } catch {
    return null;
  }
}

/** Encrypt item fields + notes before sending to server. Returns modified payload. */
async function encryptItemPayload<T extends { name?: string | null; notes?: string | null; fields?: { field_key: string; field_value: string | null }[]; encryption_version?: number }>(
  data: T,
): Promise<T> {
  const orgKey = getOrgKeyIfAvailable();
  if (!orgKey) return data;

  const encrypted: Record<string, unknown> = { ...data, encryption_version: 2 };

  // Encrypt notes
  if (data.notes) {
    encrypted.notes = await encryptString(data.notes, orgKey);
  }

  // Encrypt field values
  if (data.fields) {
    encrypted.fields = await Promise.all(
      data.fields.map(async (f) => ({
        field_key: f.field_key,
        field_value: f.field_value ? await encryptString(f.field_value, orgKey) : null,
      })),
    );
  }

  return encrypted as T;
}

/** Decrypt item response (fields + notes) if client-side encrypted. */
async function decryptItemResponse(item: Item): Promise<Item> {
  if (item.encryption_version !== 2) return item;
  const orgKey = getOrgKeyIfAvailable();
  if (!orgKey) return item;

  const decrypted: Item = { ...item };

  // Decrypt notes
  if (item.notes) {
    try {
      decrypted.notes = await decryptString(item.notes, orgKey);
    } catch {
      // Leave as-is if decryption fails
    }
  }

  // Decrypt field values
  decrypted.fields = await Promise.all(
    item.fields.map(async (f) => {
      if (!f.field_value) return f;
      try {
        return { ...f, field_value: await decryptString(f.field_value, orgKey) };
      } catch {
        return f;
      }
    }),
  );

  return decrypted;
}

/** Decrypt a list of items. */
async function decryptItemList(items: Item[]): Promise<Item[]> {
  return Promise.all(items.map(decryptItemResponse));
}

/**
 * Lazy migration: re-encrypt a v1 (server-side) item as v2 (client-side).
 * The item is already plaintext (server decrypted it). We encrypt and save in the background.
 */
async function maybeMigrateItem(item: Item): Promise<void> {
  if (item.encryption_version === 2) return;
  const orgKey = getOrgKeyIfAvailable();
  if (!orgKey) return;

  const payload = await encryptItemPayload({
    notes: item.notes,
    fields: item.fields.map((f) => ({ field_key: f.field_key, field_value: f.field_value })),
  });

  // Fire-and-forget: silently upgrade encryption in the background
  fetchAPI(`/items/${item.id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  }).catch(() => {
    // Ignore migration failures — will retry next access
  });
}

export const api = {
  auth: {
    prelogin: (email: string) =>
      fetchAPI<PreloginResponse>("/auth/prelogin", {
        method: "POST",
        body: JSON.stringify({ email }),
      }),
    register: (data: RegisterData) =>
      fetchAPI<AuthResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    login: (data: LoginData) =>
      fetchAPI<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    logout: () =>
      fetchAPI<void>("/auth/logout", { method: "POST" }),
    me: () => fetchAPI<User>("/auth/me"),
    validateInvite: (token: string) =>
      fetchAPI<InviteValidation>(`/auth/validate-invite?token=${encodeURIComponent(token)}`),
    acceptInvite: (data: Record<string, unknown>) =>
      fetchAPI<AuthResponse>("/auth/accept-invite", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    forgotPassword: (email: string) =>
      fetchAPI<{ message: string }>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      }),
    validateReset: (token: string) =>
      fetchAPI<{ valid: boolean; email?: string | null; recovery_encrypted_private_key?: string | null }>(`/auth/validate-reset?token=${encodeURIComponent(token)}`),
    resetPassword: (data: Record<string, unknown>) =>
      fetchAPI<{ message: string }>("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    changePassword: (data: Record<string, unknown>) =>
      fetchAPI<{ message: string }>("/auth/change-password", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    // Zero-knowledge key exchange endpoints
    storeOrgKey: (orgId: string, userId: string, encryptedOrgKey: string) =>
      fetchAPI<{ message: string }>(`/auth/org/${encodeURIComponent(orgId)}/keys`, {
        method: "POST",
        body: JSON.stringify({ user_id: userId, encrypted_org_key: encryptedOrgKey }),
      }),
    getMyOrgKey: (orgId: string) =>
      fetchAPI<{ encrypted_org_key: string }>(`/auth/org/${encodeURIComponent(orgId)}/my-key`),
    getUserPublicKey: (userId: string) =>
      fetchAPI<{ public_key: string }>(`/auth/user/${encodeURIComponent(userId)}/public-key`),
    getPendingKeys: (orgId: string) =>
      fetchAPI<PendingKeyMember[]>(`/auth/org/${encodeURIComponent(orgId)}/pending-keys`),
  },
  categories: {
    list: () => fetchAPI<CategoryListItem[]>("/categories"),
    get: (slug: string) => fetchAPI<CategoryDetail>(`/categories/${slug}`),
  },
  items: {
    list: async (params: { category?: string; subcategory?: string; page?: number; limit?: number; include_archived?: boolean }) => {
      const qs = new URLSearchParams();
      if (params.category) qs.set("category", params.category);
      if (params.subcategory) qs.set("subcategory", params.subcategory);
      if (params.page) qs.set("page", String(params.page));
      if (params.limit) qs.set("limit", String(params.limit));
      if (params.include_archived) qs.set("include_archived", "true");
      const res = await fetchAPI<ItemListResponse>(`/items?${qs.toString()}`);
      res.items = await decryptItemList(res.items);
      return res;
    },
    get: async (id: string) => {
      const item = await fetchAPI<Item>(`/items/${id}`);
      const decrypted = await decryptItemResponse(item);
      // Lazy migration: re-encrypt v1 items as v2 in the background
      maybeMigrateItem(decrypted);
      return decrypted;
    },
    create: async (data: ItemCreate) => {
      const encrypted = await encryptItemPayload(data);
      const item = await fetchAPI<Item>("/items", { method: "POST", body: JSON.stringify(encrypted) });
      return decryptItemResponse(item);
    },
    update: async (id: string, data: ItemUpdate) => {
      const encrypted = await encryptItemPayload(data);
      const item = await fetchAPI<Item>(`/items/${id}`, { method: "PATCH", body: JSON.stringify(encrypted) });
      return decryptItemResponse(item);
    },
    delete: (id: string) =>
      fetchAPI<void>(`/items/${id}`, { method: "DELETE" }),
    renew: async (id: string) => {
      const item = await fetchAPI<Item>(`/items/${id}/renew`, { method: "POST" });
      return decryptItemResponse(item);
    },
  },
  files: {
    upload: async (itemId: string, file: File, purpose?: string) => {
      const orgKey = getOrgKeyIfAvailable();
      const formData = new FormData();

      if (orgKey) {
        // Client-side encryption: encrypt file before upload
        const plainBytes = await file.arrayBuffer();
        const encryptedBytes = await encryptFile(plainBytes, orgKey);
        const encryptedBlob = new Blob([encryptedBytes], { type: "application/octet-stream" });
        formData.append("file", encryptedBlob, file.name);
        formData.append("encryption_version", "2");
      } else {
        formData.append("file", file);
      }

      formData.append("item_id", itemId);
      if (purpose) formData.append("purpose", purpose);

      return fetchAPI<FileResponse>("/files/upload", {
        method: "POST",
        body: formData,
        skipContentType: true,
      });
    },
    getUrl: (id: string) => `${API_BASE}/files/${id}`,
    getBlobUrl: async (id: string, encryptionVersion?: number): Promise<string> => {
      const token = getToken();
      const res = await fetch(`${API_BASE}/files/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Failed to fetch file: ${res.status}`);

      const serverVersion = res.headers.get("X-Encryption-Version");
      const isClientEncrypted = encryptionVersion === 2 || serverVersion === "2";

      if (isClientEncrypted) {
        const orgKey = getOrgKeyIfAvailable();
        if (orgKey) {
          const encryptedBuf = await res.arrayBuffer();
          const plainBuf = await decryptFile(encryptedBuf, orgKey);
          const blob = new Blob([plainBuf]);
          return URL.createObjectURL(blob);
        }
      }

      const blob = await res.blob();
      return URL.createObjectURL(blob);
    },
    delete: (id: string) =>
      fetchAPI<void>(`/files/${id}`, { method: "DELETE" }),
  },
  reminders: {
    list: () => fetchAPI<Reminder[]>("/reminders"),
    overdue: () => fetchAPI<Reminder[]>("/reminders/overdue"),
    listForItem: (itemId: string) =>
      fetchAPI<Reminder[]>(`/reminders/custom?item_id=${encodeURIComponent(itemId)}`),
    create: (data: CustomReminderCreate) =>
      fetchAPI<Reminder>("/reminders/custom", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: CustomReminderUpdate) =>
      fetchAPI<Reminder>(`/reminders/custom/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      fetchAPI<void>(`/reminders/custom/${id}`, { method: "DELETE" }),
    generateBusiness: (itemId: string) =>
      fetchAPI<{ message: string; reminder_ids: string[] }>(
        `/reminders/generate-business-reminders/${itemId}`,
        { method: "POST" }
      ),
  },
  search: {
    query: async (q: string) => {
      const orgKey = getOrgKeyIfAvailable();
      if (orgKey) {
        // ZK mode: fetch all items, decrypt, and search client-side.
        // Server can't search encrypted v2 data. Family-scale (<500 items) makes this practical.
        const all = await fetchAPI<ItemListResponse>("/items?limit=500");
        const decrypted = await decryptItemList(all.items);
        const lower = q.toLowerCase();
        const filtered = decrypted.filter((item) => {
          if (item.name.toLowerCase().includes(lower)) return true;
          if (item.notes?.toLowerCase().includes(lower)) return true;
          return item.fields.some(
            (f) => f.field_value?.toLowerCase().includes(lower),
          );
        });
        return { items: filtered, total: filtered.length, page: 1, limit: 500 };
      }
      // Legacy mode: use server-side search
      const res = await fetchAPI<ItemListResponse>(`/search?q=${encodeURIComponent(q)}`);
      res.items = await decryptItemList(res.items);
      return res;
    },
  },
  providers: {
    insurance: (q?: string) =>
      fetchAPI<{ providers: string[] }>(
        `/providers/insurance${q ? `?q=${encodeURIComponent(q)}` : ""}`,
      ),
    details: (name: string) =>
      fetchAPI<ProviderDetails>(
        `/providers/insurance/${encodeURIComponent(name)}/details`,
      ),
  },
  contacts: {
    listForItem: (itemId: string) =>
      fetchAPI<ItemContact[]>(`/contacts?item_id=${encodeURIComponent(itemId)}`),
    create: (data: ItemContactCreate) =>
      fetchAPI<ItemContact>("/contacts", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: {
      label?: string; value?: string; contact_type?: string;
      address_line1?: string | null; address_line2?: string | null;
      address_city?: string | null; address_state?: string | null;
      address_zip?: string | null;
    }) =>
      fetchAPI<ItemContact>(`/contacts/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      fetchAPI<void>(`/contacts/${id}`, { method: "DELETE" }),
    reorder: (data: { item_id: string; contacts: { id: string; sort_order: number }[] }) =>
      fetchAPI<void>("/contacts/reorder", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
  },
  coverage: {
    getRows: (itemId: string) =>
      fetchAPI<CoverageRow[]>(`/coverage/rows?item_id=${encodeURIComponent(itemId)}`),
    upsertRows: (data: { item_id: string; rows: CoverageRowIn[] }) =>
      fetchAPI<CoverageRow[]>("/coverage/rows", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    getLimits: (itemId: string) =>
      fetchAPI<PlanLimit[]>(`/coverage/limits?item_id=${encodeURIComponent(itemId)}`),
    upsertLimits: (data: { item_id: string; limits: PlanLimitIn[] }) =>
      fetchAPI<PlanLimit[]>("/coverage/limits", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    getProviders: (itemId: string) =>
      fetchAPI<InNetworkProviderType[]>(`/coverage/providers?item_id=${encodeURIComponent(itemId)}`),
    createProvider: (data: InNetworkProviderCreate) =>
      fetchAPI<InNetworkProviderType>("/coverage/providers", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    deleteProvider: (id: string) =>
      fetchAPI<void>(`/coverage/providers/${id}`, { method: "DELETE" }),
  },
  vehicles: {
    list: () => fetchAPI<Vehicle[]>("/vehicles"),
    get: (id: string) => fetchAPI<Vehicle>(`/vehicles/${id}`),
    create: (data: VehicleCreate) =>
      fetchAPI<Vehicle>("/vehicles", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: VehicleUpdate) =>
      fetchAPI<Vehicle>(`/vehicles/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      fetchAPI<void>(`/vehicles/${id}`, { method: "DELETE" }),
    getPolicies: (id: string) =>
      fetchAPI<
        Array<{
          id: string;
          name: string;
          is_archived: boolean;
          created_at: string;
          updated_at: string;
        }>
      >(`/vehicles/${id}/policies`),
    listForItem: (itemId: string) =>
      fetchAPI<Vehicle[]>(`/vehicles/item/${encodeURIComponent(itemId)}`),
    assign: (itemId: string, vehicleId: string) =>
      fetchAPI<Vehicle>(`/vehicles/item/${encodeURIComponent(itemId)}`, {
        method: "POST",
        body: JSON.stringify({ vehicle_id: vehicleId }),
      }),
    unassign: (itemId: string, vehicleId: string) =>
      fetchAPI<void>(
        `/vehicles/item/${encodeURIComponent(itemId)}/${encodeURIComponent(vehicleId)}`,
        { method: "DELETE" },
      ),
  },
  people: {
    list: () => fetchAPI<Person[]>("/people"),
    get: (id: string) => fetchAPI<Person>(`/people/${id}`),
    create: (data: PersonCreate) =>
      fetchAPI<Person>("/people", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: PersonUpdate) =>
      fetchAPI<Person>(`/people/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      fetchAPI<void>(`/people/${id}`, { method: "DELETE" }),
    resendInvite: (id: string) =>
      fetchAPI<{ message: string }>(`/people/${id}/resend-invite`, { method: "POST" }),
    getInviteLink: (id: string) =>
      fetchAPI<{ invite_url: string }>(`/people/${id}/invite-link`),
    listForItem: (itemId: string) =>
      fetchAPI<LinkedPerson[]>(`/people/item/${encodeURIComponent(itemId)}`),
    link: (itemId: string, personId: string, role?: string | null) =>
      fetchAPI<LinkedPerson>(
        `/people/item/${encodeURIComponent(itemId)}`,
        { method: "POST", body: JSON.stringify({ person_id: personId, role: role || null }) },
      ),
    unlink: (itemId: string, linkId: string) =>
      fetchAPI<void>(
        `/people/item/${encodeURIComponent(itemId)}/${encodeURIComponent(linkId)}`,
        { method: "DELETE" },
      ),
  },
  dashboard: {
    stats: () => fetchAPI<DashboardStats>("/dashboard/stats"),
  },
  visas: {
    countries: () =>
      fetchAPI<{ countries: string[] }>("/visas/countries"),
    types: (country: string) =>
      fetchAPI<{ country: string; visa_types: string[] }>(
        `/visas/types/${encodeURIComponent(country)}`,
      ),
    contacts: (country: string) =>
      fetchAPI<{ country: string; contacts: Array<{ label: string; contact_type: string; value: string }> }>(
        `/visas/contacts/${encodeURIComponent(country)}`,
      ),
  },
  itemLinks: {
    getParent: (childItemId: string, linkType: string = "business_license") =>
      fetchAPI<LinkedParent | null>(
        `/item-links/parent/${encodeURIComponent(childItemId)}?link_type=${encodeURIComponent(linkType)}`,
      ),
    getChildren: (parentItemId: string, linkType: string = "business_license") =>
      fetchAPI<LinkedChild[]>(
        `/item-links/children/${encodeURIComponent(parentItemId)}?link_type=${encodeURIComponent(linkType)}`,
      ),
    link: (childItemId: string, parentItemId: string, linkType: string = "business_license") =>
      fetchAPI<LinkedParent>(
        `/item-links/${encodeURIComponent(childItemId)}`,
        { method: "POST", body: JSON.stringify({ parent_item_id: parentItemId, link_type: linkType }) },
      ),
    unlink: (childItemId: string, linkType: string = "business_license") =>
      fetchAPI<void>(
        `/item-links/${encodeURIComponent(childItemId)}?link_type=${encodeURIComponent(linkType)}`,
        { method: "DELETE" },
      ),
  },

  savedContacts: {
    list: () => fetchAPI<SavedContact[]>("/saved-contacts"),
    get: (id: string) => fetchAPI<SavedContact>(`/saved-contacts/${encodeURIComponent(id)}`),
    create: (data: SavedContactCreate) =>
      fetchAPI<SavedContact>("/saved-contacts", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: SavedContactUpdate) =>
      fetchAPI<SavedContact>(`/saved-contacts/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      fetchAPI<void>(`/saved-contacts/${encodeURIComponent(id)}`, { method: "DELETE" }),
    listForItem: (itemId: string) =>
      fetchAPI<LinkedSavedContact[]>(`/saved-contacts/item/${encodeURIComponent(itemId)}`),
    link: (itemId: string, savedContactId: string) =>
      fetchAPI<LinkedSavedContact>(
        `/saved-contacts/item/${encodeURIComponent(itemId)}`,
        { method: "POST", body: JSON.stringify({ saved_contact_id: savedContactId }) },
      ),
    unlink: (itemId: string, linkId: string) =>
      fetchAPI<void>(
        `/saved-contacts/item/${encodeURIComponent(itemId)}/${encodeURIComponent(linkId)}`,
        { method: "DELETE" },
      ),
  },
};

/* ═══════════════════════════════════════════════════════════════
 * TYPES — Shared interfaces matching the backend Pydantic schemas.
 * These are imported throughout the frontend (ItemPage, CoverageTab, etc.)
 * ═══════════════════════════════════════════════════════════════ */

/** Category card on the dashboard (Insurance, IDs, Business) */
export interface CategoryListItem {
  slug: string;
  label: string;
  icon: string;
  subcategory_count: number;
  total_items: number;
}

/** EAV field definition from categories/definitions.py. type: text|date|number|textarea|provider|select */
export interface FieldDefinition {
  key: string;
  label: string;
  type: string;
  required: boolean;
  options?: { value: string; label: string }[] | null;
}

export interface CoverageDefinition {
  layout: "health" | "standard" | "life";
  supports_providers: boolean;
  plan_limits: { key: string; label: string; group?: string; sort_order: number }[];
  default_rows: { key: string; label: string; section?: string; sort_order: number }[];
}

/** Subcategory with its field definitions, file slots, and optional coverage definition */
export interface FieldGroup {
  label: string;
  fields: FieldDefinition[];
}

export interface SubcategoryInfo {
  key: string;
  label: string;
  icon: string;
  fields: FieldDefinition[];
  field_groups?: FieldGroup[];
  file_slots: string[];
  recommended: boolean;
  item_count: number;
  coverage_definition?: CoverageDefinition | null;
}

export interface CategoryDetail {
  slug: string;
  label: string;
  icon: string;
  subcategories: SubcategoryInfo[];
}

export interface FieldValue {
  field_key: string;
  field_value: string | null;
  field_type: string;
}

export interface FileAttachmentType {
  id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  purpose: string | null;
  encryption_version?: number;
  created_at: string;
}

export interface Item {
  id: string;
  org_id: string;
  category: string;
  subcategory: string;
  name: string;
  notes: string | null;
  is_archived: boolean;
  encryption_version?: number;
  fields: FieldValue[];
  files: FileAttachmentType[];
  created_at: string;
  updated_at: string;
}

export interface ItemListResponse {
  items: Item[];
  total: number;
  page: number;
  limit: number;
}

export interface ItemCreate {
  category: string;
  subcategory: string;
  name: string;
  notes?: string | null;
  fields: { field_key: string; field_value: string | null }[];
  encryption_version?: number;
}

export interface ItemUpdate {
  name?: string | null;
  notes?: string | null;
  fields?: { field_key: string; field_value: string | null }[];
  encryption_version?: number;
}

export interface FileResponse {
  id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  purpose: string | null;
  encryption_version?: number;
  created_at: string;
}

export interface Reminder {
  id?: string;
  item_id: string;
  item_name: string;
  category: string;
  subcategory: string;
  field_label: string;
  date: string;
  days_until: number;
  is_overdue: boolean;
  is_custom?: boolean;
  is_auto_generated?: boolean;
  remind_days_before?: number;
  note?: string | null;
  repeat?: string | null;
}

export interface CustomReminderCreate {
  item_id: string;
  title: string;
  remind_date: string; // YYYY-MM-DD
  note?: string | null;
  repeat?: string | null; // none, weekly, monthly, quarterly, yearly
  remind_days_before?: number; // default 7
}

export interface CustomReminderUpdate {
  title?: string;
  remind_date?: string; // YYYY-MM-DD
  note?: string | null;
  repeat?: string | null;
  remind_days_before?: number;
}

export interface ProviderDetails {
  name: string;
  portal_url: string | null;
  claims_address: string | null;
  contacts: { label: string; value: string; contact_type: string }[];
}

/**
 * Linked contact on an item. Types: phone, email, url, address.
 * Address contacts have structured fields (address_line1..address_zip) stored in backend columns.
 * The `value` field is auto-composed by the backend from structured parts for display/fallback.
 */
export interface ItemContact {
  id: string;
  item_id: string;
  label: string;
  value: string;
  contact_type: string;
  sort_order: number;
  address_line1?: string | null;
  address_line2?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_zip?: string | null;
}

/** Create payload for contacts. For address type, send address_* fields; value is auto-composed. */
export interface ItemContactCreate {
  item_id: string;
  label: string;
  value?: string;
  contact_type?: string;
  sort_order?: number;
  address_line1?: string | null;
  address_line2?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_zip?: string | null;
}

// Coverage types
export interface CoverageRow {
  id: string;
  item_id: string;
  service_key: string;
  service_label: string;
  sort_order: number;
  in_copay: string | null;
  in_coinsurance: string | null;
  in_deductible_applies: string | null;
  in_notes: string | null;
  out_copay: string | null;
  out_coinsurance: string | null;
  out_deductible_applies: string | null;
  out_notes: string | null;
  coverage_limit: string | null;
  deductible: string | null;
  notes: string | null;
}

export interface CoverageRowIn {
  service_key: string;
  service_label: string;
  sort_order: number;
  in_copay?: string | null;
  in_coinsurance?: string | null;
  in_deductible_applies?: string | null;
  in_notes?: string | null;
  out_copay?: string | null;
  out_coinsurance?: string | null;
  out_deductible_applies?: string | null;
  out_notes?: string | null;
  coverage_limit?: string | null;
  deductible?: string | null;
  notes?: string | null;
}

export interface PlanLimit {
  id: string;
  item_id: string;
  limit_key: string;
  limit_label: string;
  limit_value: string | null;
  sort_order: number;
}

export interface PlanLimitIn {
  limit_key: string;
  limit_label: string;
  limit_value?: string | null;
  sort_order: number;
}

export interface InNetworkProviderType {
  id: string;
  item_id: string;
  provider_name: string;
  specialty: string | null;
  phone: string | null;
  address: string | null;
  network_tier: string | null;
  notes: string | null;
}

export interface InNetworkProviderCreate {
  item_id: string;
  provider_name: string;
  specialty?: string | null;
  phone?: string | null;
  address?: string | null;
  network_tier?: string | null;
  notes?: string | null;
}

// Vehicle types
/** Org-wide vehicle record (name, license plate, VIN). Assigned to auto insurance items via junction table. */
export interface Vehicle {
  id: string;
  name: string;
  license_plate: string | null;
  vin: string | null;
  acquired_date: string | null;
  owner_id: string | null;
  primary_driver_id: string | null;
  owner_name: string | null;
  primary_driver_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface VehicleCreate {
  name: string;
  license_plate?: string | null;
  vin?: string | null;
  acquired_date?: string | null;
  owner_id?: string | null;
  primary_driver_id?: string | null;
}

export interface VehicleUpdate {
  name?: string | null;
  license_plate?: string | null;
  vin?: string | null;
  acquired_date?: string | null;
  owner_id?: string | null;
  primary_driver_id?: string | null;
}

// People types
/** Org-wide person record (family members, beneficiaries, etc.). Can optionally have login access. */
export interface Person {
  id: string;
  org_id: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
  date_of_birth: string | null;
  email: string | null;
  phone: string | null;
  relationship: string | null;
  notes: string | null;
  can_login: boolean;
  user_id: string | null;
  status: "none" | "invited" | "active" | "inactive";
  created_at: string;
  updated_at: string;
}

export interface PersonCreate {
  first_name: string;
  last_name: string;
  photo_url?: string | null;
  date_of_birth?: string | null;
  email?: string | null;
  phone?: string | null;
  relationship?: string | null;
  notes?: string | null;
  can_login?: boolean;
}

export interface PersonUpdate {
  first_name?: string | null;
  last_name?: string | null;
  photo_url?: string | null;
  date_of_birth?: string | null;
  email?: string | null;
  phone?: string | null;
  relationship?: string | null;
  notes?: string | null;
  can_login?: boolean | null;
}

export interface LinkedPerson {
  id: string;
  person_id: string;
  item_id: string;
  role: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  relationship: string | null;
  created_at: string;
}

export interface DashboardStats {
  total_annual_premium: number;
  people_count: number;
  vehicles_count: number;
  policies_count: number;
}

export interface LinkedParent {
  id: string;
  item_id: string;
  name: string;
  subcategory: string;
  is_archived: boolean;
}

export interface LinkedChild {
  id: string;
  item_id: string;
  name: string;
  subcategory: string;
  is_archived: boolean;
  license_type: string | null;
  expiration_date: string | null;
  issuing_authority: string | null;
  provider: string | null;
  coverage_type: string | null;
  premium: string | null;
  document_type: string | null;
  tax_year: string | null;
  created_at: string;
}

/* Saved Contacts (global contacts directory) */
export interface SavedContact {
  id: string;
  org_id: string;
  name: string;
  company: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SavedContactCreate {
  name: string;
  company?: string | null;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  notes?: string | null;
}

export interface SavedContactUpdate {
  name?: string | null;
  company?: string | null;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  notes?: string | null;
}

export interface LinkedSavedContact {
  id: string;
  saved_contact_id: string;
  item_id: string;
  name: string;
  company: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  created_at: string;
}

// Invitation types
export interface InviteValidation {
  valid: boolean;
  email: string | null;
  full_name: string | null;
  org_name: string | null;
}

export interface PendingKeyMember {
  user_id: string;
  email: string;
  full_name: string;
  public_key: string;
}

export { ApiError };
