# Light/Dark Mode Audit Tracking

**Branch:** `UI_global_color`
**Started:** 2025-12-09
**Goal:** Make entire application fully responsive to light/dark mode toggle

---

## Task Context (For Context Resumption)

If context window is compacted, resume from this checklist. The goal is to audit ALL components, pages, and UI elements to ensure they properly respond to Tailwind's dark mode (using `dark:` prefix or CSS variables that respect theme).

## How Tailwind Dark Mode Works in This Project

- Theme controlled by `next-themes` package
- Dark mode is the default (set in `ThemeProvider.tsx`)
- Uses class-based dark mode: `<html class="dark">`
- Tailwind config uses `darkMode: "class"`
- CSS variables defined in `globals.css` for both `:root` and `.dark` selectors

---

## Pages to Audit

### 1. Dashboard (`/dashboard`)
- [ ] `page.tsx` - Main dashboard page
- [ ] `StatsGrid.tsx` - Statistics grid
- [ ] `StatTicker.tsx` - Stat ticker component
- [ ] `RepairOrderTable.tsx` - Main data table
- [ ] `StatusBadge.tsx` - Status badges
- [ ] `DashboardFilterBar.tsx` - Filter bar
- [ ] `PipelineRail.tsx` - Pipeline rail component
- [ ] `AutoImportTrigger.tsx` - Auto import component

### 2. Summary Page (`/summary`)
- [ ] `page.tsx` - Summary page
- [ ] `SummaryList.tsx` - Summary list
- [ ] `SummaryCard.tsx` - Summary cards

### 3. Inventory Page (`/inventory`)
- [ ] `page.tsx` - Inventory page
- [ ] `InventoryContent.tsx` - Content wrapper
- [ ] `WarehouseOverview.tsx` - Overview dashboard
- [ ] `InventoryOmnibar.tsx` - Search bar
- [ ] `InventoryTable.tsx` - Table view
- [ ] `InventoryCard.tsx` - Mobile cards

### 4. Sign-in Page (`/signin`)
- [ ] `page.tsx` - Login page
- [ ] `BlueprintPattern.tsx` - Background pattern

---

## Layout Components to Audit

- [ ] `Header.tsx` - Main header
- [ ] `Navigation.tsx` - Nav tabs
- [ ] `NotificationBell.tsx` - Notification dropdown
- [ ] `UserProfileDropdown.tsx` - User menu
- [ ] `ExcelDropdownButton.tsx` - Excel menu

---

## Shared UI Components to Audit

### shadcn/ui Components (`/components/ui/`)
- [ ] `button.tsx`
- [ ] `card.tsx`
- [ ] `badge.tsx`
- [ ] `dialog.tsx`
- [ ] `dropdown-menu.tsx`
- [ ] `input.tsx`
- [ ] `select.tsx`
- [ ] `sheet.tsx`
- [ ] `tabs.tsx`
- [ ] `toast.tsx` / `sonner.tsx`
- [ ] `checkbox.tsx`
- [ ] `sparkline.tsx`
- [ ] `dot-status.tsx`

---

## Modal/Dialog Components to Audit

- [ ] `RODetailPanel.tsx` - RO detail drawer
- [ ] `AddRODialog.tsx` - Add RO form
- [ ] `EmailPreviewDialog.tsx` - Email preview
- [ ] `EditableEmailPreview.tsx` - Email editor
- [ ] `BatchPromptDialog.tsx` - Batch email prompt
- [ ] `Assistant.tsx` - AI assistant modal

---

## Common Issues to Look For

1. **Hardcoded Colors**
   - Look for: `text-gray-*`, `bg-white`, `text-black`, `border-gray-*`
   - Should be: `text-foreground`, `bg-background`, `border-border` or with `dark:` variants

2. **Inline Styles**
   - Look for: `style={{ color: '#fff' }}` or similar
   - Should be: Tailwind classes with dark mode support

3. **Missing dark: Variants**
   - Look for: Single-mode classes without corresponding `dark:` variant
   - Example: `text-gray-600` should have `dark:text-gray-400`

4. **Prose/Markdown Content**
   - Should use: `prose dark:prose-invert`

5. **SVG/Icon Colors**
   - Should use: `currentColor` or text classes that respond to theme

6. **Form Inputs**
   - Check: placeholder colors, border colors, focus states

---

## Completed Fixes

| Component | Issue | Fix Applied | Date |
|-----------|-------|-------------|------|
| `batch-email-template.ts` | Table headers invisible in dark mode | Added explicit `color: #1f2937` for headers, `#374151` for body | 2025-12-09 |
| `EmailPreviewDialog.tsx` | Email body doesn't scroll | Changed to `flex flex-col min-h-0` layout | 2025-12-09 |
| `signin/page.tsx` | Hardcoded `bg-white` and `ring-black/5` | Changed to `bg-card border border-border` | 2025-12-09 |
| `StatusBadge.tsx` | Light mode opacity too subtle (20%) | Used explicit Tailwind colors with dark: variants | 2025-12-09 |

---

## In Progress

| Component | Issue | Notes |
|-----------|-------|-------|
| `dialog.tsx` | Hardcoded `bg-black/50` overlay | Low priority - works acceptably |
| `RepairOrderTable.tsx` | Hover state contrast weak in light mode | Low priority - CSS variables handle this |

---

## Notes

- This app uses a "cockpit" dark-first design (Phase 22 - Aero-Glass UI)
- Default theme is dark, but light mode should still work
- Many components may already work due to CSS variable usage
- Focus on components that use hardcoded colors

---

## How to Test

1. Run the app locally: `npm run dev`
2. Toggle theme using browser dev tools or add theme toggle
3. Check each component in both modes
4. Look for invisible text, wrong backgrounds, poor contrast
