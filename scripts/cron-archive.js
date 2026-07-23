#!/usr/bin/env node
/**
 * Railway Cron Script
 * Poziva archive-permits-cron endpoint
 * 
 * Railway Cron Service → postavi Schedule: 0 2 * * *
 * Command: node scripts/cron-archive.js
 * 
 * Environment variable potrebna:
 *   SITE_URL=https://sftreeremoval.com
 */

const siteUrl = process.env.SITE_URL || process.env.PUBLIC_SITE_URL || 'https://sftreeremoval.com';
const endpoint = `${siteUrl}/api/archive-permits-cron`;

console.log(`[CRON] ${new Date().toISOString()} - Calling ${endpoint}`);

const response = await fetch(endpoint, {
  method: 'GET',
  headers: { 'User-Agent': 'RailwayCron/1.0' },
});

const data = await response.json().catch(() => ({}));

if (!response.ok || !data.ok) {
  console.error('[CRON] Failed:', response.status, data);
  process.exit(1);
}

console.log(`[CRON] Success: ${data.message}`);
console.log(`[CRON] Archived: ${data.archived} leads`);
