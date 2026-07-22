# Archive System - Complete Testing & Verification Guide

## ✅ Pre-Setup Checklist

Before testing, ensure:
- [ ] Dev server running: `npm run dev`
- [ ] Database columns added (see ARCHIVE_SETUP_QUICK_START.md)
- [ ] Browser DevTools ready: F12
- [ ] Terminal ready for curl commands

---

## 🧪 Test 1: Archive API - Archive Single Lead

### Step 1: Get a Lead ID

```bash
# Fetch first few leads to get an ID
curl http://localhost:4321/api/permit-leads | jq '.leads[0]'
```

Expected output includes: `"id": "..."`

### Step 2: Archive the Lead

```bash
curl -X POST http://localhost:4321/api/archive-lead \
  -H "Content-Type: application/json" \
  -d '{
    "id": "YOUR_LEAD_ID_HERE",
    "reason": "Test archive"
  }'
```

### Expected Response:
```json
{
  "ok": true,
  "message": "Lead archived successfully",
  "lead": {
    "id": "...",
    "archived_at": "2026-07-23T10:30:00.000Z",
    "archive_reason": "Test archive",
    "permit_status": "new",
    ...
  }
}
```

### ✓ Verification
- [ ] Response includes `"ok": true`
- [ ] Response includes `archived_at` with timestamp
- [ ] Response includes `archive_reason` field
- [ ] Database actually updated (check next test)

---

## 🧪 Test 2: Verify Lead is Archived in Database

```bash
# Fetch all leads and check the one we just archived
curl http://localhost:4321/api/permit-leads | jq '.leads[] | select(.id=="YOUR_LEAD_ID") | {id, archived_at, archive_reason}'
```

### Expected Output:
```json
{
  "id": "...",
  "archived_at": "2026-07-23T10:30:00.000Z",
  "archive_reason": "Test archive"
}
```

### ✓ Verification
- [ ] Lead appears in results with `archived_at` set
- [ ] `archive_reason` matches what we sent

---

## 🧪 Test 3: Unarchive API

```bash
curl -X POST http://localhost:4321/api/unarchive-lead \
  -H "Content-Type: application/json" \
  -d '{"id": "YOUR_LEAD_ID_HERE"}'
```

### Expected Response:
```json
{
  "ok": true,
  "message": "Lead reactivated successfully",
  "lead": {
    "id": "...",
    "archived_at": null,
    "archive_reason": null,
    ...
  }
}
```

### ✓ Verification
- [ ] Response includes `"ok": true`
- [ ] `archived_at` is now `null`
- [ ] `archive_reason` is now `null`

---

## 🧪 Test 4: Auto-Archive Cron Job

### Setup: Create an Old Lead (Optional)

If you want to test auto-archive, create a lead with an old creation date:

```bash
# This is just for reference - you'd need to do this in Supabase manually
# Update an existing lead to have old creation date
# UPDATE permit_leads SET created_at = NOW() - INTERVAL '70 days' 
# WHERE permit_status = 'new' AND archived_at IS NULL LIMIT 1;
```

### Run Cron Job:

```bash
curl -X POST http://localhost:4321/api/archive-permits-cron
```

### Expected Response (No old leads):
```json
{
  "ok": true,
  "message": "Archived 0 permits older than 60 days",
  "archived": 0,
  "archiveDays": 60
}
```

### Expected Response (With old leads):
```json
{
  "ok": true,
  "message": "Archived 5 permits older than 60 days",
  "archived": 5,
  "archiveDays": 60
}
```

### ✓ Verification
- [ ] Response includes `"ok": true`
- [ ] Shows correct `archiveDays` setting
- [ ] `archived` count matches expected

---

## 🧪 Test 5: Get Settings API

```bash
curl http://localhost:4321/api/permit-settings
```

### Expected Response:
```json
{
  "ok": true,
  "settings": {
    "enabled": true,
    "autoSend": true,
    "minScore": 0,
    "autoApprove": false,
    "emailSubject": "We can help with your permit project",
    "emailTemplate": "...",
    "allowedTerritories": [...],
    "archiveDays": 60,
    "audit": {
      "lastModified": "2026-07-23T10:00:00Z",
      "modifiedBy": "admin"
    }
  }
}
```

### ✓ Verification
- [ ] Response includes `"ok": true`
- [ ] `archiveDays` is present (should be 60 by default)
- [ ] Other settings loaded correctly

---

## 🧪 Test 6: Update Settings API

