-- ============================================================================
-- SECURITY HARDENING: VIEWS AND FUNCTIONS
-- Change SECURITY DEFINER to SECURITY INVOKER where appropriate
-- Ensure stored procedures respect user permissions
-- ============================================================================

-- ============================================================================
-- VIEWS - Use SECURITY INVOKER to respect RLS policies
-- ============================================================================

-- contractor_review_stats - Already fixed in 20260725000000, but re-applying to be sure
DROP VIEW IF EXISTS contractor_review_stats CASCADE;
CREATE OR REPLACE VIEW contractor_review_stats WITH (security_invoker) AS
  SELECT 
    contractor_id, 
    COUNT(*) AS review_count, 
    ROUND(AVG(rating)::NUMERIC, 1) AS avg_rating
  FROM contractor_reviews 
  WHERE status = 'approved' 
  GROUP BY contractor_id;

-- ============================================================================
-- STORED FUNCTIONS - Security Review and Hardening
-- ============================================================================

-- Function: claim_lead - Claims a lead for a contractor
-- Security: Should ONLY allow contractors to claim leads they can claim
-- Default is SECURITY DEFINER, which means it runs with creator's permissions
-- SHOULD BE: SECURITY INVOKER so it respects the claimer's user context
DROP FUNCTION IF EXISTS claim_lead(uuid);
CREATE OR REPLACE FUNCTION public.claim_lead(p_lead_id uuid)
  RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    lead_id UUID,
    credit_deducted NUMERIC
  )
  LANGUAGE plpgsql
  SECURITY INVOKER -- CRITICAL: Use caller's permissions, not creator's
  STRICT
  AS $$
DECLARE
  v_contractor_id UUID;
  v_lead public.leads;
  v_settings public.credit_settings;
  v_balance NUMERIC;
BEGIN
  v_contractor_id := auth.uid();
  
  IF v_contractor_id IS NULL THEN
    RETURN QUERY SELECT false, 'Not authenticated'::TEXT, NULL::UUID, 0::NUMERIC;
    RETURN;
  END IF;

  -- Check if contractor exists and is active
  IF NOT EXISTS (
    SELECT 1 FROM public.contractors 
    WHERE user_id = v_contractor_id AND is_active = true
  ) THEN
    RETURN QUERY SELECT false, 'Contractor not found or inactive'::TEXT, NULL::UUID, 0::NUMERIC;
    RETURN;
  END IF;

  -- Lock and fetch the lead
  SELECT * INTO v_lead FROM public.leads 
  WHERE id = p_lead_id 
  FOR UPDATE;
  
  IF v_lead IS NULL THEN
    RETURN QUERY SELECT false, 'Lead not found'::TEXT, NULL::UUID, 0::NUMERIC;
    RETURN;
  END IF;

  -- Check lead status
  IF v_lead.status != 'available' THEN
    RETURN QUERY SELECT false, 'Lead is not available'::TEXT, p_lead_id, 0::NUMERIC;
    RETURN;
  END IF;

  -- Check credit system if enabled
  SELECT * INTO v_settings FROM public.credit_settings WHERE id = 1;
  
  IF v_settings.enabled THEN
    SELECT credit_balance INTO v_balance FROM public.contractors 
    WHERE user_id = v_contractor_id;
    
    IF v_balance < v_settings.lead_cost THEN
      RETURN QUERY SELECT false, 'Insufficient credits'::TEXT, p_lead_id, 0::NUMERIC;
      RETURN;
    END IF;
    
    -- Deduct credits
    UPDATE public.contractors 
    SET credit_balance = credit_balance - v_settings.lead_cost
    WHERE user_id = v_contractor_id;
    
    -- Log transaction
    INSERT INTO public.credit_transactions 
    (account_type, account_id, amount, balance_after, reason, related_lead_id, created_by)
    VALUES 
    ('contractor', v_contractor_id, -v_settings.lead_cost, 
     v_balance - v_settings.lead_cost, 'Lead Claim', p_lead_id, v_contractor_id);
  END IF;

  -- Update lead
  UPDATE public.leads 
  SET 
    status = 'claimed',
    contractor_id = v_contractor_id,
    claimed_at = now()
  WHERE id = p_lead_id;

  RETURN QUERY SELECT 
    true, 
    'Lead claimed successfully'::TEXT, 
    p_lead_id, 
    COALESCE(v_settings.lead_cost, 0);
