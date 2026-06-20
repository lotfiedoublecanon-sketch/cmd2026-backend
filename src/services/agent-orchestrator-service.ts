// ============================================
// Internal AI Agent Orchestrator
// ============================================
import { geminiService } from './gemini-service';
import { mergeService } from './merge-service';
import {
  GeminiAgentType,
  MatchEvent,
  MatchLineups,
  MatchStats,
  NormalizedMatch,
  StandingEntry,
} from '../types';
import { getEnabledSources } from '../config/open-sources';

type SourceName = 'fapi' | 'sportdb' | 'merged' | 'cache' | 'backend' | 'media_sources';

export interface AgentRunInput {
  agent?: string;
  message?: string;
  matchContext?: string;
  matchId?: string;
  event?: string;
  topic?: string;
  teamName?: string;
  playerName?: string;
  occasion?: string;
}

interface AgentDefinition {
  name: string;
  aliases: string[];
  geminiAgent: GeminiAgentType;
  mission: string;
  defaultMessage: (input: AgentRunInput) => string;
}

interface CollectedContext {
  text: string;
  sources: SourceName[];
  counts: Record<string, number>;
}

export interface AgentRunResult {
  agent: string;
  geminiAgent: GeminiAgentType;
  content: string;
  matchId?: string;
  timestamp: string;
  sources: SourceName[];
  contextCounts: Record<string, number>;
  geminiAvailable: boolean;
  reliability: 'source-backed' | 'unconfirmed';
}

const SERVICE_UNAVAILABLE_TEXT = 'Service IA temporairement indisponible';

function normalizeAgentName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function compactMatch(match: NormalizedMatch): Record<string, unknown> {
  return {
    id: match.id,
    source: match.source,
    teams: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
    score: `${match.homeScore}-${match.awayScore}`,
    status: match.status,
    minute: match.minute,
    startDateTimeUtc: match.startDateTimeUtc,
    stage: match.stage,
    group: match.group,
    venue: match.venue,
  };
}

function compactEvent(event: MatchEvent): Record<string, unknown> {
  return {
    type: event.type,
    minute: event.minute,
    team: event.team,
    playerName: event.playerName,
    description: event.description,
  };
}

function compactStats(stats: MatchStats | null): Record<string, unknown> | null {
  if (!stats) return null;
  return {
    matchId: stats.matchId,
    stats: stats.stats.slice(0, 18),
  };
}

function compactLineups(lineups: MatchLineups | null): Record<string, unknown> | null {
  if (!lineups) return null;
  return {
    matchId: lineups.matchId,
    homeFormation: lineups.homeFormation,
    awayFormation: lineups.awayFormation,
    homePlayers: lineups.homePlayers.slice(0, 14),
    awayPlayers: lineups.awayPlayers.slice(0, 14),
  };
}

function compactStanding(entry: StandingEntry): Record<string, unknown> {
  return {
    position: entry.position,
    team: entry.team.name,
    group: entry.group,
    played: entry.played,
    points: entry.points,
    goalDifference: entry.goalDifference,
    form: entry.form,
  };
}

function stringifyLimited(value: unknown, limit = 7000): string {
  const text = JSON.stringify(value, null, 2);
  return text.length > limit ? `${text.slice(0, limit)}\n...` : text;
}

function buildSourceFallback(definition: AgentDefinition, context: CollectedContext): string {
  const lines = [
    `${definition.name}: Gemini est temporairement indisponible, mais l agent a bien interroge les sources serveur.`,
    `Sources consultees: ${context.sources.join(', ') || 'backend'}.`,
    `Matchs live: ${context.counts.live ?? 0}.`,
    `Matchs aujourd hui: ${context.counts.today ?? 0}.`,
    `Matchs a venir: ${context.counts.upcoming ?? 0}.`,
    `Classements: ${context.counts.standings ?? 0}.`,
  ];

  if (context.counts.events !== undefined) lines.push(`Evenements match: ${context.counts.events}.`);
  if (context.counts.stats !== undefined) lines.push(`Stats match: ${context.counts.stats}.`);
  if (context.counts.lineups !== undefined) lines.push(`Joueurs compo: ${context.counts.lineups}.`);
  if (context.counts.mediaSources !== undefined) lines.push(`Sources medias publiques activees: ${context.counts.mediaSources}.`);

  lines.push('Des que la cle Gemini Render est valide, cet agent generera une analyse complete avec ce contexte.');
  return lines.join('\n');
}

