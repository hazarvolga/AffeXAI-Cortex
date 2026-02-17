import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Default Email Builder structure for templates
const createDefaultStructure = (templateName: string) => ({
  rows: [
    {
      id: 'row-header',
      type: 'section',
      columns: [
        {
          id: 'col-header',
          width: '100%',
          blocks: [
            {
              id: 'block-heading',
              type: 'heading',
              styles: {
                color: '#1a202c',
                fontSize: '28px',
                textAlign: 'center',
                fontWeight: 'bold',
              },
              properties: {
                level: 1,
                content: templateName,
              },
            },
          ],
        },
      ],
      settings: {
        padding: '32px 24px',
        backgroundColor: '#f7fafc',
      },
    },
    {
      id: 'row-content',
      type: 'section',
      columns: [
        {
          id: 'col-content',
          width: '100%',
          blocks: [
            {
              id: 'block-intro',
              type: 'text',
              styles: {
                color: '#4a5568',
                fontSize: '16px',
                lineHeight: '1.6',
              },
              properties: {
                content: 'Bu şablon Email Builder ile düzenlenmeye hazır.',
              },
            },
            {
              id: 'block-divider-1',
              type: 'divider',
              styles: {
                color: '#e2e8f0',
                height: '1px',
                marginTop: '24px',
                borderStyle: 'solid',
                marginBottom: '24px',
              },
              properties: {},
            },
            {
              id: 'block-main-content',
              type: 'text',
              styles: {
                color: '#2d3748',
                fontSize: '15px',
                lineHeight: '1.6',
              },
              properties: {
                content: '{{content}}',
              },
            },
          ],
        },
      ],
      settings: {
        padding: '24px',
        backgroundColor: '#ffffff',
      },
    },
    {
      id: 'row-cta',
      type: 'section',
      columns: [
        {
          id: 'col-cta',
          width: '100%',
          blocks: [
            {
              id: 'block-button',
              type: 'button',
              styles: {
                align: 'center',
                color: '#ffffff',
                fontSize: '16px',
                paddingX: '32px',
                paddingY: '14px',
                fontWeight: '600',
                borderRadius: '6px',
                backgroundColor: '#ff7f1e',
              },
              properties: {
                url: '#',
                text: 'İşleme Devam Et',
              },
            },
          ],
        },
      ],
      settings: {
        padding: '24px',
        backgroundColor: '#ffffff',
      },
    },
    {
      id: 'row-footer',
      type: 'section',
      columns: [
        {
          id: 'col-footer',
          width: '100%',
          blocks: [
            {
              id: 'block-divider-2',
              type: 'divider',
              styles: {
                color: '#e2e8f0',
                height: '1px',
                marginTop: '24px',
                borderStyle: 'solid',
                marginBottom: '24px',
              },
              properties: {},
            },
            {
              id: 'block-footer-text',
              type: 'text',
              styles: {
                color: '#a0aec0',
                fontSize: '12px',
                textAlign: 'center',
                lineHeight: '1.5',
              },
              properties: {
                content: '© 2025 Affexai. Tüm hakları saklıdır.',
              },
            },
          ],
        },
      ],
      settings: {
        padding: '24px',
        backgroundColor: '#f7fafc',
      },
    },
  ],
  settings: {
    fonts: ['Inter'],
    contentWidth: '600px',
    backgroundColor: '#f5f5f5',
  },
});

async function fixEmptyTemplateStructures() {
  // Parse DATABASE_URL from .env
  const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5434/affexai_dev';
  const url = new URL(dbUrl);

  const AppDataSource = new DataSource({
    type: 'postgres',
    host: url.hostname,
    port: parseInt(url.port),
    username: url.username,
    password: url.password,
    database: url.pathname.slice(1), // Remove leading /
    entities: [],
    synchronize: false,
  });

  try {
    console.log('🔌 Connecting to database...');
    await AppDataSource.initialize();
    console.log('✅ Connected to database');

    // Find templates with empty structure
    const templatesWithEmptyStructure = await AppDataSource.query(`
      SELECT id, name, description
      FROM email_templates
      WHERE structure IS NULL OR structure::text = 'null'
    `);

    console.log(`\n📊 Found ${templatesWithEmptyStructure.length} templates with empty structure:\n`);

    if (templatesWithEmptyStructure.length === 0) {
      console.log('✅ All templates have structure! No action needed.');
      await AppDataSource.destroy();
      return;
    }

    for (const template of templatesWithEmptyStructure) {
      console.log(`📝 ${template.name} (${template.id})`);
    }

    console.log('\n🔧 Updating templates with default Email Builder structure...\n');

    let successCount = 0;
    let errorCount = 0;

    for (const template of templatesWithEmptyStructure) {
      try {
        const defaultStructure = createDefaultStructure(template.name);

        await AppDataSource.query(
          `UPDATE email_templates
           SET structure = $1,
               "updatedAt" = NOW()
           WHERE id = $2`,
          [JSON.stringify(defaultStructure), template.id]
        );

        console.log(`  ✅ Updated: ${template.name}`);
        successCount++;
      } catch (error) {
        console.error(`  ❌ Failed: ${template.name} - ${error.message}`);
        errorCount++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`  ✅ Success: ${successCount}`);
    console.log(`  ❌ Failed: ${errorCount}`);
    console.log(`  📝 Total: ${templatesWithEmptyStructure.length}`);

    await AppDataSource.destroy();
    console.log('\n✅ Done!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the script
fixEmptyTemplateStructures();
