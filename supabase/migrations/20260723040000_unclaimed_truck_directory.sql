-- Public, unverified truck profiles collected from public business listings.
-- These rows are NOT accounts and are never eligible for leads or notifications.

CREATE TABLE IF NOT EXISTS unclaimed_truck_directory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  company_name TEXT NOT NULL,
  contact_name TEXT,
  equipment_name TEXT NOT NULL,
  manufacturer TEXT,
  model TEXT,
  lift_capacity_tons NUMERIC,
  working_height_ft NUMERIC,
  location_city TEXT,
  location_state TEXT,
  service_radius_miles INTEGER,
  storm_radius_miles INTEGER,
  access_notes TEXT,
  availability_notes TEXT,
  rate_notes TEXT,
  insurance_claim TEXT,
  operator_experience TEXT,
  description TEXT,
  listing_type TEXT DEFAULT 'Rent',
  source_name TEXT NOT NULL DEFAULT 'SawFleet',
  source_url TEXT NOT NULL,
  source_key TEXT NOT NULL UNIQUE,
  source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  profile_status TEXT NOT NULL DEFAULT 'unclaimed'
    CHECK (profile_status IN ('unclaimed', 'claim_pending', 'claimed', 'hidden')),
  verification_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected')),
  is_published BOOLEAN NOT NULL DEFAULT true,
  claimed_owner_id UUID REFERENCES truck_owners(id) ON DELETE SET NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_unclaimed_trucks_location
  ON unclaimed_truck_directory(location_state, location_city);
CREATE INDEX IF NOT EXISTS idx_unclaimed_trucks_public
  ON unclaimed_truck_directory(is_published, profile_status);

ALTER TABLE unclaimed_truck_directory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read published unclaimed trucks" ON unclaimed_truck_directory;
CREATE POLICY "public read published unclaimed trucks"
  ON unclaimed_truck_directory FOR SELECT
  USING (is_published = true AND profile_status <> 'hidden');

DROP POLICY IF EXISTS "admins manage unclaimed trucks" ON unclaimed_truck_directory;
CREATE POLICY "admins manage unclaimed trucks"
  ON unclaimed_truck_directory FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- Initial publicly indexed SawFleet inventory. No images or private contact data.
INSERT INTO unclaimed_truck_directory
  (slug, company_name, contact_name, equipment_name, manufacturer, model,
   lift_capacity_tons, working_height_ft, location_city, location_state,
   service_radius_miles, storm_radius_miles, access_notes, availability_notes,
   rate_notes, insurance_claim, operator_experience, description,
   source_url, source_key, source_payload)
