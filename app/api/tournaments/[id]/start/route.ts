import { NextRequest, NextResponse } from 'next/server';
import { startTournament } from '@/lib/tournament-service';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await startTournament(params.id);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start tournament';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
