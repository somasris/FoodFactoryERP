import { PrismaClient, WarehouseType } from '@prisma/client';
import { env } from '../src/config/env';
import { hashPassword, validatePasswordPolicy } from '../src/utils/password';

const prisma = new PrismaClient();

// Definition of ERP Permissions
const PERMISSIONS = [
  // User Management
  {
    code: 'users.read',
    module: 'users',
    action: 'READ',
    description: 'View user accounts and profiles',
  },
  {
    code: 'users.create',
    module: 'users',
    action: 'CREATE',
    description: 'Provision new user accounts',
  },
  {
    code: 'users.update',
    module: 'users',
    action: 'UPDATE',
    description: 'Update user profiles and details',
  },
  {
    code: 'users.disable',
    module: 'users',
    action: 'UPDATE',
    description: 'Deactivate or reactivate user accounts',
  },
  {
    code: 'users.roles.assign',
    module: 'users',
    action: 'UPDATE',
    description: 'Assign or modify user roles',
  },
  {
    code: 'users.sessions.revoke',
    module: 'users',
    action: 'DELETE',
    description: 'Terminate active user sessions',
  },

  // Customer Management
  {
    code: 'customers.read',
    module: 'customers',
    action: 'READ',
    description: 'View customer accounts and directories',
  },
  {
    code: 'customers.create',
    module: 'customers',
    action: 'CREATE',
    description: 'Register new customers and retailers',
  },
  {
    code: 'customers.update',
    module: 'customers',
    action: 'UPDATE',
    description: 'Update customer contact and tax info',
  },

  // Sales Orders
  {
    code: 'sales.orders.read',
    module: 'sales',
    action: 'READ',
    description: 'View sales orders and order status',
  },
  {
    code: 'sales.orders.create',
    module: 'sales',
    action: 'CREATE',
    description: 'Draft and book sales orders',
  },
  {
    code: 'sales.orders.approve',
    module: 'sales',
    action: 'APPROVE',
    description: 'Authorize and approve sales orders',
  },

  // Inventory Management
  {
    code: 'inventory.read',
    module: 'inventory',
    action: 'READ',
    description: 'View stock balances and inventory transactions',
  },
  {
    code: 'inventory.adjust',
    module: 'inventory',
    action: 'UPDATE',
    description: 'Perform physical stock adjustments',
  },
  {
    code: 'inventory.transfer',
    module: 'inventory',
    action: 'CREATE',
    description: 'Transfer stock between factory warehouses',
  },
  // Phase 1.5 Stage 3 Granular Inventory Permissions
  {
    code: 'inventory.receipt.create',
    module: 'inventory',
    action: 'CREATE',
    description: 'Create and submit inventory receipt documents',
  },
  {
    code: 'inventory.receipt.approve',
    module: 'inventory',
    action: 'APPROVE',
    description: 'Approve submitted inventory receipts',
  },
  {
    code: 'inventory.receipt.post',
    module: 'inventory',
    action: 'POST',
    description: 'Post inventory receipts to stock ledger',
  },
  {
    code: 'inventory.issue.create',
    module: 'inventory',
    action: 'CREATE',
    description: 'Create and submit inventory issue documents',
  },
  {
    code: 'inventory.issue.approve',
    module: 'inventory',
    action: 'APPROVE',
    description: 'Approve submitted inventory issues',
  },
  {
    code: 'inventory.issue.post',
    module: 'inventory',
    action: 'POST',
    description: 'Post inventory issues to stock ledger',
  },
  {
    code: 'inventory.transfer.create',
    module: 'inventory',
    action: 'CREATE',
    description: 'Create warehouse transfer documents',
  },
  {
    code: 'inventory.transfer.approve',
    module: 'inventory',
    action: 'APPROVE',
    description: 'Approve warehouse transfer documents',
  },
  {
    code: 'inventory.transfer.dispatch',
    module: 'inventory',
    action: 'UPDATE',
    description: 'Dispatch approved warehouse transfers from source warehouse',
  },
  {
    code: 'inventory.transfer.receive',
    module: 'inventory',
    action: 'UPDATE',
    description: 'Receive in-transit transfers into destination warehouse',
  },
  {
    code: 'inventory.adjustment.create',
    module: 'inventory',
    action: 'CREATE',
    description: 'Create and submit inventory adjustment documents',
  },
  {
    code: 'inventory.adjustment.approve',
    module: 'inventory',
    action: 'APPROVE',
    description: 'Approve submitted inventory adjustments',
  },
  {
    code: 'inventory.adjustment.post',
    module: 'inventory',
    action: 'POST',
    description: 'Post inventory adjustments to stock ledger',
  },
  {
    code: 'inventory.valuation.read',
    module: 'inventory',
    action: 'READ',
    description: 'View inventory valuation and MWAC cost history',
  },

  // Production Management
  {
    code: 'production.read',
    module: 'production',
    action: 'READ',
    description: 'View BOMs and production runs',
  },
  {
    code: 'production.create',
    module: 'production',
    action: 'CREATE',
    description: 'Schedule and start production runs',
  },
  {
    code: 'production.complete',
    module: 'production',
    action: 'APPROVE',
    description: 'Finish batches and record good output',
  },

  // Procurement Management
  {
    code: 'purchases.read',
    module: 'purchases',
    action: 'READ',
    description: 'View purchase orders and goods receipts',
  },
  {
    code: 'purchases.create',
    module: 'purchases',
    action: 'CREATE',
    description: 'Raise purchase orders for ingredients and pouches',
  },
  {
    code: 'purchases.approve',
    module: 'purchases',
    action: 'APPROVE',
    description: 'Authorize purchase orders and supplier bills',
  },

  // Invoicing & GST
  {
    code: 'invoices.read',
    module: 'invoices',
    action: 'READ',
    description: 'View sales and supplier invoices',
  },
  {
    code: 'invoices.create',
    module: 'invoices',
    action: 'CREATE',
    description: 'Generate GST tax invoices',
  },
  {
    code: 'invoices.post',
    module: 'invoices',
    action: 'POST',
    description: 'Post GST invoices to tax ledgers',
  },

  // Payments & Financials
  {
    code: 'payments.read',
    module: 'payments',
    action: 'READ',
    description: 'View customer receipts and supplier disbursements',
  },
  {
    code: 'payments.record',
    module: 'payments',
    action: 'CREATE',
    description: 'Record payment collections and disbursements',
  },

  // Reports & Auditing
  {
    code: 'reports.read',
    module: 'reports',
    action: 'READ',
    description: 'Access financial, costing, and inventory reports',
  },
  {
    code: 'audit.read',
    module: 'audit',
    action: 'READ',
    description: 'Inspect immutable system security and activity logs',
  },

  // Phase 1.4 Master Data Management
  {
    code: 'master_data.read',
    module: 'master_data',
    action: 'READ',
    description: 'View products, raw materials, units of measure, and tax configurations',
  },
  {
    code: 'master_data.create',
    module: 'master_data',
    action: 'CREATE',
    description: 'Create products, raw materials, units of measure, and tax configurations',
  },
  {
    code: 'master_data.update',
    module: 'master_data',
    action: 'UPDATE',
    description: 'Update or toggle status of master data entities',
  },
  {
    code: 'suppliers.read',
    module: 'suppliers',
    action: 'READ',
    description: 'View supplier directory and addresses',
  },
  {
    code: 'suppliers.create',
    module: 'suppliers',
    action: 'CREATE',
    description: 'Register new supplier accounts',
  },
  {
    code: 'suppliers.update',
    module: 'suppliers',
    action: 'UPDATE',
    description: 'Update supplier details, addresses, and status',
  },
  {
    code: 'warehouses.read',
    module: 'warehouses',
    action: 'READ',
    description: 'View warehouse facilities within authorized scope',
  },
  {
    code: 'warehouses.create',
    module: 'warehouses',
    action: 'CREATE',
    description: 'Create new warehouse facilities',
  },
  {
    code: 'warehouses.update',
    module: 'warehouses',
    action: 'UPDATE',
    description: 'Update warehouse details and status',
  },
  {
    code: 'bom.read',
    module: 'bom',
    action: 'READ',
    description: 'View bills of materials, versions, and overheads',
  },
  {
    code: 'bom.create',
    module: 'bom',
    action: 'CREATE',
    description: 'Create bills of materials and new BOM versions',
  },
  {
    code: 'bom.update',
    module: 'bom',
    action: 'UPDATE',
    description: 'Update draft BOM versions and BOM headers',
  },
  {
    code: 'bom.approve',
    module: 'bom',
    action: 'APPROVE',
    description: 'Activate or obsolete BOM versions',
  },
];

