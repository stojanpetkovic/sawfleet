# Archive System - Complete API Endpoints & Dashboard Controls

## 🔌 API ENDPOINTS

### 1. Archive Single Lead
**Endpoint:** `POST /api/archive-lead`

**Request:**
```json
{
  "id": "permit-lead-uuid",
  "reason": "Optional custom reason (defaults to 'Manually archived')"
}
```

**Response (Success):**
```json
{
  "ok": true,
  "message": "Lead archived successfully",
  "lead": {
    "id": "...",
    "archived_at": "2026-07-23T10:30:00Z",
    "archive_reason": "Manually archived"
  }
}
```

**Response (Error):**
```json
{
  "ok": false,
  "error": "Error message describing what went wrong"
}
```

**Usage:**
```bash
curl -X POST http://localhost:4321/api/archive-lead \
  -H "Content-Type: application/json" \
  -d '{
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "reason": "No response after 3 contact attempts"
  }'
```

**In Code (JavaScript):**
```javascript
const response = await fetch('/api/archive-lead', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    id: leadId,
    reason: "Custom reason" 
  }),
});
const result = await response.json();
if (result.ok) {
  console.log('Lead archived:', result.lead);
}
```

---

### 2. Unarchive (Reactivate) Lead
**Endpoint:** `POST /api/unarchive-lead`

**Request:**
```json
{
  "id": "permit-lead-uuid"
}
```

**Response (Success):**
```json
{
  "ok": true,
  "message": "Lead reactivated successfully",
  "lead": {
    "id": "...",
    "archived_at": null,
    "archive_reason": null
  }
}
```

**Usage:**
```bash
curl -X POST http://localhost:4321/api/unarchive-lead \
  -H "Content-Type: application/json" \
  -d '{"id": "550e8400-e29b-41d4-a716-446655440000"}'
```

**In Dashboard:**
- Click "↻" button next to archived lead
- Confirm dialog: "Reactivate this archived lead?"
- Lead returns to active status

---

### 3. Auto-Archive Old Leads (Cron)
**Endpoint:** `POST /api/archive-permits-cron`

**Request:** No body required
```bash
curl -X POST http://localhost:4321/api/archive-permits-cron
```

**Response (Success):**
```json
{
  "ok": true,
  "message": "Archived 5 permits older than 60 days",
  "archived": 5,
  "archiveDays": 60
}
```

**What It Does:**
- Archives leads that are older than `archiveDays` setting
- Only archives leads with status "new" (never contacted)
- Skips leads that are already archived
- Sets `archive_reason` to: "Auto-archived after {X} days of inactivity"

**Scheduling (Linux crontab):**
```bash
# Run every day at 2 AM
0 2 * * * curl -X POST http://localhost:4321/api/archive-permits-cron
```

**Scheduling (GitHub Actions):**
```yaml
name: Auto-Archive Old Permits
on:
  schedule:
    - cron: '0 2 * * *'  # 2 AM daily

jobs:
  archive:
    runs-on: ubuntu-latest
    steps:
      - name: Archive permits
        run: curl -X POST ${{ secrets.SITE_URL }}/api/archive-permits-cron
```

---

### 4. Get Settings
**Endpoint:** `GET /api/permit-settings`

**Response:**
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
    "allowedTerritories": ["Broward County", "Miami-Dade County", ...],
    "archiveDays": 60,
    "audit": {
      "lastModified": "2026-07-23T10:00:00Z",
      "modifiedBy": "admin"
    }
  }
}
```

---

### 5. Save Settings (Including Archive Days)
**Endpoint:** `POST /api/permit-settings`

**Request:**
```json
{
  "enabled": true,
  "autoSend": true,
  "minScore": 0,
  "autoApprove": false,
  "emailSubject": "Subject line here",
  "emailTemplate": "Email template HTML",
  "allowedTerritories": ["Broward County", "Miami-Dade County"],
  "archiveDays": 60
}
```

**archiveDays Constraints:**
- Minimum: 7 days
- Maximum: 365 days (1 year)
- Default: 60 days
- Only affects leads with status "new"

**Response:**
```json
{
  "ok": true
}
```

**Usage:**
```bash
curl -X POST http://localhost:4321/api/permit-settings \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "autoSend": true,
    "minScore": 0,
    "archiveDays": 90
  }'
```

---

### 6. Add Archive Columns (Setup)
**Endpoint:** `POST /api/add-archive-columns`

**Purpose:** One-time migration endpoint to verify columns exist

**Response (Success):**
```json
{
  "ok": true,
  "message": "Archive columns are ready"
}
```

**Response (If columns missing):**
```json
{
  "ok": false,
  "error": "execute_sql RPC not available",
  "instructions": "Run this SQL manually...",
  "sql": "ALTER TABLE permit_leads ADD COLUMN..."
}
```

---

## 🎮 DASHBOARD CONTROLS

### Located: `/admin/permit-leads`

### 1. Archive Filter Dropdown
**HTML:**
```html
<select id="permitArchiveFilter">
  <option value="active">Active only</option>
  <option value="archived">Archived only</option>
  <option value="all">All leads</option>
