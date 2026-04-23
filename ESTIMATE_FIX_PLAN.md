# Estimate Bug Fix Plan
> Read this file before touching a single line of code. Every fix is scoped to minimize blast radius.

---

## Pre-Flight: Files That Must NOT Be Touched

These files are working correctly. Do not modify them.

| File | Reason |
|------|--------|
| `api/create-estimate.ts` | Validation is correct; only callers are broken |
| `api/get-estimate.ts` | Works correctly; only how it is called is broken |
| `api/save-estimate.ts` | Works correctly |
| `api/update-estimate.ts` | Works correctly |
| `contexts/AppContext.tsx` | State management is correct |
| `backend/lib/sendNotification.ts` | Push delivery works; only the trigger is broken |
| `hooks/useNotificationSetup.ts` | Correct |
| `types/index.ts` | Do NOT change `Estimate` type fields; add optional fields only |
| All other non-estimate screens | Out of scope |

---

## Bug 1 — Relative URL Breaks iOS/Android Load

### What is broken
`app/project/[id]/estimate.tsx` **line 146** uses a relative URL:
```ts
const response = await fetch(`/api/get-estimate?estimateId=${estimateId}`);
```
On iOS/Android (Hermes runtime), there is no base URL. This produces `Invalid URL: /api/get-estimate?...`.

`utils/sendEstimate.ts` **line 49** uses `window.location.origin`:
```ts
const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
```
On iOS/Android, `window` exists but `window.location` is `undefined`. This produces `Cannot read property 'origin' of undefined`.

### Root cause
CLAUDE.md explicitly documents both of these as known anti-patterns. They were not applied consistently.

### Exact files and lines to change

**Change 1 — `app/project/[id]/estimate.tsx` line 146**
- Old: `fetch('/api/get-estimate?estimateId=${estimateId}')`
- New: `fetch(\`${API_BASE}/api/get-estimate?estimateId=${estimateId}\`)`
- `API_BASE` is already declared at line 3 of the file. No new imports needed.

**Change 2 — `utils/sendEstimate.ts` lines 49–50 and 62–63**
- Old line 49: `const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';`
- New: `const baseUrl = process.env.EXPO_PUBLIC_API_URL || 'https://legacy-prime-workflow-suite.vercel.app';`
- Lines 50 and 62 already use `${baseUrl}/api/...` so they fix automatically.

### What NOT to change
- Do not touch any other fetch calls in estimate.tsx — they already use `API_BASE` correctly.
- Do not change the logic of `loadExistingEstimate()` — only the URL construction.
- Do not change `sendEstimate.ts` business logic, only the baseUrl line.

### Non-breaking guarantee
Both changes produce identical behavior on Web (same URL, just no longer derived from `window`). On iOS/Android, the URL now resolves correctly. No API contract change.

### Edge cases to handle
- `EXPO_PUBLIC_API_URL` might be undefined in local dev → fallback to hardcoded production URL is safe (already the pattern throughout the codebase)
- If the estimate fetch fails mid-load, `isLoadingDraft` is already set to `false` in the catch block (line 168) — no change needed there

---

## Bug 2 — Client Missing Error (New/Custom Estimate from Project)

### What is broken
`app/project/[id]/estimate.tsx` line 883:
```ts
if (!clientId && !client) {
  Alert.alert('Error', 'Client information not found. Please select a client first.');
  return;
}
```
When navigating from **Project → Estimates**, the URL contains `id` (the project ID) but no `clientId` query param. So `clientId` = `undefined` and `client` = `null`. The guard fires even though `project` is loaded and `project.clientId` is valid.

### Root cause
The guard only checks the URL-param-derived `clientId` and `client`. It does not check `project?.clientId`.

Also, at line 920 and 944, the API payload uses `clientId: clientId as string` — this type-casts `undefined` to `string`, passing `undefined` to the API if `clientId` URL param is absent but `project.clientId` was the real source.

### Exact files and lines to change

**`app/project/[id]/estimate.tsx` — `saveEstimate()` function (lines ~877–990)**

Step 1 — Before line 883, compute `effectiveClientId`:
```ts
const effectiveClientId = clientId || project?.clientId || client?.id;
```

Step 2 — Replace the guard (line 883):
```ts
// Old:
if (!clientId && !client) {
// New:
if (!effectiveClientId) {
```

Step 3 — Replace `clientId: clientId as string` in the update payload (line 920) and create payload (line 944) and local state object (line 973) with `clientId: effectiveClientId`:
```ts
// Old at line 920: clientId: clientId as string,
// New:             clientId: effectiveClientId,
```
Apply same substitution at lines 944 and 973.