```bash
curl -X POST http://localhost:4321/api/permit-settings \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "autoSend": true,
    "minScore": 0,
    "autoApprove": false,
    "emailSubject": "We can help with your permit project",
    "emailTemplate": "",
    "allowedTerritories": ["Broward County", "Miami-Dade County"],
    "archiveDays": 90
  }'
```

### Expected Response:
```json
{
  "ok": true
}
```

### Step 2: Verify Settings Were Saved

```bash
curl http://localhost:4321/api/permit-settings | jq '.settings.archiveDays'
```

### Expected Output:
```
90
```

### ✓ Verification
- [ ] Response includes `"ok": true`
- [ ] Follow-up GET request shows `archiveDays: 90`
- [ ] Can set different values (7, 30, 60, 90, 365, etc.)

---

## 🧪 Test 7: Dashboard - Archive Filter

### Step 1: Navigate to Dashboard
1. Open browser: `http://localhost:4321/admin/permit-leads`
2. Wait for page to load completely

### Step 2: Check Filter Dropdown

1. Look for "Archive ▼" dropdown in filter bar
2. Click the dropdown
3. Verify you see 3 options:
   - [ ] Active only
   - [ ] Archived only
   - [ ] All leads

### Step 3: Test Each Filter

#### Active Only (default)
- Click "Active only"
- Leads displayed should only show active leads (no archived badge)
- Count should be less than total

#### All Leads
- Click "All leads"
- Should see all leads including those with "ARCHIVED" badge
- Count should be higher

#### Archived Only
- Click "Archived only"
- Should only see leads with "🏷️ ARCHIVED" badge
- If none exist, list will be empty

### ✓ Verification
- [ ] Dropdown shows all 3 options
- [ ] Filter changes lead display correctly
- [ ] Active/Archived badges appear appropriately
- [ ] Filtering works without errors

---

## 🧪 Test 8: Dashboard - Archive/Unarchive Buttons

### Test Archive Button

1. Open dashboard: `http://localhost:4321/admin/permit-leads`
2. Ensure "Active only" filter is selected
3. Find an active lead without "ARCHIVED" badge
4. Look for archive button on that lead
5. Click the archive button

### Expected Result:
- [ ] Lead moves to archived state
- [ ] "ARCHIVED" badge appears
- [ ] Button changes to "↻ Unarchive"
- [ ] Archive reason shows: "Manually archived"

### Test Unarchive Button

1. With same lead now archived, click "↻ Unarchive"
2. If popup appears: "Reactivate this archived lead?" → Click OK

### Expected Result:
- [ ] Lead returns to active state
- [ ] "ARCHIVED" badge disappears
- [ ] Button changes back to "📦 Archive"
- [ ] Lead reappears in "Active only" view

### ✓ Verification
- [ ] Archive button functional and clickable
- [ ] Unarchive button functional and clickable
- [ ] UI updates immediately after action
- [ ] No JavaScript errors in console (F12 → Console tab)

---

## 🧪 Test 9: Dashboard - Settings Modal

### Step 1: Open Settings Modal

1. Click "⚙️ Settings" button in top toolbar
2. Modal should appear with full-screen overlay

### Step 2: Verify Archive Days Field

1. Look for label: "Archive leads after (days)"
2. Input field should contain: "60" (default value)
3. Try entering different values:
   - [ ] Try 7 (minimum)
   - [ ] Try 30
   - [ ] Try 90
   - [ ] Try 365 (maximum)

### Step 3: Verify Input Constraints

1. Try entering 5 (below minimum)
   - Should not accept or revert to 7
2. Try entering 400 (above maximum)
   - Should not accept or revert to 365
3. Try entering text
   - Should only accept numbers

### Step 4: Save Settings

1. Set archiveDays to 90
2. Scroll down and click "💾 SAVE SETTINGS"
3. Wait for success message (or error message)

### Step 5: Verify Settings Were Saved

1. Refresh page: Ctrl+R
2. Click "⚙️ Settings" again
3. Check if archiveDays field shows "90"

### ✓ Verification
- [ ] Settings modal opens and closes correctly
- [ ] Archive days field is visible and labeled
- [ ] Can change value
- [ ] Input constraints work (7-365 range)
- [ ] Settings persist after page refresh

---

## 🧪 Test 10: Dashboard - Run Auto-Archive

### Step 1: Click "Run Now" Button

1. Click green "▶️ Run now" button in toolbar
2. Wait for response

