# ✅ Archive System Setup - Complete Instructions

## What You Need to Do

The permit archive system is **99% complete** and ready to use. Only one step remains: **add two columns to the database**.

---

## 🎯 QUICK START (2 minutes)

### Method 1: Manual SQL in Supabase Dashboard (RECOMMENDED)

1. **Open Supabase SQL Editor**
   - Go to: https://supabase.com/dashboard/project/tjzpqyfjtjepvguywzgn/sql/new
   - Or log in to Supabase → Select "SawFleet" project → SQL Editor → New Query

2. **Copy & Paste This SQL**
   ```sql
   ALTER TABLE permit_leads ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;
   ALTER TABLE permit_leads ADD COLUMN IF NOT EXISTS archive_reason TEXT;
   CREATE INDEX IF NOT EXISTS idx_permit_leads_archived_at ON permit_leads(archived_at) WHERE archived_at IS NULL;
   ```

3. **Click "Run" (or Ctrl+Enter)**
   - Wait for: "1 statement completed successfully"

4. **That's it!** ✅ Columns are now added.

---

### Method 2: Via Astro API (If Dev Server is Running)

```bash
# Terminal 1: Start dev server (if not already running)
cd /home/stojan/Documents/10\ SawFleet/sawfleet
npm run dev

# Terminal 2: Test the migration endpoint
curl -X POST http://localhost:4321/api/add-archive-columns
```

Expected response:
```json
{
  "ok": true,
  "message": "Archive columns are ready",
  "results": [...]
}
```

---

### Method 3: Via Node.js Script

```bash
cd /home/stojan/Documents/10\ SawFleet/sawfleet
node scripts/add-archive-columns.js
```

This will attempt automatic migration or show manual instructions.

---

## 🧪 VERIFY IT WORKED

After adding columns, test with:

```bash
curl -X POST http://localhost:4321/api/archive-permits-cron
```

Expected response:
```json
{
  "ok": true,
  "message": "Archived 0 permits older than 60 days",
  "archived": 0,
  "archiveDays": 60
}
```

---

## 🎮 USING THE ARCHIVE SYSTEM

### Admin Dashboard
1. Go to: http://localhost:4321/admin/permit-leads
2. You should now see:
   - **Archive Filter**: "Active only", "Archived only", "All leads"
   - **Settings Button** (⚙️): Set archival days (7-365, default 60)
   - **Archive Badge**: On archived leads
   - **Unarchive Button**: On archived leads

### Setting Auto-Archive Threshold
1. Click ⚙️ Settings
2. Set "Archive leads after (days)" to desired value
3. Click "Save settings"
4. Default is 60 days

### Manually Archive a Lead
1. Find the lead in the dashboard
2. Click the "Archive" button
3. Lead disappears from "Active only" view
4. Can be restored with "Unarchive" button

### Schedule Daily Auto-Archive
```bash
# Add to crontab for daily archival at 2 AM
0 2 * * * curl -X POST http://localhost:4321/api/archive-permits-cron
```

---

## 📋 WHAT WAS BUILT

✅ **Archive System Implemented**
- Soft-delete pattern (never physically deletes data)
- Configurable retention: 7-365 days (default 60)
- Settings stored in database
- Audit trail: `archive_reason` column for tracking

✅ **Admin Dashboard**
- Archive/unarchive controls
- Filter by status (active/archived/all)
- Settings modal for configuration
- Visual badges for archived leads

✅ **API Endpoints**
- `POST /api/archive-lead` - Manually archive one lead
- `POST /api/unarchive-lead` - Restore one lead
- `POST /api/archive-permits-cron` - Auto-archive old leads
- `GET/POST /api/permit-settings` - Manage archival configuration

✅ **Database Schema**
- `archived_at` TIMESTAMP - When lead was archived (NULL = active)
- `archive_reason` TEXT - Why it was archived
- Index for fast active-lead queries

---

## 📁 FILES ADDED/MODIFIED

**New Files:**
- `supabase/migrations/20260723000000_add_archive_columns.sql` - Migration
- `scripts/add-archive-columns.js` - Migration script
- `src/pages/api/archive-lead.ts` - Archive endpoint
- `src/pages/api/unarchive-lead.ts` - Unarchive endpoint
- `src/pages/api/archive-permits-cron.ts` - Auto-archive endpoint
- `ARCHIVE_SYSTEM_README.md` - Full documentation

**Modified Files:**
- `src/lib/permitData.ts` - Added archiveDays setting
- `src/pages/permit-leads.astro` - Archive UI controls
- `src/pages/api/permit-settings.ts` - Settings persistence
- `src/pages/api/permit-sync.ts` - Exclude archived from dedup

---

## ❓ TROUBLESHOOTING

**Q: Columns already exist?**
- A: SQL uses `IF NOT EXISTS`, so it's safe to run multiple times

**Q: Archive button doesn't work?**
- A: Make sure you ran the SQL to add columns
- A: Refresh browser with Ctrl+F5

**Q: Settings not saving?**
- A: Check browser console (F12) for errors
- A: Verify `archiveDays` is between 7-365

**Q: Can't connect to Supabase?**
- A: Check PUBLIC_SUPABASE_URL in `.env`
- A: Verify SUPABASE_SERVICE_ROLE_KEY is set

**Q: Want to disable archival?**
- A: Set `archiveDays` to 999999 in settings
- A: Or uncheck "Enabled" in settings panel (if you add this UI)

---

## 🚀 NEXT STEPS

1. **Add columns** using one of the methods above ⬆️
2. **Go to admin dashboard**: http://localhost:4321/admin/permit-leads
3. **Configure archival** in Settings (optional, 60 days is good default)
4. **Test archival** with `curl` command or UI
5. **Set up cron job** for daily auto-archive (optional)

---

## 📞 SUPPORT

If you encounter issues:
1. Check the error message carefully
2. Verify Supabase connection in browser DevTools (F12)
3. Run diagnostic: `curl http://localhost:4321/api/permit-leads | jq .leads | head -5`
4. Check API logs: `astro dev logs`

---

**Status**: Archive system is ready! Just add the columns and you're done. ✅
