#!/usr/bin/env node

/**
 * Migration script to add archive columns to permit_leads table
 * Attempts both Supabase instances
 */

import https from 'https';

// Try permit-specific Supabase instance first
const supabaseInstances = [
  {
    name: "Permit Dashboard",
    url: 'tjzpqyfjtjepvguywzgn.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqenBxeWZqdGplcHZndXl3emduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNzgyMjQsImV4cCI6MjA5MDg1NDIyNH0.H42xFcUVYoyIHqFd1OskGBWi4OHdvClZ0EMr566FJrI',
  }
];

async function executeSQL(hostname, sql, authHeader) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      path: '/rest/v1/rpc/execute_sql',
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'apikey': authHeader.replace('Bearer ', ''),
      },
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve({ status: res.statusCode, data: result });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(JSON.stringify({ sql_string: sql }));
    req.end();
  });
}

async function main() {
  console.log('Adding archive columns to permit_leads table...\n');

  const sqls = [
    'ALTER TABLE permit_leads ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;',
    'ALTER TABLE permit_leads ADD COLUMN IF NOT EXISTS archive_reason TEXT;',
  ];

  for (const instance of supabaseInstances) {
    console.log(`\n📡 Trying ${instance.name} (${instance.url})...`);
    const authHeader = `Bearer ${instance.anonKey}`;

    for (const sql of sqls) {
      console.log(`  SQL: ${sql.substring(0, 50)}...`);
      try {
        const result = await executeSQL(instance.url, sql, authHeader);
        
        if (result.status === 200 || result.status === 201) {
          console.log(`  ✓ Success (Status: ${result.status})`);
        } else if (result.status === 404) {
          console.log(`  ⚠ RPC endpoint not found (404)`);
        } else if (result.status === 401) {
          console.log(`  ✗ Unauthorized (401) - Wrong credentials`);
        } else {
          console.log(`  Status: ${result.status}`);
          if (result.data?.message) {
            console.log(`  Message: ${result.data.message}`);
          }
        }
      } catch (error) {
        console.log(`  ✗ Error: ${error.message}`);
      }
    }
  }

  console.log('\n\n📋 If automatic migration failed, run this SQL manually:\n');
  console.log('---');
  sqls.forEach(sql => console.log(sql));
  console.log('---');
  console.log('\n🔗 Go to: https://supabase.com/dashboard/project/tjzpqyfjtjepvguywzgn/sql/new');
  console.log('Then paste the SQL above and click "Run"\n');
}

main();