VALUES
  ('tree-jaws-copma-knuckleboom', 'Tree Jaws', NULL, 'Copma Knuckleboom', 'Copma', 'Knuckleboom',
   65, 112, 'Fort Lauderdale', 'FL', NULL, NULL, NULL, 'Available for hire',
   NULL, NULL, NULL, NULL, 'https://www.sawfleet.com/', 'sawfleet:tree-jaws-copma-knuckleboom',
   '{"indexed_listing":"Available For Hire Tree Jaws Copma Knuckleboom 65t 112ft Fort Lauderdale, Florida"}'),
  ('texas-tree-transformations-palfinger-pk65', 'Texas Tree Transformations LLC', NULL, 'Palfinger PK 65', 'Palfinger', 'PK 65',
   65, 112, 'Dallas', 'TX', NULL, NULL, NULL, 'Available for hire',
   NULL, NULL, NULL, NULL, 'https://www.sawfleet.com/', 'sawfleet:texas-tree-transformations-palfinger-pk65',
   '{"indexed_listing":"Available For Hire Texas Tree Transformations LLC Palfinger PK 65 65t 104 / 112ft Dallas, TX","alternate_working_height_ft":104}'),
  ('joes-landscaping-freightliner-60ft', 'Joe''s Landscaping and Tree Service', 'Joe', 'Freightliner 60ft Grapple Saw', 'Freightliner', '60ft Grapple Saw',
   17, 60, 'North Miami Beach', 'FL', 25, NULL, 'Driveway friendly; over-roof picks',
   'Six days a week; Monday–Saturday; Sunday afternoon emergencies; storm travel within Florida',
   'Daily rates available; determined per job', 'Fully insured',
   '1+ years truck operation; 10+ years tree experience',
   '20-inch cut hydraulic remote-control grapple head.',
   'https://www.sawfleet.com/our-fleet/freightliner-with-60ft-grapple-saw',
   'sawfleet:freightliner-with-60ft-grapple-saw',
   '{"grapple_heads":"20in cut hydraulic remote control","storm_travel":"Florida"}'),
  ('arbor-green-effer-505', 'Arbor Green Tree Service LLC', 'Evan', 'Effer 505', 'Effer', '505',
   13.6, 90, 'Milford', 'CT', 120, 500, 'Driveway friendly; over-roof picks',
   'Monday–Friday; Saturday available; storm travel',
   '$375/hour; four-hour minimum', 'Yes', 'Evan, 5+ years experience',
   'GMT 040 20-inch and GMT 050 36-inch grapple heads.',
   'https://sawfleet.com/equipment/effer-505/', 'sawfleet:effer-505',
   '{"grapple_heads":["GMT 040 (20in cut)","GMT 050 (36in cut)"],"current_status":"Available"}'),
  ('modern-scapes-bik-126', 'Modern Scapes Tree & Crane', NULL, 'BIK 126', 'BIK', '126',
   100, 126, 'Crystal River', 'FL', NULL, NULL, NULL, 'Available for hire',
   NULL, NULL, NULL, NULL, 'https://www.sawfleet.com/', 'sawfleet:modern-scapes-bik-126',
   '{"indexed_listing":"Available For Hire Modern Scapes Tree & Crane BIK 126 100t 126ft Crystal River, FL"}'),
  ('timber-stand-improvement-tc70-bik', 'Timber Stand Improvement', NULL, 'TC70 BIK', 'BIK', 'TC70',
   20, 70, 'Bend', 'OR', NULL, NULL, NULL, 'Available for hire',
   NULL, NULL, NULL, NULL, 'https://www.sawfleet.com/', 'sawfleet:timber-stand-improvement-tc70-bik',
   '{"indexed_listing":"Available For Hire Timber Stand Improvement TC70 BIK 20t 70ft Bend, OR"}'),
  ('farina-tree-care-copma-170-5', 'Farina Tree Care', NULL, 'Copma 170.5', 'Copma', '170.5',
   17, 60, 'Edgewater', 'FL', NULL, NULL, NULL, 'Available for hire',
   NULL, NULL, NULL, NULL, 'https://www.sawfleet.com/', 'sawfleet:farina-tree-care-copma-170-5',
   '{"indexed_listing":"Available For Hire Farina Tree Care Copma 170.5 17t 50 / 60ft Edgewater, FL","alternate_working_height_ft":50}'),
  ('greeleys-tree-service-copma-650', 'Greeley''s Tree Service', NULL, '2023 Western Star Copma 650', 'Copma', '650',
   65, 112, 'Bellville', 'TX', NULL, NULL, NULL, 'Available for hire',
   NULL, NULL, NULL, NULL, 'https://www.sawfleet.com/', 'sawfleet:greeleys-tree-service-copma-650',
   '{"indexed_listing":"Available For Hire Greeley''s Tree Service 2023 West Star Copma 650 65t 112ft Bellville, TX","chassis":"2023 Western Star"}'),
  ('nd-tree-service-pm100-western-star', 'N&D Tree Service', NULL, 'PM 100 Western Star', 'PM', '100',
   100, 126, 'Parker', 'CO', NULL, NULL, NULL, 'Available for hire',
   NULL, NULL, NULL, NULL, 'https://www.sawfleet.com/', 'sawfleet:nd-tree-service-pm100-western-star',
   '{"indexed_listing":"Available For Hire N&D Tree Service PM 100 Western Star 100t 126ft Parker, CO","chassis":"Western Star"}')
ON CONFLICT (source_key) DO UPDATE SET
  company_name = EXCLUDED.company_name,
  contact_name = COALESCE(EXCLUDED.contact_name, unclaimed_truck_directory.contact_name),
  equipment_name = EXCLUDED.equipment_name,
  manufacturer = EXCLUDED.manufacturer,
  model = EXCLUDED.model,
  lift_capacity_tons = EXCLUDED.lift_capacity_tons,
  working_height_ft = EXCLUDED.working_height_ft,
  location_city = EXCLUDED.location_city,
  location_state = EXCLUDED.location_state,
  service_radius_miles = COALESCE(EXCLUDED.service_radius_miles, unclaimed_truck_directory.service_radius_miles),
  storm_radius_miles = COALESCE(EXCLUDED.storm_radius_miles, unclaimed_truck_directory.storm_radius_miles),
  source_payload = unclaimed_truck_directory.source_payload || EXCLUDED.source_payload,
  last_checked_at = now(),
  updated_at = now();
