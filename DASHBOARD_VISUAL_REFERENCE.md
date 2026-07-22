# Archive System - Dashboard Visual Reference

## Dashboard Location
**URL:** `http://localhost:4321/admin/permit-leads`

---

## 📊 Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PERMIT LEADS DASHBOARD                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  FILTER BAR:                                                            │
│  ┌──────────────┐ ┌──────────────┐ ┌─────────────┐ ┌────────────────┐  │
│  │ Status ▼     │ │ Contact ▼    │ │ Archive ▼   │ │ 🔄 Refresh   │  │
│  │ [New]        │ │ [All]        │ │ [Active]    │ │ ▶️ Run Now    │  │
│  └──────────────┘ └──────────────┘ └─────────────┘ │ ⚙️ Settings  │  │
│                                                    └────────────────┘  │
│                                                                           │
├─────────────────────────────────────────────────────────────────────────┤
│                           PERMIT LEADS                                  │
│                                                                           │
│ [1] Address: 123 Main St, Broward County                               │
│     Owner: John Smith | Phone: (954) 555-0100                          │
│     Status: New | Created: 2026-07-01                                  │
│     [📦 Archive] [View Details]                                        │
│                                                                           │
│ [2] Address: 456 Oak Ave, Miami-Dade County                            │
│     Owner: Jane Doe | Email: jane@example.com                          │
│     Status: New | Created: 2026-06-15                                  │
│     [📦 Archive] [View Details]                                        │
│                                                                           │
│ [3] Address: 789 Elm St, Palm Beach County                             │
│     Owner: Bob Wilson | Phone: (561) 555-0150                          │
│     Status: New | Created: 2026-05-01                                  │
│     🏷️ ARCHIVED                          [↻ Unarchive] [View Details]  │
│     Archived: 2026-07-20 by Auto-archive                               │
│                                                                           │
│ [4] Address: 321 Pine Rd, Broward County                               │
│     Owner: Alice Johnson | Phone: (954) 555-0200                       │
│     Status: Approved | Created: 2026-06-20                             │
│     [📦 Archive] [View Details]                                        │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🎮 Interactive Controls

### 1. Status Filter Dropdown
```
┌─────────────────────────────────────┐
│ Status ▼                             │
├─────────────────────────────────────┤
│ ✓ New (currently selected)          │
│   Approved                          │
│   Rejected                          │
│   Contacted                         │
│   All                               │
└─────────────────────────────────────┘
```
**Effect:** Shows/hides leads based on their status in the system

---

### 2. Contact Filter Dropdown
```
┌─────────────────────────────────────┐
│ Contact ▼                            │
├─────────────────────────────────────┤
│ ✓ All contacts (currently selected) │
│   Has email                         │
│   Phone only                        │
└─────────────────────────────────────┘
```
**Effect:** Filters by contact method available

---

### 3. Archive Filter Dropdown ⭐ NEW
```
┌─────────────────────────────────────┐
│ Archive ▼                            │
├─────────────────────────────────────┤
│ ✓ Active only (currently selected)  │
│   Archived only                     │
│   All leads                         │
└─────────────────────────────────────┘
```

**Options:**
- **Active only**: Shows leads with `archived_at = NULL`
- **Archived only**: Shows leads with `archived_at = NOT NULL`
- **All leads**: Shows all leads regardless of archive status

**Visual Indicators:**
- Active leads: Normal appearance
- Archived leads: 
  - Semi-transparent or slightly faded
  - Orange "ARCHIVED" badge
  - Unarchive button instead of archive button

---

### 4. Settings Modal (⚙️ Button)

**When Clicked:**
Opens full-screen overlay with settings form

```
╔═══════════════════════════════════════════════╗
║            SCRAPING SETTINGS              ✕   ║
╠═══════════════════════════════════════════════╣
║                                               ║
║ ☑ Enable automation                          ║
║                                               ║
║ ☑ Auto-send emails to prospects              ║
║                                               ║
║ Minimum score (0-100)                        ║
║ [_____0_____]                                ║
║                                               ║
║ ☑ Auto-approve permits                       ║
║                                               ║
║ Email subject                                ║
║ [We can help with your permit project  ]    ║
║                                               ║
║ Email template                               ║
║ [________________________]                    ║
║ [   (HTML editor here)   ]                    ║
║                                               ║
║ ┌─────────────────────────────────────────┐ ║
║ │ Archive leads after (days)  ⭐ NEW      │ ║
║ │ [______60______]                        │ ║
║ │ Range: 7-365 days                       │ ║
║ │ Leads in "new" status older than this   │ ║
║ │ will be auto-archived                   │ ║
║ └─────────────────────────────────────────┘ ║
║                                               ║
║ Select territories to scrape                 ║
║ ☑ Broward County                             ║
║ ☑ Miami-Dade County                         ║
║ ☑ Palm Beach County                         ║
║ ☑ Collier County                            ║
║ ☑ City of Boca Raton                        ║
║ ☑ City of Fort Lauderdale                   ║
║ [ ... 9 more territories ... ]              ║
║                                               ║
║ [💾 SAVE SETTINGS]                          ║
║                                               ║
╚═══════════════════════════════════════════════╝
```

