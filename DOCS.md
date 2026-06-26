# Opera Suite — Project Documentation

> Last updated: 2026-06-26
> This file is maintained by Claude and updated whenever a feature is added or changed.

---

## What Is Opera Suite?

Opera Suite is a **multi-tenant SaaS Hotel Property Management System (PMS)**. Multiple hotels can subscribe and each gets their own isolated workspace. The software brand is always "Opera Suite" — each hotel's own name appears dynamically in the UI.

Built by: Kingsley (ayozie.kingsley@gmail.com)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite |
| Styling | Tailwind CSS |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Hosting | Vercel |
| Repo | GitHub — `Kingsley06/operasuite` (Vercel watches this) and `Kingsley06/operasuites` (source of truth) |

No separate backend server. Supabase handles everything — auth, database, and Row Level Security.

---

## Multi-Tenancy Architecture

Every hotel is a **tenant**. Tenant isolation is enforced at the database level using PostgreSQL Row Level Security (RLS).

### How it works

1. Every data table has a `hotel_id` column
2. RLS policies on every table filter all queries to `hotel_id = get_my_hotel_id()`
3. `get_my_hotel_id()` is a helper function that reads the calling user's `hotel_id` from their profile
4. Users from Hotel A can never see or touch data from Hotel B — enforced at the DB level, not the app level

### Helper functions (security definer)

```sql
get_my_hotel_id() → returns the current user's hotel_id from profiles
get_my_role()     → returns the current user's role from profiles
```

Both use `SECURITY DEFINER SET search_path = public` (required by Supabase).

---

## Database Schema

### Tables

| Table | Purpose |
|-------|---------|
| `hotels` | One row per subscribed hotel (tenant) |
| `profiles` | Extends auth.users — links user to hotel + role |
| `rooms` | Hotel rooms with type, floor, status, pricing |
| `guests` | Guest records with ID verification |
| `bookings` | Reservations linking guest ↔ room |
| `housekeeping` | One record per room, tracks cleaning status |
| `maintenance` | Maintenance issues per room |

### Key constraints

- `bookings` has an **exclusion constraint** (`no_double_booking`) using `btree_gist` that prevents double-booking at the DB level — two bookings for the same room cannot overlap unless one is Cancelled or Checked Out
- `rooms` has a `UNIQUE (hotel_id, number)` constraint — no two rooms in the same hotel can share a number
- `housekeeping` has a `UNIQUE (hotel_id, room_id)` — one housekeeping record per room

### Triggers

| Trigger | When | What it does |
|---------|------|-------------|
| `on_auth_user_created` | New user signs up | Auto-creates a `profiles` row |
| `on_room_created` | New room added | Auto-creates a `housekeeping` row for it |
| `on_housekeeping_updated` | Housekeeping row updated | Refreshes `updated_at` timestamp |

### RLS Policies Summary

- **hotels** — users can only SELECT/UPDATE their own hotel; any authenticated user can INSERT (onboarding)
- **profiles** — users can only SELECT/UPDATE their own profile; owners can view all hotel staff profiles
- **rooms** — all staff can view; management/owner can insert/update; only owner can delete
- **guests** — all staff can view/insert/update; management/owner can delete
- **bookings** — all staff can view/insert/update; management/owner can delete
- **housekeeping** — all staff can view/insert/update
- **maintenance** — all staff can view/insert/update; management/owner can delete

---

## Roles & Permissions

Three roles, enforced at DB level via RLS and reflected in UI via `HotelContext`.

| Permission | Front Desk | Management | Owner |
|-----------|-----------|-----------|-------|
| View rooms/guests/bookings | ✓ | ✓ | ✓ |
| Add/edit rooms | | ✓ | ✓ |
| Delete rooms | | | ✓ |
| Add/edit guests | ✓ | ✓ | ✓ |
| Delete guests | | ✓ | ✓ |
| Add/edit bookings | ✓ | ✓ | ✓ |
| Delete bookings | | ✓ | ✓ |
| Housekeeping management | ✓ | ✓ | ✓ |
| Maintenance management | ✓ | ✓ | ✓ |
| View revenue/pricing | | ✓ | ✓ |
| Hotel settings | | | ✓ |

---

## Key Source Files

```
hotel-app/
├── src/
│   ├── App.jsx                   # Root — auth state, HotelProvider, wrap() utility
│   ├── context/
│   │   └── HotelContext.jsx      # Hotel name, role flags, createHotel() for onboarding
│   ├── hooks/
│   │   └── useStore.js           # All Supabase CRUD — rooms, guests, bookings, housekeeping, maintenance
│   ├── components/
│   │   └── Sidebar.jsx           # Brand header, hotel name strip, user section with role badge
│   ├── pages/
│   │   ├── Dashboard.jsx         # Overview stats
│   │   ├── Rooms.jsx             # Room management
│   │   ├── Guests.jsx            # Guest management
│   │   ├── Bookings.jsx          # Booking management + WhatsApp/SMS message builder
│   │   └── Operations.jsx        # Housekeeping + Maintenance
│   └── lib/
│       └── supabase.js           # Supabase client initialisation
├── supabase/
│   ├── schema.sql                # Full schema reference (human-readable)
│   ├── config.toml               # Supabase CLI project config
│   └── migrations/
│       ├── 20260621000000_initial_schema.sql         # Full schema — tables, RLS, triggers
│       ├── 20260621000001_fix_security_definer.sql   # Adds SET search_path to all functions
│       ├── 20260622000000_hotels_insert_policy.sql   # First INSERT policy attempt
│       └── 20260622000001_fix_hotels_insert_policy.sql  # Final simplified INSERT policy
└── .env.local                    # Supabase URL + anon key (gitignored — never committed)
```

