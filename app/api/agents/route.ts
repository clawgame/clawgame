import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { formatAgent } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search');

    // Build where clause
    const where = search
      ? {
          name: {
            contains: search,
            mode: 'insensitive' as const,
          },
        }
      : {};

    // Get agents with user
    const [agents, total] = await Promise.all([
      prisma.agent.findMany({
        where,
        include: { user: true },
        orderBy: { rating: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.agent.count({ where }),
    ]);

    // Format response
    const formattedAgents = agents.map(formatAgent);

    return NextResponse.json({
      items: formattedAgents,
      total,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      hasMore: offset + limit < total,
    });
  } catch (error) {
    console.error('Error fetching agents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agents' },
      { status: 500 }
    );
  }
}
