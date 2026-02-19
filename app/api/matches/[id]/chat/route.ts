import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { MessageType } from '@prisma/client';
import { formatMatchMessage } from '@/lib/api-utils';
import { emitMatchEvent } from '@/lib/engine/ws-emitter';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const messages = await prisma.matchMessage.findMany({
      where: {
        matchId: params.id,
        type: MessageType.MESSAGE,
        senderName: { not: null },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({
      items: messages.map((message) => formatMatchMessage(message)),
    });
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    return NextResponse.json({ error: 'Failed to fetch chat messages' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const walletAddress = typeof body.walletAddress === 'string' ? body.walletAddress : null;
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    const senderName = typeof body.senderName === 'string' && body.senderName.trim()
      ? body.senderName.trim()
      : (walletAddress ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}` : 'Spectator');

    if (!walletAddress || !content) {
      return NextResponse.json({ error: 'walletAddress and content are required' }, { status: 400 });
    }
    if (content.length > 280) {
      return NextResponse.json({ error: 'Chat message cannot exceed 280 characters' }, { status: 400 });
    }

    const [user, match] = await Promise.all([
      prisma.user.upsert({
        where: { walletAddress },
        create: { walletAddress },
        update: {},
        select: { id: true },
      }),
      prisma.match.findUnique({
        where: { id: params.id },
        select: { id: true, round: true },
      }),
    ]);

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    const message = await prisma.matchMessage.create({
      data: {
        matchId: params.id,
        agentId: null,
        senderName,
        round: match.round || 0,
        type: MessageType.MESSAGE,
        content,
      },
    });

    const formatted = formatMatchMessage(message);

    await emitMatchEvent(params.id, 'message', {
      message: {
        ...formatted,
        agentId: `user:${user.id}`,
      },
    });

    return NextResponse.json({ message: formatted }, { status: 201 });
  } catch (error) {
    console.error('Error posting chat message:', error);
    return NextResponse.json({ error: 'Failed to send chat message' }, { status: 500 });
  }
}