---

## How `App.jsx` Works

```
ToastProvider
  └── AppContent (handles Supabase auth session)
        └── HotelProvider (loads profile + hotel from DB)
              ├── HotelSetup  ← shown if user has no hotel yet (first-time onboarding)
              └── AppShell    ← shown once hotel is set up
```

### `wrap()` utility

All store mutations are wrapped with a utility that catches errors and shows a toast:

```js
const wrap = (fn, successMsg) => async (...args) => {
  try {
    const result = await fn(...args);
    if (successMsg) toast(successMsg, 'success');
    return result;
  } catch (err) {
    toast(err.message || 'Something went wrong', 'error');
    return null;
  }
};
```

Pages receive `onAdd={wrap(store.addRoom, 'Room added')}` — they never need try/catch.

---

## `HotelContext` — What It Exposes

```js
{
  hotelId,        // UUID of the current hotel
  hotelName,      // Hotel display name (shown in sidebar)
  role,           // 'owner' | 'management' | 'front_desk'
  roleLabel,      // 'Owner' | 'Management' | 'Front Desk'
  isOwner,
  isManagement,
  isFrontDesk,
  canManageRooms,
  canDeleteGuests,
  canViewRevenue,
  canAccessPricing,
  createHotel(),  // Used by onboarding screen — inserts hotel + sets profile as owner
  refresh(),      // Re-fetches profile + hotel from DB
}
```

---

## `useStore` — Data Layer

All state lives here. Replaces the old localStorage layer entirely.

- Loads rooms, guests, bookings, housekeeping, maintenance in parallel on mount
- `toCamel()` / `toSnake()` converters at the Supabase boundary — components always use camelCase
- All mutations are async and throw on error (caught by `wrap()` in App.jsx)
- `checkOutBooking` increments `guest.total_stays` and updates `guest.last_visit`
- `addBooking` sets status to `Active` if check-in is today, `Upcoming` otherwise

---

## Onboarding Flow (New Hotel Signup)

1. Owner signs up or is created in Supabase Auth → trigger auto-creates their `profiles` row
2. App detects `profile.hotel_id === null` → shows `HotelSetup` form
3. Owner enters hotel name, email, phone, address → `createHotel()` runs:
   - Generates a UUID client-side (`crypto.randomUUID()`)
   - Inserts into `hotels` with that ID
   - Updates their `profiles` row: `hotel_id = newId, role = 'owner'`
4. Context reloads → app opens into the full dashboard

---

## Adding Staff

Staff invitation UI is not built yet. Currently done manually via Supabase SQL Editor:

```sql
-- 1. Create the user in Auth (Dashboard → Authentication → Users → Add user)

-- 2. Link them to the hotel with a role:
UPDATE profiles
SET hotel_id = '<hotel_uuid>',
    role = 'front_desk',   -- or 'management'
    full_name = 'Staff Name'
WHERE id = '<staff_auth_uuid>';
```

---

## Local Development

```bash
cd hotel-app
npm install
npm run dev        # starts at http://localhost:5173
```

Requires `.env.local` with:
```
VITE_SUPABASE_URL=https://mweezcsapsjperhaefqx.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

---

## Deployment

- **Hosting:** Vercel — connected to `Kingsley06/operasuite` GitHub repo, auto-deploys on push to `main`
- **Env vars required in Vercel:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- **Database changes:** Push via Supabase CLI — `supabase db push` (requires `SUPABASE_ACCESS_TOKEN`)
- **Supabase CLI binary:** `C:\Users\USER\AppData\Local\supabase-cli\supabase.exe`
- **Project ref:** `mweezcsapsjperhaefqx`

---

## What's Been Built

- [x] Multi-tenant Supabase schema with full RLS
- [x] Three roles: owner, management, front_desk
- [x] Auth flow (login, session management)
- [x] Hotel onboarding (first-time setup form)
- [x] Sidebar with Opera Suite brand + dynamic hotel name + role badge
- [x] Rooms page — add, edit, delete, status updates
- [x] Guests page — add, edit, delete, stay history
- [x] Bookings page — add, check-in, check-out, cancel + WhatsApp/SMS message builder
- [x] Operations page — housekeeping status + maintenance issues
- [x] Dashboard — overview stats
- [x] GitHub repo + Vercel deployment

## What's Not Built Yet

- [ ] Staff invitation UI (owners can invite staff by email)
- [ ] User management page (owner can see/edit/remove staff)
- [ ] Role-based UI hiding (DB enforces it, but buttons not hidden for unauthorised roles yet)
- [ ] Hotel settings page (owner can update hotel name, contact, address)
- [ ] React Router (back button doesn't work — manual page state switching)
- [ ] Revenue / reporting page
- [ ] Subscription / billing (SaaS payments)
