import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import AppDataSource from '../data-source';

async function seedData() {
  try {
    // ⚠️ SECURITY: Only run in development environment
    if (process.env.NODE_ENV === 'production') {
      console.log('❌ Cannot run seed in production environment');
      console.log('💡 Please use the admin panel to create users in production');
      process.exit(1);
    }

    await AppDataSource.initialize();
    console.log('✅ Database connected');

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();

    // 1. Seed/Update standard roles
    console.log('📋 Ensuring standard roles exist...');

    await queryRunner.query(`
      INSERT INTO roles (id, name, "displayName", description, permissions, is_active, is_custom, created_at, updated_at)
      VALUES
      -- Admin Role
      (
          'a1b2c3d4-e5f6-4789-abcd-000000000001',
          'admin',
          'Admin',
          'Tüm sistem üzerinde tam yetkiye sahip.',
          '["users.view","users.create","users.update","users.delete","roles.view","roles.manage","events.view","events.create","events.update","events.delete","events.participants","certificates.view","certificates.create","certificates.update","certificates.revoke","support.view","support.respond","support.assign","marketing.manage","marketing.campaigns","cms.pages.view","cms.pages.create","cms.pages.update","cms.pages.delete","cms.menus.manage","system.settings","system.logs"]'::jsonb,
          true,
          false,
          NOW(),
          NOW()
      ),
      -- Editor Role
      (
          'a1b2c3d4-e5f6-4789-abcd-000000000002',
          'editor',
          'Editor',
          'İçerik (CMS), etkinlik ve sertifika yönetimi yapabilir.',
          '["events.view","events.create","events.update","events.delete","events.participants","certificates.view","certificates.create","certificates.update","certificates.revoke","cms.pages.view","cms.pages.create","cms.pages.update","cms.pages.delete","cms.menus.manage"]'::jsonb,
          true,
          false,
          NOW(),
          NOW()
      ),
      -- Customer Role
      (
          'a1b2c3d4-e5f6-4789-abcd-000000000003',
          'customer',
          'Customer',
          'Normal müşteri kullanıcı.',
          '["events.view","certificates.view"]'::jsonb,
          true,
          false,
          NOW(),
          NOW()
      ),
      -- Support Team Role
      (
          'a1b2c3d4-e5f6-4789-abcd-000000000004',
          'support',
          'Support Team',
          'Destek taleplerini yönetir ve yanıtlar.',
          '["support.view","support.respond","support.assign"]'::jsonb,
          true,
          false,
          NOW(),
          NOW()
      ),
      -- Viewer Role
      (
          'a1b2c3d4-e5f6-4789-abcd-000000000005',
          'viewer',
          'Viewer',
          'Sadece görüntüleme yetkisi.',
          '["users.view","roles.view","events.view","certificates.view","cms.pages.view"]'::jsonb,
          true,
          false,
          NOW(),
          NOW()
      ),
      -- Student Role
      (
          'a1b2c3d4-e5f6-4789-abcd-000000000006',
          'student',
          'Student',
          'Öğrenci rolü - eğitim içeriklerine erişim.',
          '["events.view","certificates.view","courses.view"]'::jsonb,
          true,
          false,
          NOW(),
          NOW()
      ),
      -- Subscriber Role
      (
          'a1b2c3d4-e5f6-4789-abcd-000000000007',
          'subscriber',
          'Subscriber',
          'Abone rolü - bülten ve pazarlama içeriklerine erişim.',
          '["newsletter.view","marketing.receive"]'::jsonb,
          true,
          false,
          NOW(),
          NOW()
      ),
      -- Marketing Manager Role
      (
          'a1b2c3d4-e5f6-4789-abcd-000000000008',
          'marketing_manager',
          'Marketing Manager',
          'Email kampanyaları, bültenler ve pazarlama stratejilerini yönetir.',
          '["marketing.manage","marketing.campaigns","marketing.subscribers","marketing.templates","marketing.analytics","newsletter.manage"]'::jsonb,
          true,
          false,
          NOW(),
          NOW()
      ),
      -- Support Manager Role
      (
          'a1b2c3d4-e5f6-4789-abcd-000000000009',
          'support_manager',
          'Support Manager',
          'Destek ekibini yönetir, raporları görüntüler, SLA ayarlarını yapar.',
          '["support.view","support.respond","support.assign","support.manage","support.reports","support.settings","support.sla"]'::jsonb,
          true,
          false,
          NOW(),
          NOW()
      ),
      -- Support Agent Role
      (
          'a1b2c3d4-e5f6-4789-abcd-000000000010',
          'support_agent',
          'Support Agent',
          'Destek taleplerini yanıtlar ve çözer.',
          '["support.view","support.respond"]'::jsonb,
          true,
          false,
          NOW(),
          NOW()
      ),
      -- Event Manager Role (NEW Standard)
      (
          'a1b2c3d4-e5f6-4789-abcd-000000000011',
          'event_manager',
          'Event Manager',
          'Etkinlikleri, webinar süreçlerini ve katılımcıları yönetir.',
          '["events.view","events.create","events.update","events.delete","events.participants"]'::jsonb,
          true,
          false,
          NOW(),
          NOW()
      ),
      -- Training Manager Role (NEW Standard)
      (
          'a1b2c3d4-e5f6-4789-abcd-000000000012',
          'training_manager',
          'Training Manager',
          'Sertifika süreçlerini ve eğitim materyallerini yönetir.',
          '["certificates.view","certificates.create","certificates.update","certificates.revoke","courses.view","courses.manage"]'::jsonb,
          true,
          false,
          NOW(),
          NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          "displayName" = EXCLUDED."displayName",
          description = EXCLUDED.description,
          permissions = EXCLUDED.permissions,
          is_active = EXCLUDED.is_active,
          is_custom = EXCLUDED.is_custom;
    `);
    console.log('✅ Standard roles seeded/updated successfully');

    // 2. Check and seed admin user
    console.log('👤 Checking admin user...');
    const adminExists = await queryRunner.query(
      "SELECT * FROM users WHERE email = 'admin@aluplan.com'"
    );

    if (adminExists.length === 0) {
      console.log('🔧 Creating admin user...');
      const hashedPassword = await bcrypt.hash('Admin123!', 10);

      await queryRunner.query(`
        INSERT INTO users (
          id, 
          email, 
          password, 
          "firstName", 
          "lastName", 
          "roleId", 
          "isActive", 
          "emailVerified", 
          "emailVerifiedAt",
          created_at, 
          updated_at
        ) VALUES (
          gen_random_uuid(),
          'admin@aluplan.com',
          $1,
          'Admin',
          'User',
          'a1b2c3d4-e5f6-4789-abcd-000000000001',
          true,
          true,
          NOW(),
          NOW(),
          NOW()
        )
      `, [hashedPassword]);

      console.log('✅ Admin user created successfully');
      console.log('   Email: admin@aluplan.com');
      console.log('   Password: Admin123!');
    } else {
      console.log('✅ Admin user already exists');
      // Update password to ensure it's correct
      const hashedPassword = await bcrypt.hash('Admin123!', 10);
      await queryRunner.query(
        "UPDATE users SET password = $1 WHERE email = 'admin@aluplan.com'",
        [hashedPassword]
      );
      console.log('✅ Admin password updated');
    }

    // 3. Check and seed test users
    console.log('👥 Checking test users...');

    const testUsers = [
      {
        email: 'editor@aluplan.com',
        password: 'Editor123!',
        firstName: 'Editor',
        lastName: 'User',
        roleId: 'a1b2c3d4-e5f6-4789-abcd-000000000002', // editor
      },
      {
        email: 'customer@aluplan.com',
        password: 'Customer123!',
        firstName: 'Customer',
        lastName: 'User',
        roleId: 'a1b2c3d4-e5f6-4789-abcd-000000000003', // customer
      },
      {
        email: 'support@aluplan.com',
        password: 'Support123!',
        firstName: 'Support',
        lastName: 'User',
        roleId: 'a1b2c3d4-e5f6-4789-abcd-000000000004', // support
      },
      {
        email: 'viewer@aluplan.com',
        password: 'Viewer123!',
        firstName: 'Viewer',
        lastName: 'User',
        roleId: 'a1b2c3d4-e5f6-4789-abcd-000000000005', // viewer
      },
    ];

    for (const user of testUsers) {
      const exists = await queryRunner.query(
        'SELECT * FROM users WHERE email = $1',
        [user.email]
      );

      if (exists.length === 0) {
        const hashedPassword = await bcrypt.hash(user.password, 10);
        await queryRunner.query(`
          INSERT INTO users (
            id, 
            email, 
            password, 
            "firstName", 
            "lastName", 
            "roleId", 
            "isActive", 
            "emailVerified", 
            "emailVerifiedAt",
            created_at, 
            updated_at
          ) VALUES (
            gen_random_uuid(),
            $1,
            $2,
            $3,
            $4,
            $5,
            true,
            true,
            NOW(),
            NOW(),
            NOW()
          )
        `, [user.email, hashedPassword, user.firstName, user.lastName, user.roleId]);
        console.log(`   ✅ Created ${user.email}`);
      } else {
        console.log(`   ℹ️  ${user.email} already exists`);
      }
    }

    await queryRunner.release();
    await AppDataSource.destroy();

    console.log('\n🎉 Seeding completed successfully!\n');
    console.log('Test Accounts:');
    console.log('─────────────────────────────────────');
    console.log('Admin:    admin@aluplan.com / Admin123!');
    console.log('Editor:   editor@aluplan.com / Editor123!');
    console.log('Customer: customer@aluplan.com / Customer123!');
    console.log('Support:  support@aluplan.com / Support123!');
    console.log('Viewer:   viewer@aluplan.com / Viewer123!');
    console.log('─────────────────────────────────────\n');

  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }
}

seedData();
