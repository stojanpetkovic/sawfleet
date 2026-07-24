#!/usr/bin/env node
/**
 * Railway Cron Script
 * Poziva archive-permits-cron endpoint
 *
 * Railway Cron Service → postavi Schedule: 0 2 * * *
 * Command: node scripts/cron-archive.js
 *
 * Environment variables potrebne:
 *   SITE_URL=https://sftreeremoval.com
 *   CRON_SECRET=<ista vrednost kao na glavnom web servisu>
 */

const siteUrl = process.env.SITE_URL || process.env.PUBLIC_SITE_URL || 'https://sftreeremoval.com';
const endpoint = `${siteUrl}/api/archive-permits-cron`;
const cronSecret = process.env.CRON_SECRET || '';

if (!cronSecret) {
  console.error('[CRON] Missing CRON_SECRET env var — the endpoint now requires it (401 otherwise).');
  process.exit(1);
}

console.log(`[CRON] ${new Date().toISOString()} - Calling ${endpoint}`);

const response = await fetch(endpoint, {
  method: 'GET',
  headers: { 'User-Agent': 'RailwayCron/1.0', Authorization: `Bearer ${cronSecret}` },
});

const data = await response.json().catch(() => ({}));

if (!response.ok || !data.ok) {
  console.error('[CRON] Failed:', response.status, data);
  process.exit(1);
}

console.log(`[CRON] Success: ${data.message}`);
console.log(`[CRON] Archived: ${data.archived} leads`);