const AGENTS: AgentDefinition[] = [
  {
    name: 'GeminiOrchestrator',
    aliases: ['geminiorchestrator', 'orchestrator', 'orchestrateur'],
    geminiAgent: 'journalist',
    mission: 'Coordonner les donnees sport, medias, fiabilite et notifications pour donner une reponse claire.',
    defaultMessage: (input) => input.message || 'Resume la situation generale CDM 2026 avec les informations disponibles.',
  },
  {
    name: 'Commentateur',
    aliases: ['commentateur', 'commentaryagent', 'commentator'],
    geminiAgent: 'commentator',
    mission: 'Transformer les actions et scores en commentaire direct vivant, sans inventer de score.',
    defaultMessage: (input) => input.message || `Commente cette action: ${input.event || 'mise a jour du match'}.`,
  },
  {
    name: 'Analyste',
    aliases: ['analyste', 'analysisagent', 'analyst'],
    geminiAgent: 'analyst',
    mission: 'Analyser tactiquement les matchs avec les donnees disponibles.',
    defaultMessage: (input) => input.message || 'Analyse tactiquement la situation avec les donnees disponibles.',
  },
  {
    name: 'Pronostiqueur',
    aliases: ['pronostiqueur', 'predictionagent', 'predictor'],
    geminiAgent: 'predictor',
    mission: 'Produire un pronostic prudent, chiffre, base sur les donnees et la fiabilite des sources.',
    defaultMessage: (input) => input.message || 'Donne un pronostic prudent et explique les limites des donnees.',
  },
  {
    name: 'Journaliste',
    aliases: ['journaliste', 'journalist'],
    geminiAgent: 'journalist',
    mission: 'Rediger des contenus courts, fiables et lisibles pour actualites, resumes et medias.',
    defaultMessage: (input) => input.message || `Redige un article court sur: ${input.topic || 'CDM 2026'}.`,
  },
  {
    name: 'ScoreAgent',
    aliases: ['scoreagent', 'score'],
    geminiAgent: 'commentator',
    mission: 'Surveiller les scores live, matchs du jour et prochains matchs.',
    defaultMessage: (input) => input.message || 'Explique les scores et matchs disponibles, sans inventer de rencontre.',
  },
  {
    name: 'CardAgent',
    aliases: ['cardagent', 'cards', 'cartons'],
    geminiAgent: 'analyst',
    mission: 'Surveiller cartons, discipline et evenements importants du match.',
    defaultMessage: (input) => input.message || 'Analyse les cartons et evenements disciplinaires disponibles.',
  },
  {
    name: 'InjuryAgent',
    aliases: ['injuryagent', 'injuries', 'blessures'],
    geminiAgent: 'journalist',
    mission: 'Chercher et resumer les informations blessures avec prudence.',
    defaultMessage: (input) => input.message || `Prepare un point blessures pour ${input.teamName || 'les equipes concernees'}.`,
  },
  {
    name: 'InterviewAgent',
    aliases: ['interviewagent', 'interviews'],
    geminiAgent: 'journalist',
    mission: 'Generer ou resumer du contenu interview en indiquant clairement ce qui est officiel ou fictif.',
    defaultMessage: (input) => input.message || `Prepare une interview autour de ${input.playerName || 'un joueur cle'} ${input.occasion || ''}.`,
  },
  {
    name: 'TrainingAgent',
    aliases: ['trainingagent', 'training', 'entrainements'],
    geminiAgent: 'journalist',
    mission: 'Chercher et resumer les informations entrainement et preparation des equipes.',
    defaultMessage: (input) => input.message || `Prepare un point entrainement pour ${input.teamName || 'les equipes concernees'}.`,
  },
  {
    name: 'MediaAgent',
    aliases: ['mediaagent', 'media', 'medias', 'videos', 'news'],
    geminiAgent: 'journalist',
    mission: 'Resumer actualites, medias et videos avec les sources serveur disponibles.',
    defaultMessage: (input) => input.message || `Prepare un point medias sur ${input.topic || 'la CDM 2026'}.`,
  },
  {
    name: 'TrustAgent',
    aliases: ['trustagent', 'trust', 'fiabilite', 'reliability'],
    geminiAgent: 'analyst',
    mission: 'Evaluer la fiabilite des donnees entre FAPI/TheStatsAPI, SportDB/Flashscore et IA.',
    defaultMessage: (input) => input.message || 'Evalue la fiabilite des donnees et signale les manques.',
  },
  {
    name: 'NotificationAgent',
    aliases: ['notificationagent', 'notifications', 'fcm'],
    geminiAgent: 'journalist',
    mission: 'Preparer des textes courts et utiles pour notifications intelligentes.',
    defaultMessage: (input) => input.message || 'Propose une notification courte basee sur les donnees disponibles.',
  },
];

