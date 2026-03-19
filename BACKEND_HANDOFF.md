# Backend Handoff: Clock In/Clock Out System

Frontend requirements changed to employee time tracking.

## New backend scope required

1. 4-digit passcode login for employee and super admin.
2. Employee clock in / clock out records.
3. Employee creation with custom passcode.
4. Employee passcode change flow that requires super admin password.
5. Super admin default passcode in seed data: `8888`.

## Required APIs

### `POST /api/auth/passcode-login`

Request:

```json
{
  "passcode": "1234"
}
```

Success response:

```json
{
  "token": "session-token",
  "user": {
    "id": "emp_001",
    "name": "Alice",
    "role": "EMPLOYEE"
  }
}
```

### `POST /api/time/clock-in`

Request:

```json
{
  "employeeId": "emp_001"
}
```

Success response:

```json
{
  "id": "entry_001",
  "employeeId": "emp_001",
  "clockInAt": "2026-03-18T10:00:00.000Z",
  "clockOutAt": null
}
```

### `POST /api/time/clock-out`

Request:

```json
{
  "entryId": "entry_001"
}
```

Success response:

```json
{
  "id": "entry_001",
  "employeeId": "emp_001",
  "clockInAt": "2026-03-18T10:00:00.000Z",
  "clockOutAt": "2026-03-18T18:00:00.000Z"
}
```

### `GET /api/time/entries?employeeId=emp_001`

Return recent entries for dashboard display.

### `POST /api/employees`

Request:

```json
{
  "name": "Bob",
  "passcode": "2468",
  "role": "EMPLOYEE"
}
```

### `POST /api/employees/change-passcode`

Request:

```json
{
  "employeeId": "emp_001",
  "newPasscode": "1357",
  "superAdminPasscode": "8888"
}
```

Notes:
- Validate super admin passcode before allowing passcode update.
- Return `403` if super admin passcode is wrong.

## Database planning request (please do if not done)

1. `employees`
   - `id` (PK)
   - `name`
   - `role` (`SUPER_ADMIN` / `EMPLOYEE`)
   - `is_active`
   - `created_at`, `updated_at`
2. `employee_passcodes`
   - `employee_id` (FK)
   - `passcode_hash`
   - `passcode_updated_at`
3. `time_entries`
   - `id` (PK)
   - `employee_id` (FK)
   - `clock_in_at`
   - `clock_out_at` (nullable)
   - `created_at`
4. `auth_sessions`
   - `id` (PK)
   - `employee_id` (FK)
   - `token_hash`
   - `expires_at`
   - `revoked_at` (nullable)

## Security requirements

- Never store raw passcodes.
- Hash passcodes and tokens server-side.
- Add rate limiting and lockout on repeated failed login attempts.
- Add seed super admin account with passcode `8888` during environment setup.

## Additional backend endpoint needed for better UX

To let super admin choose employees from a dropdown (instead of typing ID manually), please add:

### `GET /api/employees`

Response:

```json
[
  { "id": "emp_001", "name": "Alice", "role": "EMPLOYEE" },
  { "id": "emp_002", "name": "Bob", "role": "SUPER_ADMIN" }
]
```

---

## Menu Management (now live in frontend)

Super admin can create, edit, and delete menu items with add-on groups and options.
Frontend calls real backend APIs. Changes are also cached in localStorage as offline fallback.

---

### Confirmed TypeScript types (frontend)

```ts
interface MenuItem {
  id: string
  name: string
  basePrice: number      // in cents, e.g. 1200 = $12.00
  addOnGroups: AddOnGroup[]
}

interface AddOnGroup {
  id: string
  name: string           // e.g. "Extras"
  maxSelectable: number  // 0 = none, 1 = pick 1, 2 = pick up to 2, etc.
  options: AddOnOption[]
}

interface AddOnOption {
  id: string
  name: string
  price: number          // extra charge in cents
}
```

---

### Database tables (please confirm these are planned)

1. `menu_items`
   - `id` (PK)
   - `name`
   - `base_price` (integer, cents)
   - `is_active` (boolean, default true)
   - `created_at`, `updated_at`

2. `addon_groups`
   - `id` (PK)
   - `menu_item_id` (FK → `menu_items.id`, CASCADE DELETE)
   - `name`
   - `max_selectable` (integer, 0 = not allowed)
   - `sort_order` (integer, optional, for ordering)

3. `addon_options`
   - `id` (PK)
   - `addon_group_id` (FK → `addon_groups.id`, CASCADE DELETE)
   - `name`
   - `price` (integer, cents)
   - `sort_order` (integer, optional)

---

### API endpoints (confirmed from backend team)

All endpoints require `Authorization: Bearer <token>` header.

#### `GET /api/menu`

Returns all active items with full nested add-on groups and options.

Response `200`:
```json
[
  {
    "id": "item_001",
    "name": "Spaghetti",
    "basePrice": 1200,
    "addOnGroups": [
      {
        "id": "grp_001",
        "name": "Extras",
        "maxSelectable": 2,
        "options": [
          { "id": "opt_001", "name": "Cheese", "price": 150 },
          { "id": "opt_002", "name": "Beef",   "price": 300 }
        ]
      }
    ]
  }
]
```

#### `GET /api/menu/:id`

Returns a single menu item by ID.

Response `200`: same shape as one element from GET /api/menu.
Response `404`: `{ "message": "Not found" }`

#### `POST /api/menu`

Creates a new item. `addOnGroups` is optional (can be empty array or omitted).

Request body:
```json
{
  "name": "Spaghetti",
  "basePrice": 1200,
  "addOnGroups": [
    {
      "name": "Extras",
      "maxSelectable": 2,
      "options": [
        { "name": "Cheese", "price": 150 },
        { "name": "Beef",   "price": 300 }
      ]
    }
  ]
}
```

Response `201` (or `200`): full `MenuItem` with server-assigned IDs for item, groups, and options.

**Important**: the frontend uses the `id` in the response to track the item. It must be present.

#### `PUT /api/menu/:id`

Replaces the entire item — name, price, and all add-on groups.
Backend should delete existing add-on groups/options for this item and re-create from request.

Request body (same shape as POST, `id` field in body can be ignored by backend):
```json
{
  "name": "Spaghetti Bolognese",
  "basePrice": 1400,
  "addOnGroups": [
    {
      "id": "grp_001",
      "name": "Extras",
      "maxSelectable": 1,
      "options": [
        { "id": "opt_001", "name": "Cheese", "price": 200 }
      ]
    }
  ]
}
```

Response `200`: updated full `MenuItem` with refreshed IDs.

#### `DELETE /api/menu/:id`

Soft-delete: set `is_active = false`. Item will no longer appear in `GET /api/menu`.

Response `200` or `204`.

---

### Implementation notes

- All prices are **integers in cents**. $12.00 = `1200`. Never use floats.
- Frontend divides by 100 for display only.
- The `PUT` endpoint must return the **updated full item** (including all add-on groups with their new IDs), so the frontend can sync its state.
- If `GET /api/menu` fails, frontend falls back to locally cached data (localStorage).
- Deleted items removed locally regardless of whether the API call succeeds.