END;
$$;

-- ============================================================================
-- Function: apply_for_truck_lead - Apply for a truck lead
-- Similar security concern
DROP FUNCTION IF EXISTS apply_for_truck_lead(uuid, uuid, text);
CREATE OR REPLACE FUNCTION public.apply_for_truck_lead(
  p_lead_id uuid, 
  p_truck_id uuid DEFAULT NULL::uuid, 
  p_message text DEFAULT NULL::text
)
  RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    application_id UUID,
    credit_deducted NUMERIC
  )
  LANGUAGE plpgsql
  SECURITY INVOKER -- CRITICAL: Use caller's permissions
  AS $$
DECLARE
  v_truck_owner_id UUID;
  v_settings public.credit_settings;
  v_balance NUMERIC;
  v_app_id UUID;
BEGIN
  v_truck_owner_id := auth.uid();
  
  IF v_truck_owner_id IS NULL THEN
    RETURN QUERY SELECT false, 'Not authenticated'::TEXT, NULL::UUID, 0::NUMERIC;
    RETURN;
  END IF;

  -- Check if truck owner exists
  IF NOT EXISTS (
    SELECT 1 FROM public.truck_owners WHERE user_id = v_truck_owner_id
  ) THEN
    RETURN QUERY SELECT false, 'Truck owner not found'::TEXT, NULL::UUID, 0::NUMERIC;
    RETURN;
  END IF;

  -- Get credit settings if enabled
  SELECT * INTO v_settings FROM public.credit_settings WHERE id = 1;
  
  IF v_settings.enabled THEN
    SELECT credit_balance INTO v_balance FROM public.truck_owners 
    WHERE user_id = v_truck_owner_id;
    
    IF v_balance < v_settings.application_cost THEN
      RETURN QUERY SELECT false, 'Insufficient credits'::TEXT, NULL::UUID, 0::NUMERIC;
      RETURN;
    END IF;
  END IF;

  -- Create application
  INSERT INTO public.truck_lead_applications (lead_id, truck_id, truck_owner_id, message)
  VALUES (p_lead_id, p_truck_id, 
    (SELECT id FROM public.truck_owners WHERE user_id = v_truck_owner_id), 
    p_message)
  RETURNING id INTO v_app_id;

  -- Deduct credits if enabled
  IF v_settings.enabled THEN
    UPDATE public.truck_owners 
    SET credit_balance = credit_balance - v_settings.application_cost
    WHERE user_id = v_truck_owner_id;
    
    INSERT INTO public.credit_transactions 
    (account_type, account_id, amount, balance_after, reason, related_lead_id, created_by)
    VALUES 
    ('truck_owner', v_truck_owner_id, -v_settings.application_cost, 
     v_balance - v_settings.application_cost, 'Lead Application', p_lead_id, v_truck_owner_id);
  END IF;

  RETURN QUERY SELECT 
    true, 
    'Application submitted successfully'::TEXT, 
    v_app_id, 
    COALESCE(v_settings.application_cost, 0);
END;
$$;

-- ============================================================================
-- Function: is_credit_system_enabled - Check if credit system is enabled
-- This is read-only and safe to use SECURITY DEFINER, but INVOKER is better
DROP FUNCTION IF EXISTS is_credit_system_enabled();
CREATE OR REPLACE FUNCTION public.is_credit_system_enabled()
  RETURNS BOOLEAN
  LANGUAGE plpgsql
  SECURITY INVOKER -- Read-only, safe to use user context
  STABLE
  AS $$
BEGIN
  RETURN COALESCE((SELECT enabled FROM public.credit_settings WHERE id = 1), false);
END;
$$;

-- ============================================================================
-- COMPREHENSIVE FUNCTION SECURITY AUDIT
-- ============================================================================
-- ✓ claim_lead: Changed to SECURITY INVOKER - respects caller's auth context
-- ✓ apply_for_truck_lead: Changed to SECURITY INVOKER - respects caller's auth context
-- ✓ is_credit_system_enabled: Changed to SECURITY INVOKER - read-only, safe
-- ✓ All functions now execute with caller's permissions, not elevated
-- ✓ Stored functions will now be subject to RLS policies on underlying tables
-- ✓ Better audit trail - actions logged with actual user context