class AgentOrchestratorService {
  private aliasMap = new Map<string, AgentDefinition>();

  constructor() {
    for (const agent of AGENTS) {
      this.aliasMap.set(normalizeAgentName(agent.name), agent);
      for (const alias of agent.aliases) this.aliasMap.set(normalizeAgentName(alias), agent);
    }
  }

  listAgents(): Array<{ name: string; geminiAgent: GeminiAgentType; mission: string }> {
    return AGENTS.map(({ name, geminiAgent, mission }) => ({ name, geminiAgent, mission }));
  }

  resolveAgent(agentName: string): AgentDefinition | null {
    return this.aliasMap.get(normalizeAgentName(agentName)) || null;
  }

  async runAgent(agentName: string, input: AgentRunInput = {}): Promise<AgentRunResult> {
    const definition = this.resolveAgent(agentName);
    if (!definition) {
      throw new Error(`Unknown agent: ${agentName}`);
    }

    const context = await this.collectContext({ ...input, agent: definition.name });
    const message = [
      `Agent interne: ${definition.name}`,
      `Mission: ${definition.mission}`,
      'Utilise les donnees serveur ci-dessous en priorite: FAPI/TheStatsAPI, puis SportDB/Flashscore.',
      'Ne donne jamais de cle API. Ne dis pas que tu as appele une source si elle est vide.',
      'Si les donnees source sont vides, dis-le clairement et propose seulement une analyse prudente.',
      '',
      definition.defaultMessage(input),
    ].join('\n');

    const gemini = await geminiService.chat(
      definition.geminiAgent,
      message,
      `${input.matchContext ? `Contexte fourni par l'app:\n${input.matchContext}\n\n` : ''}${context.text}`,
      input.matchId
    );

    const geminiAvailable = !gemini.content.includes(SERVICE_UNAVAILABLE_TEXT);
    const content = geminiAvailable ? gemini.content : buildSourceFallback(definition, context);
    return {
      agent: definition.name,
      geminiAgent: definition.geminiAgent,
      content,
      matchId: input.matchId,
      timestamp: gemini.timestamp,
      sources: context.sources,
      contextCounts: context.counts,
      geminiAvailable,
      reliability: geminiAvailable && context.sources.length > 0 ? 'source-backed' : 'unconfirmed',
    };
  }

  async runAll(input: AgentRunInput = {}): Promise<AgentRunResult[]> {
    const names = AGENTS.map((agent) => agent.name);
    const results: AgentRunResult[] = [];
    for (const name of names) {
      results.push(await this.runAgent(name, input));
    }
    return results;
  }