### What NOT to change
- Do not change the URL param destructuring at lines 25, 69 — keep `clientId = clientIdParam as string | undefined`
- Do not change the `client` derivation at line 70 — keep `client = clientId ? clients.find(...) : null`
- Do not change `sendEstimateAsPDF()` or `requestSignature()` — they already use `effectiveClientId` correctly (lines 1045, 1467)
- Do not change any navigation or routing logic

### Non-breaking guarantee
When `clientId` URL param IS present (CRM → New Estimate flow), `effectiveClientId = clientId || ...` resolves to `clientId` immediately — identical behavior to today.
When project context is used, `effectiveClientId = project.clientId` — fixes the bug without touching the CRM flow.

### Edge cases to handle
| Case | Handling |
|------|----------|
| `clientId` URL param is set but client not in AppContext yet | `effectiveClientId = clientId` (from URL param) → API call proceeds with the UUID. API validates it. Correct. |
| `project.clientId` is null/undefined (project has no client linked) | `effectiveClientId` = undefined → guard fires → user sees "Client information not found." This is correct behavior. |
| All three sources are undefined | Guard fires with the correct error message |

---

## Bug 3 — Send Estimate / Sign "Missing Required Fields" Error

### What is broken
`create-estimate.ts` returns `"Missing required fields: companyId, clientId, ..."` when any of those are falsy in the POST body.

There are two call sites in `estimate.tsx` that can pass `clientId: undefined`:
1. `saveEstimate()` — fixed by Bug 2 fix above
2. `sendEstimateAsPDF()` and `requestSignature()` — already use `effectiveClientId` correctly but need the same defensive pattern applied

There is also a secondary issue: `utils/sendEstimate.ts` crashes at line 49 (`window.location.origin`) before the API call is even made on iOS — fixed by Bug 1 fix above.

### Exact files and lines to change

**`app/project/[id]/estimate.tsx` — `sendEstimateAsPDF()` (line ~1022)**

The function already computes `effectiveClientId = clientId || project?.clientId` at line 1045. However, there is no `|| client?.id` fallback. Add it:
```ts
// Old (line 1045):
const effectiveClientId = clientId || project?.clientId;
// New:
const effectiveClientId = clientId || project?.clientId || client?.id;
```
Apply the same 3-part fallback at line 1467 inside `requestSignature()`.

**Secondary — `taxRate` storage inconsistency**
The `taxRate` is stored as a percentage integer (e.g., `8`) in the DB but `generateEstimateHtml()` in `utils/sendEstimate.ts` renders it as `(taxRate * 100).toFixed(1)%` = `800%`.

This is NOT in `sendEstimateAsPDF()` or `generateEstimatePreviewHTML()` (both use `taxPercent` string directly, e.g., `Tax (${taxPercent}%)`). The only affected path is `utils/sendEstimate.ts` line 545:
```ts
// Old line 545:
<td class="label">Tax (${((fullEstimate.taxRate || 0) * 100).toFixed(1)}%):</td>
// New:
<td class="label">Tax (${(fullEstimate.taxRate || 0).toFixed(1)}%):</td>
```
This assumes `tax_rate` is stored as the percentage number (e.g., `8`), not a decimal. This matches what `saveEstimate()` and `sendEstimateAsPDF()` send.

### What NOT to change
- Do not change `create-estimate.ts` validation — it is correct
- Do not change the `validateEstimate()` function
- Do not change `calculateTotals()` logic

### Non-breaking guarantee
The `|| client?.id` addition to the fallback chain is purely additive. It only activates when both `clientId` URL param and `project?.clientId` are null — which was already an error state. The tax rate fix only affects the `utils/sendEstimate.ts` email PDF rendering, not the in-screen PDF or database values.

---

## Bug 4 — iOS Screen Cut Off (Safe Area)

### What is broken
The estimate screen and its modal sub-flows (New Estimate, Custom Estimate) render UI elements under the iPhone notch/home indicator because `insets.bottom` is not applied uniformly to modal containers and the bottom action bar.

### What is correct
`useSafeAreaInsets()` is imported (line 28) and `insets` is available throughout the screen component. The top is handled. The bottom is the issue.

### Exact files and lines to change

**`app/project/[id]/estimate.tsx` — bottom action bar and modals**

