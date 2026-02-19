import { NextRequest, NextResponse } from 'next/server';
import { syncTournamentRound } from '@/lib/tournament-service';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await syncTournamentRound(params.id);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to sync tournament';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
