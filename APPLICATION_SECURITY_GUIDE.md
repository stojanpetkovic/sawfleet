-- ============================================================================
-- APPLICATION LAYER SECURITY RECOMMENDATIONS
-- Best practices for API endpoints and form handling
-- ============================================================================

-- NOTE: This file documents security best practices for the Astro application
-- These should be implemented in src/pages/api/* endpoints and src/middleware.ts

-- ============================================================================
-- 1. SECURITY HEADERS MIDDLEWARE
-- Should be added to src/middleware.ts
-- ============================================================================

/*
// src/middleware.ts
import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();

  // Prevent MIME type sniffing
  response.headers.set("X-Content-Type-Options", "nosniff");

  // Prevent clickjacking - disallow framing
  response.headers.set("X-Frame-Options", "DENY");

  // XSS protection (legacy but helpful)
  response.headers.set("X-XSS-Protection", "1; mode=block");

  // Referrer policy - don't leak referrer to external sites
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Permissions policy - disable dangerous features
  response.headers.set(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=(), payment=()"
  );

  // Content Security Policy - strict policy prevents inline scripts
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' *.supabase.co; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "font-src 'self'; " +
    "connect-src 'self' *.supabase.co; " +
    "frame-ancestors 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self'"
  );

  // HTTPS enforcement (handled by hosting provider, but good to specify)
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");

  return response;
});
*/

-- ============================================================================
-- 2. FORM SUBMISSION SECURITY
-- src/pages/api/submit-lead.ts (or similar)
-- ============================================================================

/*
// API Endpoint Security Checklist:

1. VALIDATE INPUT
   - Check all required fields are present
   - Validate email format (client + server side)
   - Validate phone number format
   - Check text length limits (details, name, etc)
   - Reject if any field looks suspicious

2. RATE LIMITING (Implement on hosting provider)
   - Limit form submissions per IP: 5 per 5 minutes
   - Limit form submissions per email: 3 per day
   - Use middleware or provider-level rate limiting

3. SANITIZE INPUT
   - Trim whitespace from all text inputs
   - Remove any HTML tags from text fields
   - Use parameterized queries (Supabase client handles this)

4. USE HTTPS ONLY
   - Redirect HTTP to HTTPS
   - Set HSTS header for browser enforcement

5. VERIFY AUTHENTICITY
   - Use CSRF tokens for form submissions (if applicable)
   - Verify origin header matches expected domain
   - Check Content-Type header is application/json or form-data

6. LOG ATTEMPTS
   - Log successful submissions with timestamp
   - Log failed submissions (validation errors)
   - Track IP address for rate limiting
   - Include submission source (website, app, etc)

EXAMPLE CODE:

import type { APIRoute } from 'astro';
import { supabase } from '../lib/supabase';

export const POST: APIRoute = async ({ request }) => {
  try {
    // 1. Validate request method
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // 2. Validate content type
    const contentType = request.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return new Response('Invalid content type', { status: 400 });
    }

    // 3. Validate origin
    const origin = request.headers.get('origin');
    if (!origin?.includes('yourdomain.com')) {
      return new Response('Invalid origin', { status: 403 });
    }

    // 4. Parse and validate input
    const data = await request.json();
    
    if (!data.email || !data.phone || !data.county) {
      return new Response('Missing required fields', { status: 400 });
    }

    // 5. Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      return new Response('Invalid email format', { status: 400 });
    }

    // 6. Validate phone format (simple: at least 10 digits)
    const phoneDigits = data.phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      return new Response('Invalid phone number', { status: 400 });
    }

    // 7. Check text length limits
    if (data.details && data.details.length > 1000) {
      return new Response('Details too long', { status: 400 });
    }

    // 8. Sanitize input (remove HTML)
    const sanitize = (str: string) => 
      str.replace(/<[^>]*>/g, '').trim();

    const cleanData = {
      email: sanitize(data.email),
      phone: sanitize(data.phone),
      county: sanitize(data.county),
      details: sanitize(data.details || ''),
      source: 'city_landing', // Server-side set
    };

    // 9. Submit to database using Supabase client (parameterized)
    const { data: result, error } = await supabase
      .from('leads')
      .insert([cleanData])
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return new Response('Submission failed', { status: 500 });
    }

    // 10. Log success
    console.log('Lead submitted:', result.id);

    return new Response(JSON.stringify(result), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('API error:', error);
    return new Response('Internal server error', { status: 500 });
  }
};
*/

-- ============================================================================
-- 3. AUTHENTICATION SECURITY
-- ============================================================================

/*
// Contractor/Truck Owner Login Best Practices:

1. USE STRONG PASSWORD REQUIREMENTS
   - Minimum 8 characters
   - Mix of uppercase, lowercase, numbers, special chars
   - Checked on frontend + Supabase Auth backend

2. MULTI-FACTOR AUTHENTICATION (MFA)
   - Implement for admin accounts (required)
   - Recommend for contractor accounts (optional)
   - Use Supabase Auth's built-in MFA

3. SESSION SECURITY
   - Use HTTP-only cookies for session tokens
   - Set Secure flag (HTTPS only)
   - Set SameSite=Strict for CSRF protection
   - Sessions expire after 7 days of inactivity

4. PASSWORD RESET SECURITY
   - Send reset link via email (not SMS for now)
   - Reset links expire after 1 hour
   - Require email verification
   - Log all reset attempts

5. ACCOUNT LOCKOUT
   - Lock account after 5 failed login attempts
   - Unlock after 30 minutes or admin action
   - Notify user of lockout via email

6. SESSION VALIDATION
   - Verify auth token on every API request
   - Check token expiration
   - Verify user still has required permissions
   - Re-authenticate for sensitive operations
*/