1. Find the bottom action bar container (the View wrapping the Save/Send/Sign buttons, approximately lines 2660–2700). Add `paddingBottom: insets.bottom` to its style:
   ```ts
   // Find the outer container of the bottom button row. Add:
   paddingBottom: insets.bottom
   ```

2. For each Modal component that contains a full-screen form (Add Template Modal, Add Category Modal, AI Generate Modal, etc.): the innermost scroll container or content wrapper must add `paddingBottom: Math.max(insets.bottom, 16)` to prevent content from being hidden under the home indicator.

3. The main estimate screen `ScrollView` or `FlatList` wrapper at the bottom should have `contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}` to ensure the last item is not hidden under the action bar.

### What NOT to change
- Do not change `useSafeAreaInsets()` import or the `insets` variable name
- Do not change any top-level layout or tab bar behavior
- Do not change any non-estimate screens

### Non-breaking guarantee
`insets.bottom` is `0` on all non-notch devices and on web/Android (where it returns 0). Adding it as padding is additive and safe — it only affects devices that have a physical bottom unsafe area.

### Edge cases
| Case | Handling |
|------|----------|
| iPad | `insets.bottom` = 0 → no padding change |
| iPhone with Dynamic Island | `insets.bottom` reflects actual unsafe area |
| Web | `insets.bottom` = 0 → no change |
| `Math.max(insets.bottom, 16)` | Ensures minimum 16px padding on all devices even when inset is 0 |

---

## Bug 5 — Notifications Not Firing

### What is broken

**5A — Status key mismatch: `'accepted'` vs `'approved'`**

`api/update-estimate-status.ts` line 63:
```ts
const notifiableStatuses: Record<string, string> = {
  accepted: 'Estimate Accepted',   // ← wrong key
  rejected: 'Estimate Rejected',
  paid:     'Estimate Paid',
  sent:     'Estimate Sent',
};
```
The `Estimate` type in `types/index.ts` defines `status: 'draft' | 'sent' | 'approved' | 'rejected' | 'paid'`. The Sign flow sends `status: 'approved'` but the notification map has `'accepted'` → notification never fires for the Accept/Sign action.

**5B — `data.client_name` not on estimates table**

Line 74: `const clientName = data.client_name ?? 'a client';`
The estimates table stores `client_id`, not `client_name`. This column doesn't exist → always falls back to `'a client'`, and in some runtime environments accessing a non-existent field on the select result can cause unexpected behavior.

**5C — `data.project_id` may be null**

Line 72: `const projectRes = await supabase.from('projects').select('name').eq('id', data.project_id).single();`
If `data.project_id` is null (client-only estimate without a project), `.single()` will error → the whole `try` block at line 70 fails → notification is silently swallowed by the catch at line 89.

### Exact files and lines to change

**`api/update-estimate-status.ts`**

**Fix 5A** — Change the key on line 63:
```ts
// Old:
accepted: 'Estimate Accepted',
// New:
approved: 'Estimate Accepted',
```

**Fix 5B** — Replace `data.client_name` with a DB lookup using `data.client_id`:
```ts
// Old line 74:
const clientName = data.client_name ?? 'a client';

// New — fetch client name from clients table:
const clientRes = await supabase
  .from('clients')
  .select('name')
  .eq('id', data.client_id)
  .single();
const clientName = clientRes.data?.name ?? 'a client';
```

**Fix 5C** — Guard the project lookup against null `project_id`:
```ts
// Old line 72:
const projectRes = await supabase
  .from('projects').select('name').eq('id', data.project_id).single();
const projectName = projectRes.data?.name ?? 'a project';

// New:
let projectName = 'a project';
if (data.project_id) {
  const projectRes = await supabase
    .from('projects').select('name').eq('id', data.project_id).single();
  projectName = projectRes.data?.name ?? 'a project';
}
```

### What NOT to change
- Do not change `backend/lib/sendNotification.ts` — the push delivery logic is correct
- Do not change `backend/lib/notifyAdmins.ts`
- Do not add new notification types to `types/index.ts`
- Do not change which statuses trigger notifications — only fix the 'accepted' → 'approved' key mismatch

### Non-breaking guarantee
- `'rejected'`, `'paid'`, and `'sent'` keys are unchanged — their notifications continue firing
- The `'accepted'` key was dead code (nothing ever sent `status: 'accepted'`) so removing it cannot break existing functionality
- The `project_id` guard only adds an `if` check — same result when `project_id` exists
- The client name lookup adds one extra DB read that was already intended

