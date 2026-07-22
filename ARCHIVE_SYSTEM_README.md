# Lead Archive System Implementation Guide

## Overview

The system automatically archives permit leads older than a configurable number of days (default: 60 days) to keep the dashboard clean and focused on fresh leads.

## Features Implemented

### 1. **Settings Modal - Archive Configuration**
- Location: `/admin/permit-leads` → Settings button → "Archive leads after (days)"
- Default: 60 days
- Range: 7-365 days
- Leads in "new" status (never contacted) are archived after the specified days

### 2. **Dashboard Filters**
Three archive filter options in the permit leads dashboard:
- **Active only** (default) - Shows unarchived leads
- **Archived only** - Shows leads that have been archived
- **All leads** - Shows both active and archived

### 3. **Archive Actions**
- **Auto-archive** - Call `/api/archive-permits-cron` to archive old leads
- **Manual archive** - Click lead row → Archive button
- **Reactivate** - Click "Unarchive" button on archived leads

## API Endpoints

### GET /api/permit-leads
Returns all permits including archived ones (with `archived_at` field)
```json
{
  "ok": true,
  "leads": [
    {
      "id": "...",
      "permit_number": "...",
      "archived_at": null,  // or ISO timestamp when archived
      "archive_reason": null // or archive reason
    }
  ]
}
```

### POST /api/archive-permits-cron
Auto-archive permits older than `archiveDays` setting with status 'new'
```bash
curl -X POST http://localhost:4321/api/archive-permits-cron
```
Response:
```json
{
  "ok": true,
  "message": "Archived 5 permits older than 60 days",
  "archived": 5,
  "archiveDays": 60
}
```

### POST /api/archive-lead
Manually archive a single lead
```bash
curl -X POST http://localhost:4321/api/archive-lead \
  -H "Content-Type: application/json" \
  -d '{"id": "lead-id", "reason": "No response"}'
```

### POST /api/unarchive-lead
Reactivate an archived lead
```bash
curl -X POST http://localhost:4321/api/unarchive-lead \
  -H "Content-Type: application/json" \
  -d '{"id": "lead-id"}'
```

### POST /api/setup-archive-columns
Check if archive columns exist (returns SQL if needed)
```bash
curl -X POST http://localhost:4321/api/setup-archive-columns
```

## Database Schema

Two columns needed in `permit_leads` table:
```sql
ALTER TABLE permit_leads ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;
ALTER TABLE permit_leads ADD COLUMN IF NOT EXISTS archive_reason TEXT;
```

To add manually in Supabase SQL Editor:
1. Go to SQL Editor in Supabase dashboard
2. Create new query
3. Run the SQL above
4. Test with `/api/setup-archive-columns`

## Settings Storage

Archive days setting is stored in `tracking_settings.global_scripts` as JSON:
```json
{
  "enabled": true,
  "minScore": 0,
  "archiveDays": 60,
  "allowedTerritories": ["City of Fort Lauderdale", "City of Miami"],
  "audit": []
}
```

## Workflow

### For New Leads
1. Permits sync every 6 hours (via cron)
2. New permits created with `archived_at = NULL`
3. Admin can set archive threshold in Settings
4. Auto-archive runs daily/weekly (manual trigger or cron job)
5. Dashboard defaults to showing active leads only

### For Archived Leads
1. Appear with "ARCHIVED" badge
2. Can filter to view only archived
3. Can reactivate if needed
4. Shows archive reason on hover/details

## Configuration

**Settings available:**
- `enabled` - Enable/disable automation
- `minScore` - Minimum lead score threshold
- `archiveDays` - Days before auto-archiving (7-365)
- `allowedTerritories` - Which territories to scrape

**Cron Schedule** (optional setup):
- Add to scheduler: POST `/api/archive-permits-cron` daily
- Or call manually from admin dashboard
- Respects `archiveDays` setting

## Frontend Components

**permit-leads.astro:**
- Archive filter dropdown (Active/Archived/All)
- Settings modal with archiveDays input
- Archive/Unarchive buttons on lead rows
- Display "ARCHIVED" badge for archived leads

**Filters:**
```typescript
// In dashboard script
const archiveFilter = filterElement.value; // 'active', 'archived', 'all'
const matchesArchive = 
  archiveFilter === 'active' ? !lead.archived_at :
  archiveFilter === 'archived' ? !!lead.archived_at :
  true; // all
```

## Testing Checklist

- [ ] SQL columns added to database
- [ ] Settings modal shows "Archive leads after (days)" input
- [ ] Archive filter shows 3 options
- [ ] Save settings persists archiveDays value
- [ ] Dashboard filters work (Active/Archived/All)
- [ ] Call `/api/archive-permits-cron` returns success
- [ ] Archived leads show "ARCHIVED" badge
- [ ] Can reactivate archived leads
- [ ] Archived leads excluded from duplicates check

## Notes

- Leads are soft-deleted (never physically removed)
- Only leads with status 'new' are auto-archived
- Contacted/converted leads are NOT auto-archived
- Archive reason stored for audit trail
- All timestamps use ISO format
