# Setup Archive System - Database Migration

## Option 1: Manual Setup (Recommended for Now)

### Step 1: Open Supabase SQL Editor
1. Go to: https://supabase.com/dashboard/project/tjzpqyfjtjepvguywzgn/sql/new
2. Copy-paste this SQL:

```sql
-- Add archive columns to permit_leads table
ALTER TABLE permit_leads ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;
ALTER TABLE permit_leads ADD COLUMN IF NOT EXISTS archive_reason TEXT;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_permit_leads_archived_at ON permit_leads(archived_at) WHERE archived_at IS NULL;
```

3. Click "Run" button (or Ctrl+Enter)

### Step 2: Verify It Worked
Wait for success message "1 statement completed"

### Step 3: Test Archive API
```bash
cd /home/stojan/Documents/10\ SawFleet/sawfleet
curl -X POST http://localhost:4321/api/archive-permits-cron 2>&1 | jq .
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

## Option 2: Via Supabase CLI (If Available)

```bash
# Install Supabase CLI
npm install -g supabase

# Link project
supabase link --project-ref tjzpqyfjtjepvguywzgn

# Run migration
supabase db push
```

---

## Option 3: Via Docker (If Supabase Docker is Running Locally)

```bash
docker exec -i supabase_db_1 psql -U postgres -d postgres -c \
  "ALTER TABLE permit_leads ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;
   ALTER TABLE permit_leads ADD COLUMN IF NOT EXISTS archive_reason TEXT;"
```

---

## After Setup Complete

### Enable Archive Automation
1. Go to http://localhost:4321/admin/permit-leads
2. Click "⚙️ Settings" button
3. Set "Archive leads after (days)" to desired value (default: 60)
4. Click "Save settings"

### Test Archive Filter
1. On the same page, notice new filter: "Active only", "Archived only", "All leads"
2. Try each filter to see it works

### Auto-Archive Old Leads
```bash
# Manually trigger archival
curl -X POST http://localhost:4321/api/archive-permits-cron

# Or add to your cron jobs for daily run
0 2 * * * curl -X POST http://localhost:4321/api/archive-permits-cron
```

---

## Troubleshooting

**Error: "Could not find the 'archived_at' column"**
- You haven't added the columns yet - follow Option 1 above

**Error: "Invalid API key"**
- The API route-based migration won't work with remote Supabase
- Use Manual Setup (Option 1) instead

**Archive button not working**
- Make sure you ran the SQL to add the columns first
- Refresh browser with Ctrl+F5

---

## Files Updated
- `supabase/migrations/20260723000000_add_archive_columns.sql` - Migration file
- `scripts/add-archive-columns.js` - Node.js migration script
- `src/pages/api/add-archive-columns.ts` - API endpoint (diagnostic)
