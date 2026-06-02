import { PrismaService } from './prisma/prisma.service';
import 'dotenv/config';

async function run() {
  const prisma = new PrismaService();
  try {
    await prisma.onModuleInit();
    const count = await prisma.user.count();
    console.log('USER COUNT IN DATABASE:', count);
    const users = await prisma.user.findMany({ select: { id: true, email: true } });
    console.log('USERS:', users);
  } catch (err) {
    console.error('Error running script:', err);
  } finally {
    await prisma.onModuleDestroy();
  }
}
run();
