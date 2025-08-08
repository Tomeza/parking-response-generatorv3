export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // クエリ条件の構築
    const conditions: Prisma.ResponseLogWhereInput[] = [];
    
    if (search) {
      conditions.push({
        OR: [
          { query: { contains: search } },
          { response: { contains: search } }
        ]
      });
    }
    
    if (startDate) {
      conditions.push({ created_at: { gte: new Date(startDate) } });
    }
    
    if (endDate) {
      conditions.push({ created_at: { lte: new Date(endDate) } });
    }
    
    // 検索条件をANDで結合
    const where: Prisma.ResponseLogWhereInput = conditions.length > 0
      ? { AND: conditions }
      : {};

    const [total, logs] = await Promise.all([
      prisma.responseLog.count({ where }),
      prisma.responseLog.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          knowledge: {
            select: {
              id: true,
              question: true,
              answer: true,
              main_category: true,
              sub_category: true,
              detail_category: true
            }
          }
        }
      })
    ]);

    return NextResponse.json({
      logs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching response history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch response history' },
      { status: 500 }
    );
  }
} 