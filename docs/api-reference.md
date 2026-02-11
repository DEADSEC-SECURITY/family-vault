---
layout: default
title: API Reference
nav_order: 3
---

# API Reference

Base URL: `http://localhost:8000/api`

All endpoints (except `/auth/*`) require `Authorization: Bearer <token>` header.

---

## Auth

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/auth/register` | `{email, password, full_name}` | `{token, user}` |
| POST | `/auth/login` | `{email, password}` | `{token, user}` |
| POST | `/auth/logout` | -- | 204 |
| GET | `/auth/me` | -- | `UserResponse` |

## Categories

| Method | Path | Response |
|--------|------|----------|
| GET | `/categories` | `CategoryListItem[]` |
| GET | `/categories/{slug}` | `CategoryResponse` (includes subcategories + field definitions) |

## Items

| Method | Path | Body/Query | Response |
|--------|------|------------|----------|
| GET | `/items` | `?category&subcategory&page&limit` | `ItemListResponse` |
| POST | `/items` | `ItemCreate` | `ItemResponse` |
| GET | `/items/{id}` | -- | `ItemResponse` |
| PUT | `/items/{id}` | `ItemUpdate` | `ItemResponse` |
| DELETE | `/items/{id}` | -- | 204 (soft delete) |

## Files

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/files/upload` | multipart: `file`, `item_id`, `purpose` | `FileUploadResponse` |
| GET | `/files/{id}` | -- | Binary (decrypted) |
| DELETE | `/files/{id}` | -- | 204 |

**Allowed MIME types**: jpeg, png, webp, gif, pdf, doc, docx. **Max size**: 25 MB.

## Reminders

| Method | Path | Body/Query | Response |
|--------|------|------------|----------|
| GET | `/reminders` | -- | `Reminder[]` (auto + custom, merged) |
| GET | `/reminders/overdue` | -- | `Reminder[]` |
| GET | `/reminders/custom` | `?item_id` | `Reminder[]` |
| POST | `/reminders/custom` | `{item_id, title, remind_date, note?, repeat?}` | `Reminder` |
| PUT | `/reminders/custom/{id}` | `{title?, remind_date?, note?, repeat?}` | `Reminder` |
| DELETE | `/reminders/custom/{id}` | -- | 204 |

## Contacts

| Method | Path | Body/Query | Response |
|--------|------|------------|----------|
| GET | `/contacts` | `?item_id` | `ItemContact[]` |
| POST | `/contacts` | `ItemContactCreate` | `ItemContact` |
| PUT | `/contacts/reorder` | `{contacts: [{id, sort_order}]}` | `{ok: true}` |
| PATCH | `/contacts/{id}` | `ItemContactUpdate` | `ItemContact` |
| DELETE | `/contacts/{id}` | -- | 204 |

**Contact types**: `phone`, `email`, `url`, `address`

## Coverage (Insurance)

| Method | Path | Body/Query | Response |
|--------|------|------------|----------|
| GET | `/coverage/rows` | `?item_id` | `CoverageRow[]` |
| PUT | `/coverage/rows` | `{item_id, rows[]}` | `CoverageRow[]` |
| GET | `/coverage/limits` | `?item_id` | `PlanLimit[]` |
| PUT | `/coverage/limits` | `{item_id, limits[]}` | `PlanLimit[]` |
| GET | `/coverage/providers` | `?item_id` | `InNetworkProvider[]` |
| POST | `/coverage/providers` | `InNetworkProviderCreate` | `InNetworkProvider` |
| DELETE | `/coverage/providers/{id}` | -- | 204 |

## Vehicles

| Method | Path | Body/Query | Response |
|--------|------|------------|----------|
| GET | `/vehicles` | -- | `Vehicle[]` |
| POST | `/vehicles` | `VehicleCreate` | `Vehicle` |
| PATCH | `/vehicles/{id}` | `VehicleUpdate` | `Vehicle` |
| DELETE | `/vehicles/{id}` | -- | 204 |
| GET | `/vehicles/item/{item_id}` | -- | `Vehicle[]` |
| POST | `/vehicles/item/{item_id}` | `{vehicle_id}` | `{ok: true}` |
| DELETE | `/vehicles/item/{item_id}/{vehicle_id}` | -- | 204 |

## People

| Method | Path | Body/Query | Response |
|--------|------|------------|----------|
| GET | `/people` | -- | `Person[]` |
| POST | `/people` | `PersonCreate` | `Person` |
| PATCH | `/people/{id}` | `PersonUpdate` | `Person` |
| DELETE | `/people/{id}` | -- | 204 |

## Visas

| Method | Path | Query | Response |
|--------|------|-------|----------|
| GET | `/visas/types` | `?q` | `string[]` |
| GET | `/visas/contacts/{country}` | -- | `CountryContacts` |

## Providers

| Method | Path | Query | Response |
|--------|------|-------|----------|
| GET | `/providers/insurance` | `?q` | `{providers: string[]}` |
| GET | `/providers/insurance/{name}/details` | -- | `ProviderDetails` |

## Search

| Method | Path | Query | Response |
|--------|------|-------|----------|
| GET | `/search` | `?q` | `ItemListResponse` |

## Dashboard

| Method | Path | Response |
|--------|------|----------|
| GET | `/dashboard` | `{categories, recentItems, reminders}` |

## Health Check

| Method | Path | Response |
|--------|------|----------|
| GET | `/health` | `{status: "ok"}` |