**Key Archive-Related Fields:**
- **Archive leads after (days)**: 
  - Input range: 7-365
  - Default: 60
  - Applies to auto-archive cron job
  - Only affects leads with status "new"

---

### 5. Lead Row Layout

**ACTIVE LEAD:**
```
┌─────────────────────────────────────────────────┐
│ 📍 123 Main St, Broward County                  │
│ Owner: John Smith                               │
│ Phone: (954) 555-0100                           │
│ Status: New | Score: 85 | Created: 2026-07-01  │
│ [📦 Archive]  [View Details]                    │
└─────────────────────────────────────────────────┘
```

**ARCHIVED LEAD:**
```
┌─────────────────────────────────────────────────┐
│ 📍 789 Elm St, Palm Beach County [🏷️ ARCHIVED]   │
│ Owner: Bob Wilson                               │
│ Phone: (561) 555-0150                           │
│ Status: New | Score: 72 | Created: 2026-05-01  │
│ Archived: 2026-07-20                            │
│ Reason: Auto-archived after 60 days of inac...  │
│ [↻ Unarchive]  [View Details]                   │
└─────────────────────────────────────────────────┘
```

**Lead Row Information:**
- Title: Address and location
- Metadata: Owner name, phone/email
- Status: New/Approved/Contacted/etc.
- Score: Lead quality score (if available)
- Created: When permit was first added
- Archive Status: Shows "ARCHIVED" badge if archived
- Archived Info: When and why it was archived
- Actions: Archive/Unarchive and View Details buttons

---

## 🎬 User Workflows

### Workflow 1: Filter to Show Only Archived Leads
1. Click "Archive" dropdown in filter bar
2. Select "Archived only"
3. Dashboard updates to show only leads where `archived_at IS NOT NULL`
4. Each lead shows:
   - Orange "ARCHIVED" badge
   - Archived date and reason
   - "↻ Unarchive" button instead of "Archive"

### Workflow 2: Archive a Single Lead
1. Find lead in active list
2. Click "📦 Archive" button
3. Optional: Confirmation dialog (can add)
4. Lead disappears from "Active only" view
5. If viewing "All leads", lead now shows archived badge
6. Archive reason: "Manually archived"

### Workflow 3: Restore an Archived Lead
1. Filter to "Archived only"
2. Click "↻ Unarchive" button on lead
3. Confirmation dialog: "Reactivate this archived lead?"
4. Lead returns to active status
5. `archived_at` and `archive_reason` set to NULL

### Workflow 4: Configure Auto-Archive
1. Click "⚙️ Settings" button
2. In modal, find "Archive leads after (days)" field
3. Change value (e.g., 90, 30, etc.)
4. Click "💾 Save settings"
5. Now cron job will auto-archive leads older than new value

### Workflow 5: Manually Trigger Auto-Archive
1. Click "▶️ Run now" button (green)
2. System triggers `/api/archive-permits-cron` immediately
3. Shows notification: "Archived N permits older than X days"
4. Dashboard refreshes to show newly archived leads

---

## 🎨 Color & Visual Indicators

**Status Colors:**
- **Active Leads**: Normal colors (black text, white background)
- **Archived Leads**: 
  - Orange/amber styling for the badge
  - Possibly slightly faded appearance
  - Badge text: "🏷️ ARCHIVED"
  - Badge style: `bg-orange-50 text-orange-700 border-orange-200`

**Button States:**
- **Archive Button**: Gray, hover shows darker gray
  - Appears on active leads
  - Icon: 📦
- **Unarchive Button**: Amber/orange, hover shows darker amber
  - Appears on archived leads
  - Icon: ↻
- **Settings Button**: Gray with gear icon ⚙️
- **Run Now Button**: Green (indicates action)
- **Save Settings Button**: Green (indicates action)

---

## 📱 Responsive Design

**Desktop (Full Width):**
- Filter bar: All 4 items visible horizontally
- Lead rows: Full width with good spacing
- Modal: Centered overlay

**Tablet:**
- Filter bar: May wrap to 2 rows
- Lead rows: Adjusted padding
- Modal: Responsive width

**Mobile:**
- Filter bar: Stacked vertically
- Lead rows: Compact layout
- Modal: Full screen with scrolling

---

## ⚙️ Technical Notes

**Archive Filter State:**
```javascript
const archiveFilter = document.getElementById('permitArchiveFilter')?.value;
// Returns: 'active', 'archived', or 'all'
```

**Filter Logic:**
```javascript
let matchesArchive = true;
if (archiveFilter === 'active') {
  matchesArchive = !lead.archived_at;  // archived_at is NULL
} else if (archiveFilter === 'archived') {
  matchesArchive = !!lead.archived_at;  // archived_at is NOT NULL
}
// else matchesArchive stays true (all leads)
```

**Lead Data Structure:**
```javascript
{
  id: "uuid",
  permit_status: "new",
  archived_at: "2026-07-23T10:30:00Z" || null,
  archive_reason: "Auto-archived after 60 days..." || null,
  // ... other fields
}
```