// Five Core ERP Roles
const ROLES = [
  {
    code: 'OWNER',
    name: 'Business Owner',
    description: 'Enterprise owner with unrestricted administrative and operational authority',
  },
  {
    code: 'ADMIN',
    name: 'System Administrator',
    description: 'System operations manager managing users, configurations, and core workflows',
  },
  {
    code: 'PRODUCTION',
    name: 'Production Incharge',
    description: 'Plant supervisor overseeing batch execution, recipes, and warehouse transfers',
  },
  {
    code: 'SALESMAN',
    name: 'Field Sales Representative',
    description: 'Sales representative handling retailer accounts and order booking',
  },
  {
    code: 'AUDITOR',
    name: 'Compliance Auditor',
    description: 'Independent auditor with strictly enforced read-only access to records and logs',
  },
];

// Mappings of Permissions per Role
const ROLE_PERMISSIONS_MAP: Record<string, string[]> = {
  OWNER: PERMISSIONS.map(p => p.code), // Universal permissions
  ADMIN: [
    'users.read',
    'users.create',
    'users.update',
    'users.disable',
    'users.roles.assign',
    'users.sessions.revoke',
    'customers.read',
    'customers.create',
    'customers.update',
    'sales.orders.read',
    'sales.orders.create',
    'sales.orders.approve',
    'inventory.read',
    'inventory.adjust',
    'inventory.transfer',
    'inventory.receipt.create',
    'inventory.receipt.approve',
    'inventory.receipt.post',
    'inventory.issue.create',
    'inventory.issue.approve',
    'inventory.issue.post',
    'inventory.transfer.create',
    'inventory.transfer.approve',
    'inventory.transfer.dispatch',
    'inventory.transfer.receive',
    'inventory.adjustment.create',
    'inventory.adjustment.approve',
    'inventory.adjustment.post',
    'inventory.valuation.read',
    'production.read',
    'production.create',
    'production.complete',
    'purchases.read',
    'purchases.create',
    'purchases.approve',
    'invoices.read',
    'invoices.create',
    'invoices.post',
    'payments.read',
    'payments.record',
    'reports.read',
    'audit.read',
    'master_data.read',
    'master_data.create',
    'master_data.update',
    'suppliers.read',
    'suppliers.create',
    'suppliers.update',
    'warehouses.read',
    'warehouses.create',
    'warehouses.update',
    'bom.read',
    'bom.create',
    'bom.update',
    'bom.approve',
  ],
  PRODUCTION: [
    'production.read',
    'production.create',
    'production.complete',
    'inventory.read',
    'inventory.transfer',
    'inventory.transfer.create',
    'inventory.transfer.dispatch',
    'inventory.transfer.receive',
    'master_data.read',
    'warehouses.read',
    'bom.read',
    'bom.create',
    'bom.update',
  ],
  SALESMAN: [
    'customers.read',
    'customers.create',
    'customers.update',
    'sales.orders.read',
    'sales.orders.create',
    'inventory.read',
    'master_data.read',
    'warehouses.read',
  ],
  AUDITOR: [
    // Strictly read-only
    'users.read',
    'customers.read',
    'sales.orders.read',
    'inventory.read',
    'inventory.valuation.read',
    'production.read',
    'purchases.read',
    'invoices.read',
    'payments.read',
    'reports.read',
    'audit.read',
    'master_data.read',
    'suppliers.read',
    'warehouses.read',
    'bom.read',
  ],
};

