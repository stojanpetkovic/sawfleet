-- Territory-matched truck marketplace and lead applications.

CREATE TABLE IF NOT EXISTS truck_lead_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  truck_owner_id UUID NOT NULL REFERENCES truck_owners(id) ON DELETE CASCADE,
  truck_id UUID REFERENCES grapple_saw_trucks(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lead_id, truck_owner_id)
);

CREATE INDEX IF NOT EXISTS idx_truck_applications_lead ON truck_lead_applications(lead_id, status);
CREATE INDEX IF NOT EXISTS idx_truck_applications_owner ON truck_lead_applications(truck_owner_id, created_at DESC);

ALTER TABLE truck_lead_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "truck owners read own applications" ON truck_lead_applications;
CREATE POLICY "truck owners read own applications"
  ON truck_lead_applications FOR SELECT
  USING (truck_owner_id = auth.uid());

DROP POLICY IF EXISTS "truck owners create own applications" ON truck_lead_applications;
CREATE POLICY "truck owners create own applications"
  ON truck_lead_applications FOR INSERT
  WITH CHECK (truck_owner_id = auth.uid());

DROP POLICY IF EXISTS "truck owners withdraw own applications" ON truck_lead_applications;
CREATE POLICY "truck owners withdraw own applications"
  ON truck_lead_applications FOR UPDATE
  USING (truck_owner_id = auth.uid())
  WITH CHECK (truck_owner_id = auth.uid() AND status = 'withdrawn');

CREATE OR REPLACE FUNCTION get_recommended_trucks()
RETURNS TABLE (
  truck_id UUID,
  owner_id UUID,
  company_name TEXT,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  equipment_type TEXT,
  lift_capacity_tons NUMERIC,
  working_height_ft NUMERIC,
  access_type TEXT,
  listing_type TEXT,
  location TEXT,
  availability_status TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id,
    o.id,
    o.company_name,
    o.contact_name,
    COALESCE(t.owner_phone, o.phone),
    o.email,
    t.equipment_type,
    t.lift_capacity_tons::NUMERIC,
    t.working_height_ft::NUMERIC,
    t.access_type,
    t.listing_type,
    t.location,
    t.availability_status
  FROM contractors c
  JOIN grapple_saw_trucks t ON lower(trim(t.location)) = lower(trim(c.territory))
  JOIN truck_owners o ON o.id = t.owner_user_id
  WHERE c.user_id = auth.uid()
    AND c.status = 'active'
    AND o.status = 'approved'
    AND t.approval_status = 'approved'
    AND lower(COALESCE(t.availability_status, 'available')) = 'available'
  ORDER BY o.company_name NULLS LAST, t.equipment_type;
$$;

CREATE OR REPLACE FUNCTION get_available_truck_leads()
RETURNS TABLE (
  id UUID,
  county TEXT,
  details TEXT,
  source TEXT,
  created_at TIMESTAMPTZ,
  application_status TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT
    l.id,
    l.county,
    l.details,
    l.source,
    l.created_at,
    a.status
  FROM truck_owners o
  JOIN grapple_saw_trucks t ON t.owner_user_id = o.id
  JOIN leads l ON lower(trim(l.county)) = lower(trim(t.location))
  LEFT JOIN truck_lead_applications a
    ON a.lead_id = l.id AND a.truck_owner_id = o.id
  WHERE o.id = auth.uid()
    AND o.status = 'approved'
    AND t.approval_status = 'approved'
    AND lower(COALESCE(t.availability_status, 'available')) = 'available'
    AND l.status IN ('approved', 'claimed')
  ORDER BY l.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION apply_for_truck_lead(
  p_lead_id UUID,
  p_truck_id UUID DEFAULT NULL,
  p_message TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  application_id UUID;
  lead_county TEXT;
BEGIN
  SELECT county INTO lead_county
  FROM leads
  WHERE id = p_lead_id AND status IN ('approved', 'claimed');

  IF lead_county IS NULL THEN
    RAISE EXCEPTION 'Lead is not available';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM truck_owners o
    JOIN grapple_saw_trucks t ON t.owner_user_id = o.id
    WHERE o.id = auth.uid()
      AND o.status = 'approved'
      AND t.approval_status = 'approved'
      AND lower(COALESCE(t.availability_status, 'available')) = 'available'
      AND lower(trim(t.location)) = lower(trim(lead_county))
      AND (p_truck_id IS NULL OR t.id = p_truck_id)
  ) THEN
    RAISE EXCEPTION 'No eligible truck in this territory';
  END IF;

  INSERT INTO truck_lead_applications (lead_id, truck_owner_id, truck_id, message)
  VALUES (p_lead_id, auth.uid(), p_truck_id, NULLIF(trim(p_message), ''))
  ON CONFLICT (lead_id, truck_owner_id)
  DO UPDATE SET
    truck_id = EXCLUDED.truck_id,
    message = EXCLUDED.message,
    status = 'pending',
    updated_at = now()
  RETURNING id INTO application_id;

  RETURN application_id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_recommended_trucks() TO authenticated;
GRANT EXECUTE ON FUNCTION get_available_truck_leads() TO authenticated;
GRANT EXECUTE ON FUNCTION apply_for_truck_lead(UUID, UUID, TEXT) TO authenticated;
