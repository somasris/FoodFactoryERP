import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.info('🌱 Seeding initial system configuration...');

  await prisma.systemConfig.upsert({
    where: { key: 'SYSTEM_STATUS' },
    update: {
      value: 'INITIALIZED',
      description: 'System initialization status for FoodFactory ERP Foundation',
    },
    create: {
      key: 'SYSTEM_STATUS',
      value: 'INITIALIZED',
      description: 'System initialization status for FoodFactory ERP Foundation',
    },
  });

  await prisma.systemConfig.upsert({
    where: { key: 'FOUNDATION_PHASE' },
    update: {
      value: 'PHASE_1.1',
      description: 'Current foundation milestone for NIT Tiruchirappalli internship project',
    },
    create: {
      key: 'FOUNDATION_PHASE',
      value: 'PHASE_1.1',
      description: 'Current foundation milestone for NIT Tiruchirappalli internship project',
    },
  });

  console.info('✅ Foundation seed completed successfully.');
}

main()
  .catch(e => {
    console.error('❌ Error during database seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