async function main() {
  console.info('🌱 Starting Phase 1.3 Foundation & Security Seeder...');

  // 1. Maintain System Configurations
  await prisma.systemConfig.upsert({
    where: { key: 'SYSTEM_STATUS' },
    update: { value: 'INITIALIZED' },
    create: {
      key: 'SYSTEM_STATUS',
      value: 'INITIALIZED',
      description: 'System initialization status for FoodFactory ERP Foundation',
    },
  });

  await prisma.systemConfig.upsert({
    where: { key: 'FOUNDATION_PHASE' },
    update: { value: 'PHASE_1.3' },
    create: {
      key: 'FOUNDATION_PHASE',
      value: 'PHASE_1.3',
      description: 'Current foundation milestone for NIT Tiruchirappalli internship project',
    },
  });

  // 2. Seed Base Organization & Benchmark Facilities
  console.info('  -> Seeding benchmark enterprise organization...');
  const company = await prisma.company.upsert({
    where: { code: 'COMP-01' },
    update: {},
    create: {
      code: 'COMP-01',
      legalName: 'South Indian Food Works Pvt Ltd',
      tradeName: 'FoodFactory South India',
      gstin: '33AAACF1234M1Z5',
      pan: 'AAACF1234M',
      state: 'Tamil Nadu',
      stateCode: '33',
      email: 'contact@southindianfoodworks.com',
      phone: '+91 431 2500000',
      address: 'Industrial Estate, Thuvakudi, Tiruchirappalli, Tamil Nadu 620015',
    },
  });

  const factory = await prisma.factory.upsert({
    where: { code: 'FAC-TRICHY-01' },
    update: {},
    create: {
      companyId: company.id,
      code: 'FAC-TRICHY-01',
      name: 'Trichy Packaged Foods Plant',
      state: 'Tamil Nadu',
      stateCode: '33',
      address: 'Plot 42, Thuvakudi Industrial Complex, NIT Post, Tiruchirappalli',
    },
  });

  const whRM = await prisma.warehouse.upsert({
    where: { code: 'WH-RM-01' },
    update: {},
    create: {
      factoryId: factory.id,
      code: 'WH-RM-01',
      name: 'Main Raw Material Warehouse',
      warehouseType: WarehouseType.RAW_MATERIAL,
      address: 'Bay A, Trichy Plant',
    },
  });

  const whPKG = await prisma.warehouse.upsert({
    where: { code: 'WH-PKG-01' },
    update: {},
    create: {
      factoryId: factory.id,
      code: 'WH-PKG-01',
      name: 'Packaging Materials Warehouse',
      warehouseType: WarehouseType.PACKAGING,
      address: 'Bay B, Trichy Plant',
    },
  });

  const whFG = await prisma.warehouse.upsert({
    where: { code: 'WH-FG-01' },
    update: {},
    create: {
      factoryId: factory.id,
      code: 'WH-FG-01',
      name: 'Finished Goods Warehouse',
      warehouseType: WarehouseType.FINISHED_GOODS,
      address: 'Dispatch Bay C, Trichy Plant',
    },
  });

  // 3. Seed Permissions
  console.info(`  -> Seeding ${PERMISSIONS.length} granular permissions...`);
  const permissionRecordMap = new Map<string, string>();
  for (const perm of PERMISSIONS) {
    const record = await prisma.permission.upsert({
      where: { code: perm.code },
      update: {
        module: perm.module,
        action: perm.action,
        description: perm.description,
      },
      create: {
        code: perm.code,
        module: perm.module,
        action: perm.action,
        description: perm.description,
      },
    });
    permissionRecordMap.set(perm.code, record.id);
  }

  // 4. Seed Five Roles
  console.info(`  -> Seeding 5 core roles...`);
  const roleRecordMap = new Map<string, string>();
  for (const role of ROLES) {
    const record = await prisma.role.upsert({
      where: { code: role.code },
      update: {
        name: role.name,
        description: role.description,
      },
      create: {
        code: role.code,
        name: role.name,
        description: role.description,
      },
    });
    roleRecordMap.set(role.code, record.id);
  }

  // 5. Seed Role-Permission Mappings
  console.info('  -> Seeding role-permission mappings...');
  for (const [roleCode, permCodes] of Object.entries(ROLE_PERMISSIONS_MAP)) {
    const roleId = roleRecordMap.get(roleCode);
    if (!roleId) continue;

    for (const permCode of permCodes) {
      const permissionId = permissionRecordMap.get(permCode);
      if (!permissionId) continue;

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId,
            permissionId,
          },
        },
        update: {},
        create: {
          roleId,
          permissionId,
        },
      });
    }
  }

  // 6. Seed Initial OWNER Account if configured via Environment Variables
  const ownerEmail = env.INITIAL_OWNER_EMAIL;
  const ownerPassword = env.INITIAL_OWNER_PASSWORD;
  const ownerUsername = env.INITIAL_OWNER_USERNAME || 'owner';
  const ownerFullName = env.INITIAL_OWNER_FULLNAME || 'Managing Director';

  if (ownerEmail && ownerPassword) {
    console.info(`  -> Provisioning initial OWNER account (${ownerEmail})...`);
    const policyResult = validatePasswordPolicy(ownerPassword);
    if (!policyResult.isValid) {
      throw new Error(`Initial OWNER password policy failure: ${policyResult.reason}`);
    }

    const passwordHash = await hashPassword(ownerPassword);
    const ownerRole = await prisma.role.findUnique({ where: { code: 'OWNER' } });

    if (!ownerRole) {
      throw new Error('OWNER role not found during initial owner provisioning');
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: ownerEmail }, { username: ownerUsername }],
      },
    });

    let ownerUserId = existingUser?.id;

    if (!existingUser) {
      const user = await prisma.user.create({
        data: {
          companyId: company.id,
          email: ownerEmail.toLowerCase(),
          username: ownerUsername.toLowerCase(),
          passwordHash,
          fullName: ownerFullName,
          isActive: true,
          userRoles: {
            create: {
              roleId: ownerRole.id,
            },
          },
        },
      });
      ownerUserId = user.id;
      console.info(`  ✅ Initial OWNER account created successfully: ${ownerEmail}`);
    } else {
      // Ensure user has OWNER role
      await prisma.userRole.upsert({
        where: {
          userId_roleId: {
            userId: existingUser.id,
            roleId: ownerRole.id,
          },
        },
        update: {},
        create: {
          userId: existingUser.id,
          roleId: ownerRole.id,
        },
      });
      console.info(`  ℹ️ Existing user ${ownerEmail} verified with OWNER role.`);
    }

    // Grant access to all warehouses
    if (ownerUserId) {
      for (const wh of [whRM, whPKG, whFG]) {
        await prisma.userWarehouseAccess.upsert({
          where: {
            userId_warehouseId: {
              userId: ownerUserId,
              warehouseId: wh.id,
            },
          },
          update: { accessLevel: 'READ_WRITE' },
          create: {
            userId: ownerUserId,
            warehouseId: wh.id,
            accessLevel: 'READ_WRITE',
          },
        });
      }
    }
  } else {
    console.info(
      '  ℹ️ INITIAL_OWNER_EMAIL and INITIAL_OWNER_PASSWORD not set. Skipping owner user creation.',
    );
  }

  console.info('✅ Phase 1.3 database seed completed successfully!');

  // 6. Seed Baseline Master Data (Units of Measure & Standard GST Tax Rates)
  const defaultUoms = [
    { code: 'KG', name: 'Kilogram', symbol: 'kg', category: 'WEIGHT', isBaseUnit: true, decimalPlaces: 3 },
    { code: 'G', name: 'Gram', symbol: 'g', category: 'WEIGHT', isBaseUnit: false, decimalPlaces: 2 },
    { code: 'L', name: 'Litre', symbol: 'L', category: 'VOLUME', isBaseUnit: true, decimalPlaces: 3 },
    { code: 'ML', name: 'Millilitre', symbol: 'mL', category: 'VOLUME', isBaseUnit: false, decimalPlaces: 2 },
    { code: 'PCS', name: 'Pieces', symbol: 'pcs', category: 'COUNT', isBaseUnit: true, decimalPlaces: 0 },
    { code: 'BOX', name: 'Box', symbol: 'box', category: 'COUNT', isBaseUnit: false, decimalPlaces: 0 },
  ];

  for (const uom of defaultUoms) {
    await prisma.unitOfMeasure.upsert({
      where: { code: uom.code },
      update: {},
      create: uom,
    });
  }

  const defaultTaxRates = [
    {
      code: 'GST_0',
      name: 'GST 0% (Exempt)',
      ratePercentage: '0.00',
      cgstPercentage: '0.00',
      sgstPercentage: '0.00',
      igstPercentage: '0.00',
    },
    {
      code: 'GST_5',
      name: 'GST 5%',
      ratePercentage: '5.00',
      cgstPercentage: '2.50',
      sgstPercentage: '2.50',
      igstPercentage: '5.00',
    },
    {
      code: 'GST_12',
      name: 'GST 12%',
      ratePercentage: '12.00',
      cgstPercentage: '6.00',
      sgstPercentage: '6.00',
      igstPercentage: '12.00',
    },
    {
      code: 'GST_18',
      name: 'GST 18%',
      ratePercentage: '18.00',
      cgstPercentage: '9.00',
      sgstPercentage: '9.00',
      igstPercentage: '18.00',
    },
  ];

  for (const tax of defaultTaxRates) {
    await prisma.taxRate.upsert({
      where: { code: tax.code },
      update: {},
      create: tax,
    });
  }

  console.info('✅ Phase 1.4 baseline master data seed completed successfully!');
}

main()
  .catch(e => {
    console.error('❌ Error during database seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