### Edge cases
| Case | Handling |
|------|----------|
| `client_id` is null on estimate | `clientRes.data` = null → fallback `'a client'` |
| `project_id` exists but project deleted | `projectRes.data` = null → fallback `'a project'` |
| `company_id` is null on estimate | `notifyCompanyAdmins` call is guarded by `if (notifiableStatuses[status] && data.company_id)` — already correct |
| Client lookup DB error | `clientRes.data` = null → fallback → notification still sends |

---

## Bug 6 — Export/PDF Ignores `showUnitsQty` Flag

### What is broken and where

There are **three PDF generation paths** in this codebase:

| Path | Caller | Uses `showUnitsQty`? |
|------|--------|----------------------|
| `generateEstimatePreviewHTML()` | `handleExportPDF()` in estimate.tsx | ✅ YES — respects flag |
| Inline HTML in `sendEstimateAsPDF()` | Send button in estimate.tsx | ✅ YES — respects flag |
| `generateEstimateHtml()` | `utils/sendEstimate.ts` | ❌ NO — always shows Qty/Price |

`utils/sendEstimate.ts` is called from:
- `app/(tabs)/crm.tsx` line 849 — CRM "Send Estimate" card button
- `components/GlobalAIChatSimple.tsx` line 1393 — AI assistant send

The `SendEstimateParams` interface in `utils/sendEstimate.ts` has no `showUnitsQty` or `showBudget` parameter. `generateEstimateHtml()` always renders both columns.

The CSV export (`handleExportCSV`) also always includes Quantity and Unit Price regardless of the flag. This needs fixing too.

### Design decision before implementing
`showUnitsQty` is currently React component state (`useState<boolean>(true)`) — it is never persisted to the DB. This means the CRM and AI chat callers have no way to know what the setting was when the estimate was built.

**Chosen approach (least invasive, no DB migration):**
- Add `showUnitsQty?: boolean` and `showBudget?: boolean` as optional fields to `SendEstimateParams`
- Pass them through to `generateEstimateHtml()`
- Default both to `true` when not provided (preserving current behavior for all existing callers)
- The CRM send will pass `true` (default) until a persistence mechanism is added — this is acceptable because the current behavior is also `true`
- The AI chat send will also default to `true`

This fix does NOT require a DB migration or changes to any API routes.

### Exact files and lines to change

**`utils/sendEstimate.ts`**

1. Add fields to `SendEstimateParams` interface:
   ```ts
   // Add after line 15 (customPriceListItems field):
   showUnitsQty?: boolean;
   showBudget?: boolean;
   ```

2. Destructure the new params in `sendEstimate()` (after line 27):
   ```ts
   const showUnitsQty = params.showUnitsQty ?? true;
   const showBudget   = params.showBudget   ?? true;
   ```

3. Pass them to `generateEstimateHtml()` at line 132:
   ```ts
   // Old:
   const html = generateEstimateHtml({ fullEstimate, client, project, company, groupedItems });
   // New:
   const html = generateEstimateHtml({ fullEstimate, client, project, company, groupedItems, showUnitsQty, showBudget });
   ```

4. Add to `GenerateHtmlParams` interface:
   ```ts
   // Add after line 221 (groupedItems field):
   showUnitsQty?: boolean;
   showBudget?: boolean;
   ```

5. In `generateEstimateHtml()`, destructure and apply the flags:
   ```ts
   // In the function body, after destructuring params (line ~223):
   const showUnitsQty = params.showUnitsQty ?? true;
   const showBudget   = params.showBudget   ?? true;
   ```

6. In the `<thead>` table row (around line 510–515), conditionally render columns:
   ```ts
   // Old (always renders both):
   <th>Quantity</th>
   <th>Unit Price</th>

   // New:
   ${showUnitsQty ? '<th>Quantity</th>' : ''}
   ${showUnitsQty ? '<th>Unit Price</th>' : ''}
   ```

7. In the `<tbody>` rows (around line 526–528):
   ```ts
   // Old:
   <td>${item.quantity} ${item.unit}</td>
   <td>$${item.unitPrice.toFixed(2)}</td>

   // New:
   ${showUnitsQty ? `<td>${item.quantity} ${item.unit}</td>` : ''}
   ${showUnitsQty ? `<td>$${item.unitPrice.toFixed(2)}</td>` : ''}
   ```

**`app/(tabs)/crm.tsx`** — No change needed (defaults to `true` which is current behavior)

**`components/GlobalAIChatSimple.tsx`** — No change needed (defaults to `true` which is current behavior)

