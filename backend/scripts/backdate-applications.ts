import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backdateApplications() {
  try {
    // Get all applications
    const applications = await prisma.creditApplication.findMany({
      orderBy: {
        createdAt: 'asc'
      }
    });

    console.log(`Found ${applications.length} applications`);

    // Backdate them across the last 12 months
    const now = new Date();
    const monthsToSpread = 12;
    const appsPerMonth = Math.ceil(applications.length / monthsToSpread);

    for (let i = 0; i < applications.length; i++) {
      const monthsAgo = Math.floor(i / appsPerMonth);
      const dayInMonth = (i % appsPerMonth) + 1;

      const newDate = new Date(
        now.getFullYear(),
        now.getMonth() - monthsAgo,
        Math.min(dayInMonth, 28) // Keep it safe within month bounds
      );

      await prisma.creditApplication.update({
        where: { id: applications[i].id },
        data: {
          createdAt: newDate,
          updatedAt: newDate
        }
      });

      console.log(`✅ Backdated ${applications[i].applicationNumber} to ${newDate.toISOString().split('T')[0]}`);
    }

    console.log('\n✅ All applications have been backdated!');
  } catch (error) {
    console.error('Error backdating applications:', error);
  } finally {
    await prisma.$disconnect();
  }
}

backdateApplications();