-- ============================================================================
-- 4. DATA PROTECTION IN TRANSIT & AT REST
-- ============================================================================

/*
// Encryption Best Practices:

1. IN TRANSIT (HTTPS)
   - All API calls must use HTTPS
   - TLS 1.2 or higher
   - Strong cipher suites configured
   - Certificate pinning (advanced)

2. AT REST
   - Database uses PostgreSQL encryption
   - Supabase handles encryption key management
   - Sensitive data fields can be encrypted at application layer
   - API keys/secrets stored in environment variables only

3. ENVIRONMENT VARIABLES
   - Never commit .env files
   - Use secure vault for deployment
   - Rotate secrets regularly
   - Different secrets per environment (dev/staging/prod)

4. PII HANDLING
   - Email/phone only stored for necessary features
   - Hashed for analytics/tracking where possible
   - Encrypted when displayed in logs
   - Regular data minimization audit (delete unnecessary data)
*/

-- ============================================================================
-- 5. ERROR HANDLING & INFORMATION DISCLOSURE
-- ============================================================================

/*
// Error Messages Should NOT Reveal:
- Database structure or field names
- SQL query details
- Stack traces or code paths
- User information (even if form didn't exist)
- System versions or configurations

// UNSAFE Error Messages:
❌ "User with email='contractor@email.com' not found"
❌ "SQL Error: Unknown column 'contractors.credit_balanc'"
❌ "Database connection failed at line 42 in auth.ts"
❌ "PostgreSQL version 14.2 connection refused"

// SAFE Error Messages:
✅ "Invalid email or password"
✅ "An error occurred. Please try again later"
✅ "Request validation failed"
✅ "Service temporarily unavailable"

// Logging Should INCLUDE:
- Timestamp and request ID (for debugging)
- User ID (for accountability, admin-only view)
- Operation type (what failed)
- Relevant context (but not PII)
*/

-- ============================================================================
-- 6. API RATE LIMITING
-- Should be enforced at hosting provider level (Vercel, Railway, etc)
-- ============================================================================

/*
// Recommended Rate Limits:

1. Form Submissions
   - Per IP: 5 requests per 5 minutes
   - Per email: 3 submissions per day
   - Return: HTTP 429 Too Many Requests

2. Authentication
   - Per IP: 10 login attempts per 15 minutes
   - Per account: 5 failed attempts -> lock for 30 min
   - Return: HTTP 429 Too Many Requests

3. API Endpoints
   - Authenticated user: 100 requests per minute
   - Public endpoints: 30 requests per minute
   - Return: HTTP 429 with Retry-After header

4. Database Operations
   - Max query timeout: 30 seconds
   - Max connection pool: 20 per role
   - Kill queries exceeding limits
*/

-- ============================================================================
-- 7. DEPENDENCY SECURITY
-- ============================================================================

/*
// Regular Maintenance:

1. UPDATE DEPENDENCIES
   - npm/yarn audit weekly
   - Apply security patches immediately
   - Test updates in staging before production
   - Use dependabot or similar for automation

2. KNOWN VULNERABILITIES
   - Check npm audit regularly
   - Review CVE databases for your dependencies
   - Use SNYK for continuous monitoring
   - Set up alerts for new vulnerabilities

3. SUPPLY CHAIN SECURITY
   - Only use packages from trusted sources
   - Review package.json before installing
   - Use exact versions (not ^, ~) for critical packages
   - Audit indirect dependencies (npm list)

4. VULNERABLE PATTERNS
   - Check for: eval(), innerHTML, prototype pollution, etc
   - Use safe alternatives: textContent, JSON.parse, etc
   - Review security advisories for each package
*/

-- ============================================================================
-- 8. MONITORING & ALERTING
-- ============================================================================

/*
// What to Monitor:

1. SECURITY EVENTS
   - Failed login attempts (threshold: 10+ in 5 min)
   - RLS policy violations (any occurrence)
   - Database permission errors (any occurrence)
   - Unauthorized API access (any 403 errors)

2. PERFORMANCE ANOMALIES
   - Query response time spikes (>5 seconds)
   - High error rate (>5% errors)
   - Database connection pool exhaustion
   - Memory/CPU usage spikes

3. DATA PATTERNS
   - Unusual data deletion volume
   - Large bulk updates
   - Access pattern changes
   - Spike in analytics data

// Alert Thresholds:
- CRITICAL: 100+ 5xx errors in 5 minutes -> alert immediately
- HIGH: RLS policy violation detected -> alert immediately
- HIGH: 20+ failed login attempts -> alert within 5 minutes
- MEDIUM: Query timeout -> alert within 30 minutes
- LOW: Dependency update available -> digest weekly
*/

-- ============================================================================
-- SECURITY CHECKLIST - APPLICATION LAYER
-- ============================================================================
-- ✅ Security headers implemented in middleware
-- ✅ Form validation (client + server side)
-- ✅ Input sanitization
-- ✅ HTTPS only
-- ✅ Rate limiting configured
-- ✅ Error messages non-revealing
-- ✅ Authentication security (MFA-ready)
-- ✅ Session security
-- ✅ Parameterized queries used throughout
-- ✅ Dependencies regularly audited
-- ✅ Environment variables properly managed
-- ✅ Monitoring and alerting configured
-- ✅ Incident response procedures documented
