import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { formatMatch, formatMarket, formatMatchMessage } from '@/lib/api-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Get match with all relations
    const match = await prisma.match.findUnique({
      where: { id },
      include: {
        agent1: { include: { user: true } },
        agent2: { include: { user: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        markets: {
          include: { options: true },
        },
      },
    });

    if (!match) {
      return NextResponse.json(
        { error: 'Match not found' },
        { status: 404 }
      );
    }

    // Get agent names for message formatting
    const agentNames: Record<string, string> = {
      [match.agent1.id]: match.agent1.name,
    };
    if (match.agent2) {
      agentNames[match.agent2.id] = match.agent2.name;
    }

    // Format response
    const formattedMatch = formatMatch(match);
    const formattedMessages = match.messages.map((msg) =>
      formatMatchMessage(msg, msg.agentId ? agentNames[msg.agentId] : undefined)
    );
    const formattedMarkets = match.markets.map(formatMarket);

    return NextResponse.json({
      match: formattedMatch,
      messages: formattedMessages,
      markets: formattedMarkets,
    });
  } catch (error) {
    console.error('Error fetching match:', error);
    return NextResponse.json(
      { error: 'Failed to fetch match' },
      { status: 500 }
    );
  }
}
