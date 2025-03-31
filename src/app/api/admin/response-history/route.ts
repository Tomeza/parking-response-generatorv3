import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where = {
      AND: [
        search ? {
          OR: [
            { query: { contains: search, mode: 'insensitive' } },
            { response: { contains: search, mode: 'insensitive' } }
          ]
        } : {},
        startDate ? { created_at: { gte: new Date(startDate) } } : {},
        endDate ? { created_at: { lte: new Date(endDate) } } : {}
      ]
    };

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