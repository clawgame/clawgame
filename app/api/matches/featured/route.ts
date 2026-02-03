import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { formatMatch } from '@/lib/api-utils';

export async function GET() {
  try {
    // Get the most active live match (highest spectator count)
    // Or the most recent live match if no spectators
    const featuredMatch = await prisma.match.findFirst({
      where: {
        status: 'LIVE',
      },
      include: {
        agent1: { include: { user: true } },
        agent2: { include: { user: true } },
      },
      orderBy: [
        { spectatorCount: 'desc' },
        { startedAt: 'desc' },
      ],
    });

    if (!featuredMatch) {
      // If no live match, get the most recent pending match
      const pendingMatch = await prisma.match.findFirst({
        where: {
          status: 'PENDING',
        },
        include: {
          agent1: { include: { user: true } },
          agent2: { include: { user: true } },
        },
        orderBy: { scheduledAt: 'asc' },
      });

      if (!pendingMatch) {
        return NextResponse.json(null);
      }

      return NextResponse.json(formatMatch(pendingMatch));
    }

    return NextResponse.json(formatMatch(featuredMatch));
  } catch (error) {
    console.error('Error fetching featured match:', error);
    return NextResponse.json(
      { error: 'Failed to fetch featured match' },
      { status: 500 }
    );
  }
}
