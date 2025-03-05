import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function isBusyPeriod(date: Date): Promise<boolean> {
  const targetDate = new Date(date);
  
  const busyPeriod = await prisma.busyPeriod.findFirst({
    where: {
      year: targetDate.getFullYear(),
      startDate: {
        lte: targetDate
      },
      endDate: {
        gte: targetDate
      }
    }
  });
  
  return busyPeriod !== null;
}

export async function getNextBusyPeriod(date: Date): Promise<{ startDate: Date; endDate: Date } | null> {
  const targetDate = new Date(date);
  
  const nextBusyPeriod = await prisma.busyPeriod.findFirst({
    where: {
      year: targetDate.getFullYear(),
      startDate: {
        gt: targetDate
      }
    },
    orderBy: {
      startDate: 'asc'
    }
  });
  
  return nextBusyPeriod;
}

export async function getBusyPeriods(year: number): Promise<Array<{ startDate: Date; endDate: Date }>> {
  return prisma.busyPeriod.findMany({
    where: { year },
    orderBy: { startDate: 'asc' },
    select: {
      startDate: true,
      endDate: true
    }
  });
} 