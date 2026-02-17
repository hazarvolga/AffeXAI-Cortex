const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5434,
  database: 'affexai_dev',
  user: 'postgres',
  password: 'postgres',
});

async function setupDemoKeys() {
  try {
    console.log('🔑 Setting up DEMO API keys for testing...\n');
    console.log('⚠️  NOTE: These are placeholder keys for demonstration.');
    console.log('   Replace with real keys for production use.\n');

    await client.connect();
    console.log('✅ Connected to database\n');

    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    // Check existing settings
    const existing = await client.query(`
      SELECT category, key,
             CASE WHEN value IS NOT NULL AND value != '' THEN 'Set' ELSE 'Empty' END as status
      FROM settings
      WHERE category IN ('email', 'ai')
      ORDER BY category, key
    `);

    console.log('📋 Current API key status:\n');
    console.table(existing.rows);

    // === EMAIL SETTINGS ===
    console.log('\n📧 Configuring Email Settings (Resend)...\n');

    // Delete existing email settings
    await client.query("DELETE FROM settings WHERE category = 'email'");

    // Insert email settings with DEMO key
    const emailSettings = [
      { key: 'provider', value: 'resend', encrypted: false },
      { key: 'provider.apiKey', value: 're_demo_1234567890abcdefghijklmnop', encrypted: false }, // DEMO KEY
      { key: 'from.name', value: 'Affexai Platform', encrypted: false },
      { key: 'from.email', value: 'noreply@affexai.com', encrypted: false },
      { key: 'replyTo.email', value: 'support@affexai.com', encrypted: false },
      { key: 'enabled', value: 'false', encrypted: false }, // Disabled for demo
    ];

    for (const setting of emailSettings) {
      await client.query(`
        INSERT INTO settings (id, category, key, value, is_encrypted, created_at, updated_at)
        VALUES (uuid_generate_v4(), 'email', $1, $2, $3, NOW(), NOW())
      `, [setting.key, setting.value, setting.encrypted]);
    }

    console.log('✅ Email settings configured (DEMO MODE - disabled)\n');

    // === AI SETTINGS ===
    console.log('🤖 Checking AI Settings...\n');

    const aiKey = await client.query(`
      SELECT value FROM settings
      WHERE category = 'ai' AND key = 'global.apiKey'
    `);

    if (aiKey.rows.length > 0 && aiKey.rows[0].value) {
      console.log('✅ AI API key already configured\n');
    } else {
      console.log('⚠️  AI API key not found. Adding DEMO key...\n');

      await client.query(`
        INSERT INTO settings (id, category, key, value, is_encrypted, created_at, updated_at)
        VALUES (uuid_generate_v4(), 'ai', 'global.apiKey', 'sk-demo-1234567890abcdefghijklmnop', false, NOW(), NOW())
        ON CONFLICT DO NOTHING
      `);
    }

    // === FINAL STATUS ===
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 FINAL CONFIGURATION');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const final = await client.query(`
      SELECT category, key,
             CASE
               WHEN value IS NOT NULL AND value != '' THEN '✅ Configured'
               ELSE '❌ Not Set'
             END as status
      FROM settings
      WHERE category IN ('email', 'ai')
      ORDER BY category, key
    `);

    console.table(final.rows);

    console.log('\n🎯 WHAT YOU CAN DO NOW:\n');
    console.log('✅ Email Settings:');
    console.log('   - Settings are configured (DEMO mode)');
    console.log('   - To enable: Add real Resend API key');
    console.log('   - Get key from: https://resend.com/api-keys\n');

    console.log('✅ AI Settings:');
    console.log('   - API key configured');
    console.log('   - Provider: OpenAI');
    console.log('   - Model: gpt-4o');
    console.log('   - To use: Replace with real OpenAI key');
    console.log('   - Get key from: https://platform.openai.com/api-keys\n');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('💡 NEXT STEPS:\n');
    console.log('1. ✅ Demo keys are in place (system ready to test structure)');
    console.log('2. 🔑 Add REAL keys to enable actual functionality:');
    console.log('');
    console.log('   -- For Email (Resend):');
    console.log('   UPDATE settings SET value = \'YOUR_RESEND_KEY\'');
    console.log('   WHERE category = \'email\' AND key = \'provider.apiKey\';');
    console.log('');
    console.log('   UPDATE settings SET value = \'true\'');
    console.log('   WHERE category = \'email\' AND key = \'enabled\';');
    console.log('');
    console.log('   -- For AI (OpenAI):');
    console.log('   UPDATE settings SET value = \'YOUR_OPENAI_KEY\'');
    console.log('   WHERE category = \'ai\' AND key = \'global.apiKey\';');
    console.log('');
    console.log('3. 🔄 Restart backend: cd apps/backend && npm run start:dev');
    console.log('4. 🧪 Test the features!\n');

    await client.end();
    console.log('✅ Setup complete!\n');

  } catch (error) {
    console.error('❌ Error setting up demo keys:', error);
    process.exit(1);
  }
}

setupDemoKeys();