</select>
```

**Behavior:**
- **Active only**: Shows only leads where `archived_at IS NULL`
- **Archived only**: Shows only leads where `archived_at IS NOT NULL`
- **All leads**: Shows all leads (active + archived)

**JavaScript Event:**
```javascript
document.getElementById('permitArchiveFilter')?.addEventListener('change', renderList);
```

---

### 2. Settings Modal (⚙️ Button)

**Open:** Click blue "⚙️ Settings" button in top toolbar

**Controls in Modal:**
- **Enable automation**: Checkbox
- **Auto-send emails**: Checkbox
- **Minimum score**: Number input (0-100)
- **Auto-approve**: Checkbox
- **Email subject**: Text input
- **Email template**: Textarea
- **Archive leads after (days)**: Number input (7-365)
  - Default: 60
  - Affects: Auto-archive cron job only
- **Select territories**: Checkboxes for all 15 Florida territories

**Save:** Click "Save settings" button

---

### 3. Lead Row Controls

**For Active Leads:**
```html
<button onclick="window.archivePermit('lead-id')">📦 Archive</button>
```

**For Archived Leads:**
```html
<button onclick="window.unarchivePermit('lead-id')">↻ Unarchive</button>
<span class="badge">ARCHIVED</span>
```

**JavaScript Functions:**
```javascript
// Archive a lead
window.archivePermit = async (leadId) => {
  const response = await fetch('/api/archive-lead', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: leadId }),
  });
  // Refresh list on success
};

// Unarchive a lead
window.unarchivePermit = async (leadId) => {
  if (!confirm('Reactivate this archived lead?')) return;
  const response = await fetch('/api/unarchive-lead', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: leadId }),
  });
  // Refresh list on success
};
```

---

### 4. Action Buttons

**Refresh Button** (📄)
- Reloads permit leads from database
- Updates display with latest data

**Run now Button** (▶️ Green)
- Manually triggers `POST /api/archive-permits-cron`
- Shows notification with number of archived leads
- Does NOT require cron scheduler to run

**Settings Button** (⚙️)
- Opens modal with all configuration options
- Click outside modal or "✕" to close

---

## 💾 DATA STORAGE

### Database Columns (permit_leads table)

**New Columns:**
```sql
-- When the lead was archived (NULL = active)
archived_at TIMESTAMP

-- Why it was archived (for audit trail)
archive_reason TEXT
```

**Example Values:**
```
archived_at: "2026-07-23T10:30:00Z"
archive_reason: "Auto-archived after 60 days of inactivity"

archived_at: NULL
archive_reason: NULL

archived_at: "2026-07-23T10:30:00Z"
archive_reason: "Manually archived - No response after 3 contact attempts"
```

### Settings Storage
- Stored in `tracking_settings` table
- Column: `global_scripts` (contains JSON wrapped in HTML comment)
- Format:
```html
<!-- PERMIT_SETTINGS_JSON:{
  "enabled": true,
  "autoSend": true,
  "minScore": 0,
  "autoApprove": false,
  "emailSubject": "...",
  "emailTemplate": "...",
  "allowedTerritories": ["..."],
  "archiveDays": 60,
  "audit": {...}
} -->
```

---

## 🧪 TESTING CHECKLIST

- [ ] Archive single lead: `curl -X POST http://localhost:4321/api/archive-lead`
- [ ] Unarchive lead: `curl -X POST http://localhost:4321/api/unarchive-lead`
- [ ] Run auto-archive: `curl -X POST http://localhost:4321/api/archive-permits-cron`
- [ ] Get settings: `curl http://localhost:4321/api/permit-settings`
- [ ] Save settings: `curl -X POST http://localhost:4321/api/permit-settings`
- [ ] Dashboard filter shows all 3 options
- [ ] Settings modal opens and displays archiveDays
- [ ] Archive button appears on lead rows
- [ ] Unarchive button appears on archived leads
- [ ] "ARCHIVED" badge displays for archived leads
- [ ] Archive reason is logged in database

---

## 📝 ERROR CODES

| Status | Error | Cause |
|--------|-------|-------|
| 400 | `Missing lead ID` | Lead ID not provided in request |
| 400 | `invalid_json` | Request body is not valid JSON |
| 401 | `Invalid authorization` | API endpoint requires auth (if implemented) |
| 404 | `Not found` | Lead ID does not exist in database |
| 500 | `Could not find 'archived_at' column` | Database columns not added yet |
| 500 | Various database errors | Check Supabase dashboard for details |

---

## 🔗 FILE LOCATIONS

**API Endpoints:**
- [archive-lead.ts](src/pages/api/archive-lead.ts)
- [unarchive-lead.ts](src/pages/api/unarchive-lead.ts)
- [archive-permits-cron.ts](src/pages/api/archive-permits-cron.ts)
- [permit-settings.ts](src/pages/api/permit-settings.ts)
- [add-archive-columns.ts](src/pages/api/add-archive-columns.ts)

**Dashboard:**
- [permit-leads.astro](src/pages/admin/permit-leads.astro) - Archive controls, filters, settings modal

**Library:**
- [permitData.ts](src/lib/permitData.ts) - Settings parsing and storage