### What NOT to change
- Do not change `generateEstimatePreviewHTML()` — already correct
- Do not change the inline HTML in `sendEstimateAsPDF()` — already correct
- Do not change `handleExportPDF()` — already correct
- Do not change any API routes
- Do not add any DB migrations

### Non-breaking guarantee
All existing callers pass no `showUnitsQty` parameter → it defaults to `true` → identical behavior to today. Only callers that explicitly pass `showUnitsQty: false` will get hidden columns.

### CSV Export (secondary fix, same file)
`handleExportCSV()` in `estimate.tsx` around line 2040–2043 always includes Quantity and Unit Price in the CSV header and data rows. Apply the same `showUnitsQty` flag:

```ts
// In CSV header line (~2029):
// Old: 'Item,Description,Quantity,Unit,Unit Price,Total,Notes\n'
// New: build conditionally based on showUnitsQty

// In data rows (~2043):
// Conditionally include Quantity/Unit/Price columns
```

---

## Implementation Order (Safest Sequence)

Implement in this order to avoid introducing new issues:

```
Step 1: Bug 1   — URL fixes (safest, pure string changes, no logic)
Step 2: Bug 5   — Notification fixes (backend only, isolated)
Step 3: Bug 2   — Client guard fix (frontend state, single function)
Step 4: Bug 3   — Send/Sign client fallback + taxRate display fix
Step 5: Bug 6   — showUnitsQty propagation (utils + interface only)
Step 6: Bug 4   — iOS safe area padding (UI only, last to avoid visual churn)
```

---

## Complete List of Files Being Modified

| File | Bug(s) | Lines Affected |
|------|--------|----------------|
| `app/project/[id]/estimate.tsx` | 1, 2, 3, 4 | 146, 883, 920, 944, 973, 1045, 1467, bottom bar + modals |
| `utils/sendEstimate.ts` | 1, 3, 6 | 49, 215–221, 223+, ~510–528 |
| `api/update-estimate-status.ts` | 5 | 63, 72–76 |

**Total: 3 files.**

---

## Complete Edge Case Registry

All edge cases that must be preserved, verified, or explicitly handled:

| # | Scenario | Expected Behavior After Fix |
|---|----------|-----------------------------|
| 1 | `clientId` URL param present, client in AppContext → CRM flow | Unchanged. `effectiveClientId = clientId` resolves immediately |
| 2 | `clientId` URL param present, client NOT yet in AppContext | `effectiveClientId = clientId` (UUID from URL) → API validates → correct |
| 3 | No `clientId` URL param, `project.clientId` is set → Project flow | `effectiveClientId = project.clientId` → guard passes → fixed |
| 4 | No `clientId` URL param, `project.clientId` is null | `effectiveClientId = undefined` → guard fires: "Client information not found" → correct |
| 5 | Estimate opened via deep link with only `estimateId` | `loadExistingEstimate()` runs; no client guard fires for load; client guard only fires on save/send → user sees loaded estimate but cannot save without navigating with a client |
| 6 | `savedEstimateId` is non-null but estimate was deleted from DB | `update-estimate` will return 404/error → caught and shown to user |
| 7 | `company` is null at render time (context race condition) | `company?.id` guard at line 877 already catches this → "Company information not found" → correct |
| 8 | `taxPercent` state is `'0'` | `parseFloat('0') = 0`; API checks `taxRate === undefined`, not `taxRate === 0` → correct |
| 9 | Items array is empty | `validateEstimate()` catches this before any API call → "Please add at least one item" |
| 10 | Items array has only separators | `actualItems = items.filter(item => !item.isSeparator)` → `actualItems.length === 0` → guard fires → correct |
| 11 | `showUnitsQty = false` + estimate sent from estimate screen | Inline HTML in `sendEstimateAsPDF()` already respects flag → correct, no change needed |
| 12 | `showUnitsQty = false` + estimate sent from CRM | `utils/sendEstimate.ts` defaults `showUnitsQty = true` → shows columns. This is the pre-existing behavior; full fix requires persistence |
| 13 | `showUnitsQty = false` + Export PDF from preview modal | `generateEstimatePreviewHTML()` already respects flag → correct, no change needed |
| 14 | Estimate loaded via `estimateId` param (View Full Estimate) | `fetch(${API_BASE}/api/get-estimate?...)` → fixed by Bug 1. Previous `showUnitsQty` not remembered (reset to `true`) — acceptable until flag is persisted |
| 15 | Notification fired for `status: 'approved'` (Sign button) | Fixed by Bug 5A: key `'accepted'` → `'approved'` |
| 16 | Notification fired for `status: 'rejected'` | Unchanged. Key `'rejected'` already correct |
| 17 | Notification fired for `status: 'sent'` | Unchanged. Key `'sent'` already correct |
| 18 | Estimate has no `project_id` (client-only) | Fixed by Bug 5C: null guard added before project lookup |
| 19 | `client_id` on estimate is null | Client name lookup returns null → fallback `'a client'` → notification still sends |
| 20 | iPhone 15 Pro (Dynamic Island) | `insets.bottom` returns correct value → padding applied correctly |
| 21 | iPad or web | `insets.bottom = 0` → no padding change → layout unchanged |
| 22 | iOS modal overlays (Add Template, Add Category, AI Generate) | Must add `paddingBottom: Math.max(insets.bottom, 16)` to scroll containers inside each modal |
| 23 | `NaN` in item totals | `item.total` defaults to `0` in `addItemToEstimate()` and `addCustomItem()` — no `NaN` can enter if those are the only creation paths. Validation in `validateEstimate()` doesn't guard NaN explicitly, but `subtotal = items.reduce(...)` returns 0 for NaN entries (falsy addition) |
| 24 | Blob URLs from failed S3 uploads in items | Already guarded at lines 868–871 (before any save/send). Do not remove this guard |
| 25 | Images still uploading when user clicks Send | Already guarded at lines 862–865 and 1024–1026. Do not remove this guard |
| 26 | Draft key mismatch (`saveDraft` uses `id`, `loadDraft` uses `clientId \|\| id`) | Known inconsistency. Out of scope for this fix — do NOT fix this in this PR to avoid draft data loss |
| 27 | `window.location.href = mailtoUrl` in `requestSignature()` on iOS | Line 1606 uses `window.open(emailUrl, '_blank')` on web and `Linking.openURL` on mobile. No `window.location` access in this path → already safe |