  private async collectContext(input: AgentRunInput): Promise<CollectedContext> {
    const sources = new Set<SourceName>();
    const counts: Record<string, number> = {};
    const blocks: Array<Record<string, unknown>> = [];

    const addSource = (source?: string) => {
      if (source === 'fapi' || source === 'sportdb' || source === 'merged' || source === 'cache' || source === 'media_sources') {
        sources.add(source);
      }
    };

    if (input.agent === 'MediaAgent') {
      const mediaSources = getEnabledSources();
      addSource('media_sources');
      counts.mediaSources = mediaSources.length;
      blocks.push({
        mediaSources: mediaSources.map((source) => ({
          id: source.id,
          name: source.name,
          type: source.type,
          homepage: source.homepage,
          categories: source.categories,
        })),
        source: 'media_sources',
      });
    }

    if (input.matchId) {
      const [match, events, stats, lineups] = await Promise.allSettled([
        mergeService.getMatchById(input.matchId),
        mergeService.getMatchEvents(input.matchId),
        mergeService.getMatchStats(input.matchId),
        mergeService.getMatchLineups(input.matchId),
      ]);

      if (match.status === 'fulfilled') {
        addSource(match.value.source);
        counts.match = match.value.data ? 1 : 0;
        blocks.push({ match: match.value.data ? compactMatch(match.value.data) : null, source: match.value.source });
      }
      if (events.status === 'fulfilled') {
        addSource(events.value.source);
        counts.events = events.value.data.length;
        blocks.push({ events: events.value.data.slice(0, 20).map(compactEvent), source: events.value.source });
      }
      if (stats.status === 'fulfilled') {
        addSource(stats.value.source);
        counts.stats = stats.value.data ? stats.value.data.stats.length : 0;
        blocks.push({ stats: compactStats(stats.value.data), source: stats.value.source });
      }
      if (lineups.status === 'fulfilled') {
        addSource(lineups.value.source);
        counts.lineups = lineups.value.data ? lineups.value.data.homePlayers.length + lineups.value.data.awayPlayers.length : 0;
        blocks.push({ lineups: compactLineups(lineups.value.data), source: lineups.value.source });
      }
    }

    const [live, today, upcoming, standings] = await Promise.allSettled([
      mergeService.getLiveMatches(),
      mergeService.getTodayMatches(),
      mergeService.getUpcomingMatches(30),
      mergeService.getStandings(),
    ]);

    if (live.status === 'fulfilled') {
      addSource(live.value.source);
      counts.live = live.value.data.length;
      blocks.push({ live: live.value.data.slice(0, 8).map(compactMatch), source: live.value.source });
    }
    if (today.status === 'fulfilled') {
      addSource(today.value.source);
      counts.today = today.value.data.length;
      blocks.push({ today: today.value.data.slice(0, 12).map(compactMatch), source: today.value.source });
    }
    if (upcoming.status === 'fulfilled') {
      addSource(upcoming.value.source);
      counts.upcoming = upcoming.value.data.length;
      blocks.push({ upcoming: upcoming.value.data.slice(0, 20).map(compactMatch), source: upcoming.value.source });
    }
    if (standings.status === 'fulfilled') {
      addSource(standings.value.source);
      counts.standings = standings.value.data.length;
      blocks.push({ standings: standings.value.data.slice(0, 48).map(compactStanding), source: standings.value.source });
    }

    if (sources.size === 0) sources.add('backend');

    return {
      text: stringifyLimited({
        generatedAt: new Date().toISOString(),
        agent: input.agent,
        matchId: input.matchId,
        topic: input.topic,
        teamName: input.teamName,
        sources: Array.from(sources),
        counts,
        blocks,
      }),
      sources: Array.from(sources),
      counts,
    };
  }
}

export const agentOrchestrator = new AgentOrchestratorService();
export default AgentOrchestratorService;
