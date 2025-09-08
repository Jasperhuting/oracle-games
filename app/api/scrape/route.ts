import { NextRequest } from 'next/server';
import { getRiders, getStageResult, KNOWN_RACE_SLUGS, type RaceSlug } from '@/lib/scraper';

const AVAILABLE_COMMANDS = {
  'getRiders-Tour': { type: 'startlist', race: 'tour-de-france' },
  'getRiders-Giro': { type: 'startlist', race: 'giro-d-italia' },
  'getRiders-Vuelta': { type: 'startlist', race: 'vuelta-a-espana' },
  'getRiders-World': { type: 'startlist', race: 'world-championship' },
  'stage-tour': { type: 'stage', race: 'tour-de-france' },
  'stage-vuelta': { type: 'stage', race: 'vuelta-a-espana' },
} as const;

export async function POST(request: NextRequest) {
  try {
    const { command, stage, year = new Date().getFullYear() } = await request.json();

    if (!AVAILABLE_COMMANDS[command as keyof typeof AVAILABLE_COMMANDS]) {
      return Response.json({ error: 'Invalid command' }, { status: 400 });
    }

    const commandConfig = AVAILABLE_COMMANDS[command as keyof typeof AVAILABLE_COMMANDS];
    
    if (!KNOWN_RACE_SLUGS.includes(commandConfig.race as RaceSlug)) {
      return Response.json({ error: 'Invalid race' }, { status: 400 });
    }

    let result;
    if (commandConfig.type === 'startlist') {
      result = await getRiders({ 
        race: commandConfig.race as RaceSlug, 
        year: Number(year) 
      });
    } else if (commandConfig.type === 'stage') {
      if (!stage) {
        return Response.json({ error: 'Stage number required for stage commands' }, { status: 400 });
      }
      result = await getStageResult({ 
        race: commandConfig.race as RaceSlug, 
        year: Number(year), 
        stage 
      });
    } else {
      return Response.json({ error: 'Invalid command type' }, { status: 400 });
    }
    
    return Response.json({ 
      success: true, 
      command: `${commandConfig.type} ${commandConfig.race}`,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return Response.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({ 
    availableCommands: Object.keys(AVAILABLE_COMMANDS),
    description: 'Use POST to run scraper commands'
  });
}

