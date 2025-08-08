import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET() {
  try {
    console.log('Testing Prisma client initialization...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
    
    const ok = await prisma.$queryRaw<{ ok: number }[]>`SELECT 1 AS ok`;
    return NextResponse.json({ status: 'ok', ok: ok?.[0]?.ok ?? null }, { status: 200 });
  } catch (e: any) {
    console.error('Database test error:', e);
    return NextResponse.json(
      { status: 'error', message: e?.message, stack: e?.stack },
      { status: 500 }
    );
  }
} 