---

## Testing Checklist (After Each Fix)

### Bug 1 — URL Fix
- [ ] iOS: Go to Project → Estimates → View Full Estimate → estimate loads without error
- [ ] iOS: Send Estimate from estimate screen → no `window.location.origin` error
- [ ] Web: Same flows still work (URL is the same, just absolute now)

### Bug 2 — Client Guard Fix
- [ ] Project → Estimates → New Estimate → fill items → Save → no "Client information not found" error
- [ ] Project → Estimates → New Estimate → fill items → Send → no error
- [ ] CRM → Client → New Estimate (with `clientId` param) → Save → still works

### Bug 3 — Send/Sign Fix
- [ ] Project → Estimates → Send button → estimate saves to DB → PDF/email opens
- [ ] Project → Estimates → Sign button → estimate saves to DB → email opens
- [ ] Tax % shows correctly (not 800%) in sent email PDF on Web

### Bug 4 — iOS Safe Area
- [ ] iPhone (non-Pro): bottom action bar (Save/Send/Sign) fully visible above home indicator
- [ ] iPhone (Pro/Dynamic Island): same
- [ ] iPad: no layout changes (insets.bottom = 0)
- [ ] Web: no layout changes

### Bug 5 — Notifications
- [ ] Send estimate → "Estimate Sent" notification appears in admin's notification screen
- [ ] Sign/Approve estimate → "Estimate Accepted" notification appears
- [ ] Reject estimate → "Estimate Rejected" notification appears
- [ ] Estimate with no project_id → notifications still fire (no silent crash)

### Bug 6 — Export Flag
- [ ] Set `showUnitsQty = false` → Send via estimate screen → PDF does NOT show Qty/Unit Price
- [ ] Set `showUnitsQty = false` → Export PDF from preview → PDF does NOT show Qty/Unit Price
- [ ] Set `showUnitsQty = true` → both paths show Qty/Unit Price (regression check)
- [ ] CRM Send → PDF shows Qty/Unit Price (default behavior preserved)

---

## What This Fix Does NOT Change

To be explicit about scope boundaries:

1. **No DB migrations** — `showUnitsQty`/`showBudget` persistence is out of scope for this fix
2. **No new API routes** — all 3 modified files are existing files
3. **No AppContext changes** — estimate state management is untouched
4. **No changes to CRM screen logic** — only the utility it calls is patched
5. **No changes to navigation or routing** — all routes unchanged
6. **No changes to the Estimate TypeScript type** — no fields added to `types/index.ts`
7. **Draft key inconsistency** (Bug edge case 26) — deliberately deferred to avoid data loss
8. **AI chat send estimate** — will continue to default `showUnitsQty: true` (same as today)
