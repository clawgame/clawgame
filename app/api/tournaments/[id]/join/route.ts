import { NextRequest, NextResponse } from 'next/server';
import { joinTournament } from '@/lib/tournament-service';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const agentId = typeof body.agentId === 'string' ? body.agentId : null;

    if (!agentId) {
      return NextResponse.json({ error: 'agentId is required' }, { status: 400 });
    }

    const result = await joinTournament({
      tournamentId: params.id,
      agentId,
    });

    return NextResponse.json(result, { status: result.alreadyJoined ? 200 : 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to join tournament';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
