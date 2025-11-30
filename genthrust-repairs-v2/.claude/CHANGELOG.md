# Changelog

All notable changes to the GenThrust RO Tracker v2 project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [0.1.0] - 2025-11-29

### Phase 1: Foundation

Initial setup of the authentication and database infrastructure.

### Added

#### Authentication (Auth.js v5)
- Microsoft Entra ID (Azure AD) provider configuration
- JWT session strategy with 30-day expiration
- Edge-compatible middleware for route protection
- Server actions: `signInAction()`, `signOutAction()`
- OAuth token storage including `refresh_token` for background workers
- Sign-in page at `/signin` with shadcn/ui styling
- Protected dashboard at `/dashboard` showing user info

#### Database (Drizzle ORM + Aiven MySQL)
- Global Singleton pattern for connection pooling (`connectionLimit: 10`)
- SSL configuration for Aiven cloud database
- Schema introspection to preserve existing 18 inventory tables
- 5 new Auth.js tables:
  - `users` - User profiles
  - `accounts` - OAuth accounts with refresh tokens
  - `sessions` - Session storage
  - `verificationTokens` - Email verification
  - `authenticators` - WebAuthn support

#### UI Components (shadcn/ui)
- Button component
- Card component
- Avatar component
- Updated home page with auth-aware navigation

#### Configuration Files
- `drizzle.config.ts` - Drizzle Kit configuration
- `src/auth.config.ts` - Edge-compatible auth config
- `src/auth.ts` - Main auth config with DrizzleAdapter
- `components.json` - shadcn/ui configuration
- `.env.local` - Environment variables template

### Technical Details

#### File Structure
```
src/
├── lib/
│   ├── db.ts              # Database connection (Global Singleton)
│   ├── schema.ts          # Combined inventory + auth schema
│   └── utils.ts           # Utility functions (cn)
├── components/ui/         # shadcn/ui components
├── auth.ts                # Auth.js main configuration
├── auth.config.ts         # Edge-compatible auth config
├── actions/auth.ts        # Server actions
├── middleware.ts          # Route protection
└── app/
    ├── api/auth/[...nextauth]/route.ts
    ├── (auth)/signin/page.tsx
    └── (protected)/dashboard/page.tsx
```

#### Environment Variables Required
```env
DATABASE_HOST=
DATABASE_PORT=
DATABASE_USER=
DATABASE_PASSWORD=
DATABASE_NAME=
AUTH_SECRET=
AUTH_MICROSOFT_ENTRA_ID_ID=
AUTH_MICROSOFT_ENTRA_ID_SECRET=
AUTH_MICROSOFT_ENTRA_ID_TENANT_ID=
AUTH_MICROSOFT_ENTRA_ID_ISSUER=
NEXTAUTH_URL=
```

#### Preserved Inventory Tables
- `active` - Active repair orders
- `b_e_r_r_a_i` - B.E.R.R.A.I parts
- `bins_inventory_actual` - Bins inventory
- `delta_apa` - Delta APA parts
- `hold` - Hold items
- `inventoryindex` - Inventory index
- `logs` - System logs
- `net` - Net items
- `paid` - Paid orders
- `partes_ar_asia` - AR Asia parts
- `partes_ar_asia_sanford` - AR Asia Sanford parts
- `partes_bolivia` - Bolivia parts
- `pn_no_reparadas_727` - 727 unrepairable parts
- `pn_no_reparadas_md82` - MD82 unrepairable parts
- `returns` - Returns
- `shops` - Shop information
- `stock_room_actual` - Stock room
- `terra` - Terra parts

### Dependencies Added
- `next-auth@beta` - Auth.js v5
- `@auth/drizzle-adapter` - Drizzle adapter for Auth.js
- `drizzle-orm` - TypeScript ORM
- `mysql2` - MySQL driver
- `drizzle-kit` - Migration tooling (dev)
- `class-variance-authority` - shadcn/ui dependency
- `clsx` - shadcn/ui dependency
- `tailwind-merge` - shadcn/ui dependency
- `lucide-react` - Icon library
- `@radix-ui/react-avatar` - Avatar primitive
- `@radix-ui/react-slot` - Slot primitive

---

## [0.2.0] - 2025-11-29

### Phase 2: Inventory Search

Implemented the inventory search feature using Next.js Server Actions.

### Added

#### Server Actions (`src/app/actions/inventory.ts`)
- `searchInventory(query: string)` - Fuzzy search on `inventoryindex` table
  - Searches both `partNumber` and `description` columns using SQL `LIKE`
  - Returns `Result<T>` type per CLAUDE.md guidelines
  - Limited to 50 results to prevent UI flooding
  - Minimum 2 character query requirement

#### Hooks (`src/hooks/useDebounce.ts`)
- `useDebounce<T>(value, delay)` - Generic debounce hook
  - 300ms default delay
  - Prevents excessive DB queries during typing

#### Components
- `InventorySearch` (`src/components/inventory/InventorySearch.tsx`)
  - Client component with debounced search-as-you-type
  - Uses `useTransition` for non-blocking search
  - Displays results in shadcn/ui Table
  - Shows loading state, error handling, and empty state

#### Pages
- Inventory page at `/inventory` (protected route)
  - Located at `src/app/(protected)/inventory/page.tsx`

#### UI Components (shadcn/ui)
- Input component (`src/components/ui/input.tsx`)
- Table component (`src/components/ui/table.tsx`)

### Technical Details

#### File Structure Added
```
src/
├── app/
│   ├── (protected)/
│   │   └── inventory/
│   │       └── page.tsx          # Inventory search page
│   └── actions/
│       └── inventory.ts          # Server actions
├── components/
│   ├── inventory/
│   │   └── InventorySearch.tsx   # Search component
│   └── ui/
│       ├── input.tsx             # shadcn Input
│       └── table.tsx             # shadcn Table
└── hooks/
    └── useDebounce.ts            # Debounce hook
```

#### Search Implementation
- Uses Drizzle ORM `like()` with `%query%` pattern
- Searches on indexed `partNumber` column for performance
- Falls back to `description` column for broader matches

### Dependencies Added
- None (uses existing Drizzle ORM and shadcn/ui infrastructure)

---

## Notes

### Architecture Decisions
Per `CLAUDE.md` guidelines:
- **Write-Behind Pattern**: MySQL is source of truth; Excel sync happens via background workers
- **Global Singleton**: Prevents connection pool exhaustion in serverless
- **Edge/Node Split**: Middleware uses edge-compatible config; API routes use full config with DB adapter

### Next Steps (Phase 2)
- [ ] Set up Trigger.dev for background tasks
- [ ] Implement Microsoft Graph API integration
- [ ] Add repair order CRUD operations
- [ ] Configure Excel sync workflows