### Expected Result:
- [ ] Toast/Alert notification appears
- [ ] Message shows: "Archived N permits older than 60 days"
- [ ] Or message shows: "No permits to archive"

### Step 2: Check Dashboard Update

1. Check if any active leads disappeared (if they were > 60 days old with "new" status)
2. Filter to "Archived only"
3. Look for newly archived leads

### ✓ Verification
- [ ] Button triggers API call successfully
- [ ] Notification appears with result
- [ ] Dashboard updates if leads were archived
- [ ] Archive filter updates if new leads were archived

---

## 🧪 Test 11: Integration Test - Complete Workflow

### Scenario: Archive a lead, change settings, auto-archive, restore

#### Step 1: Record Initial State
```bash
curl http://localhost:4321/api/permit-leads | jq '.leads | length'
# Note the total count
```

#### Step 2: Manually Archive One Lead
```bash
LEAD_ID="..." # Copy from API response
curl -X POST http://localhost:4321/api/archive-lead \
  -H "Content-Type: application/json" \
  -d "{\"id\": \"$LEAD_ID\"}"
```

#### Step 3: Update Archive Days to 30
```bash
curl -X POST http://localhost:4321/api/permit-settings \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "autoSend": true,
    "minScore": 0,
    "autoApprove": false,
    "emailSubject": "We can help",
    "emailTemplate": "",
    "allowedTerritories": [],
    "archiveDays": 30
  }'
```

#### Step 4: Run Auto-Archive Cron
```bash
curl -X POST http://localhost:4321/api/archive-permits-cron
```

#### Step 5: Verify in Dashboard
1. Go to http://localhost:4321/admin/permit-leads
2. Click "⚙️ Settings"
3. Confirm archiveDays shows "30"
4. Close modal
5. Click "Archived only" filter
6. Verify archived leads are displayed

#### Step 6: Restore the Lead
1. Click "↻ Unarchive" on the lead
2. Confirm dialog
3. Verify lead returns to active state

### ✓ Verification
- [ ] All operations complete without errors
- [ ] Settings persist correctly
- [ ] Archive and unarchive work together
- [ ] Dashboard reflects all changes
- [ ] No console errors (F12)

---

## 🐛 Troubleshooting

### Issue: "Could not find 'archived_at' column"

**Cause:** Database columns not added yet

**Solution:** 
1. Follow ARCHIVE_SETUP_QUICK_START.md
2. Add columns to permit_leads table
3. Restart dev server
4. Try again

### Issue: Archive button not appearing

**Cause:** Dashboard not loading data correctly

**Solution:**
1. Check browser console: F12 → Console tab
2. Look for errors
3. Refresh page: Ctrl+F5 (hard refresh)
4. Check if API response includes leads

### Issue: Settings not saving

**Cause:** Browser local storage or server error

**Solution:**
1. Clear browser cache: Ctrl+Shift+Delete
2. Hard refresh: Ctrl+F5
3. Check console for errors
4. Verify API response: `curl http://localhost:4321/api/permit-settings`

### Issue: Auto-archive not working

**Cause:** No leads older than archiveDays setting with "new" status

**Solution:**
1. Verify settings: `curl http://localhost:4321/api/permit-settings | jq '.settings.archiveDays'`
2. Check if you have "new" status leads
3. If leads are recent, they won't be archived (try lower archiveDays value)
4. Check database directly in Supabase

### Issue: "Archived only" filter shows nothing

**Possible causes:**
1. No leads have been archived yet (Archive some first)
2. Filter is wrong (Check dropdown value)
3. Page not loaded yet (Refresh)

---

## 📊 Success Criteria

All tests should pass:
- [ ] Test 1: Archive API works
- [ ] Test 2: Database update verified
- [ ] Test 3: Unarchive API works
- [ ] Test 4: Auto-archive cron job works
- [ ] Test 5: Get settings works
- [ ] Test 6: Update settings works
- [ ] Test 7: Dashboard filter works
- [ ] Test 8: Archive/Unarchive buttons work
- [ ] Test 9: Settings modal works
- [ ] Test 10: Run auto-archive button works
- [ ] Test 11: Complete integration works
- [ ] No console errors throughout

---

## 🎉 You're Done!

If all tests pass, the archive system is fully operational and ready for production use.

### Next Steps:
1. Set up cron job for daily auto-archive (optional)
2. Train users on archival workflow
3. Monitor archive logs periodically
4. Adjust archiveDays setting based on business needs

