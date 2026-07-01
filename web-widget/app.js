(() => {
  'use strict';

  const RENDER_ORIGIN = 'https://cmd2026-backend-1.onrender.com';
  const isGitHubPages = location.hostname.endsWith('.github.io');
  const apiEndpoint = (path) => isGitHubPages ? `${RENDER_ORIGIN}${path}` : path;

  const VIEWS = {
    live: { endpoint: '/api/widget/live', interval: 15_000, intervalLabel: '15 s', kind: 'matches' },
    today: { endpoint: '/api/widget/today', interval: 60_000, intervalLabel: '60 s', kind: 'matches' },
    upcoming: { endpoint: '/api/widget/upcoming?days=60', interval: 300_000, intervalLabel: '5 min', kind: 'matches' },
    bracket: { endpoint: '/api/widget/bracket', interval: 300_000, intervalLabel: '5 min', kind: 'bracket' },
    groups: { endpoint: '/api/widget/groups', interval: 300_000, intervalLabel: '5 min', kind: 'groups' },
  };

  const STATUS_LABELS = {
    SCHEDULED: 'Programmé', LIVE: 'En direct', HALF_TIME: 'Mi-temps', EXTRA_TIME: 'Prolongation',
    PENALTIES: 'Tirs au but', FINISHED: 'Terminé', POSTPONED: 'Reporté', CANCELLED: 'Annulé',
    DELAYED: 'Retardé', KICKOFF_DELAYED: 'Coup d’envoi retardé', WEATHER_DELAY: 'Retard météo',
    SUSPENDED: 'Suspendu', INTERRUPTED: 'Interrompu', AWAITING_KICKOFF: 'Coup d’envoi en attente',
    UNKNOWN: 'Statut inconnu', AWAITING_LIVE_DATA: 'Données live en attente',
  };
  const LIVE_STATUSES = new Set(['LIVE', 'HALF_TIME', 'EXTRA_TIME', 'PENALTIES']);
  const DELAY_MESSAGES = {
    DELAYED: 'Coup d’envoi retardé. Nouvelle heure à confirmer par la source.',
    KICKOFF_DELAYED: 'Coup d’envoi retardé. Nouvelle heure à confirmer par la source.',
    WEATHER_DELAY: 'Match retardé pour raisons météo. Nouvelle heure à confirmer par la source.',
    SUSPENDED: 'Match suspendu. Reprise à confirmer par la source.',
    INTERRUPTED: 'Match interrompu. Reprise à confirmer par la source.',
    POSTPONED: 'Match reporté. Nouvelle date à confirmer par la source.',
  };
  const COUNTRY_CODES = {
    ALG: 'DZ', ARG: 'AR', AUS: 'AU', AUT: 'AT', BEL: 'BE', BIH: 'BA', BRA: 'BR',
    CAN: 'CA', CIV: 'CI', CMR: 'CM', COD: 'CD', COL: 'CO', CPV: 'CV', CRO: 'HR',
    ECU: 'EC', EGY: 'EG', ENG: 'GB', ESP: 'ES', FRA: 'FR', GER: 'DE', GHA: 'GH',
    IRN: 'IR', IRQ: 'IQ', ITA: 'IT', JPN: 'JP', JOR: 'JO', KOR: 'KR', MAR: 'MA',
    MEX: 'MX', NED: 'NL', NOR: 'NO', NZL: 'NZ', PAN: 'PA', PAR: 'PY', POL: 'PL',
    POR: 'PT', QAT: 'QA', KSA: 'SA', SCO: 'GB', SEN: 'SN', SRB: 'RS', SUI: 'CH',
    SWE: 'SE', TUN: 'TN', TUR: 'TR', UKR: 'UA', URU: 'UY', USA: 'US', UZB: 'UZ',
  };
  const EVENT_LABELS = {
    goal: 'But', own_goal: 'But contre son camp', penalty_goal: 'Penalty', penalty_missed: 'Penalty manqué',
    yellow_card: 'Carton jaune', red_card: 'Carton rouge', second_yellow_card: 'Second carton jaune',
    substitution: 'Remplacement', period_start: 'Reprise', period_end: 'Fin de période', var_decision: 'Décision VAR',
  };
  const STAGE_LABELS = {
    'group-stage': 'Phase de groupes', 'round-of-32': 'Seizièmes de finale',
    'round-of-16': 'Huitièmes de finale', quarterfinals: 'Quarts de finale',
    semifinals: 'Demi-finales', 'third-place': 'Troisième place', final: 'Finale',
  };
  const STAGE_ORDER = ['round-of-32', 'round-of-16', 'quarterfinals', 'semifinals', 'final', 'third-place'];
  const widget = document.querySelector('.widget');
  const widgetBody = document.querySelector('#widget-body');
  const collapseButton = document.querySelector('#collapse-button');
  const refreshButton = document.querySelector('#refresh-button');
  const refreshRate = document.querySelector('#refresh-rate');
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const panel = document.querySelector('#matches-panel');
  const stateMessage = document.querySelector('#state-message');
  const matchesList = document.querySelector('#matches-list');
  const sourceValue = document.querySelector('#source-value');
  const updatedValue = document.querySelector('#updated-value');
  const trackedTeams = document.querySelector('#tracked-teams');
  const poster = {
    root: document.querySelector('#match-poster'),
    kicker: document.querySelector('#poster-kicker'), date: document.querySelector('#poster-date'),
    status: document.querySelector('#poster-status'), venue: document.querySelector('#poster-venue'),
    player: document.querySelector('#poster-player'), playerImage: document.querySelector('#poster-player-image'),
    playerVisual: document.querySelector('#poster-player-visual'),
    delay: document.querySelector('#poster-delay'), delayMessage: document.querySelector('#poster-delay-message'),
    home: {
      flag: document.querySelector('#poster-home-flag'), code: document.querySelector('#poster-home-code'),
      name: document.querySelector('#poster-home-name'), player: document.querySelector('#poster-home-player'),
    },
    away: {
      flag: document.querySelector('#poster-away-flag'), code: document.querySelector('#poster-away-code'),
      name: document.querySelector('#poster-away-name'), player: document.querySelector('#poster-away-player'),
    },
  };

  let activeView = 'live';
  let timerId = null;
  let controller = null;
  let requestId = 0;
  let lastRequestAt = 0;
  let featuredMatch = null;
  const trackedTeamMap = new Map();

  function textValue(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  function firstString(...values) {
    return values.map(textValue).find(Boolean) || null;
  }

  function finiteNumber(...values) {
    for (const value of values) {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
    }
    return null;
  }

  function extractMatches(payload) {
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.matches)) return payload.matches;
    if (Array.isArray(payload?.data?.matches)) return payload.data.matches;
    return [];
  }

  function extractDetailItems(payload, key) {
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.[key])) return payload[key];
    if (Array.isArray(payload?.data?.[key])) return payload.data[key];
    return [];
  }

  function extractMetadata(payload) {
    const nested = payload?.data && !Array.isArray(payload.data) ? payload.data : {};
    return {
      source: firstString(payload?.sourceUsed, payload?.source, nested?.sourceUsed, nested?.source),
      updatedAt: firstString(payload?.lastUpdatedAt, payload?.updatedAt, nested?.lastUpdatedAt, nested?.updatedAt),
    };
  }

  function setMetadata(metadata = {}) {
    sourceValue.textContent = metadata.source || '—';
    updatedValue.replaceChildren();
    if (!metadata.updatedAt) {
      updatedValue.textContent = '—';
      return;
    }
    const date = new Date(metadata.updatedAt);
    if (Number.isNaN(date.getTime())) {
      updatedValue.textContent = metadata.updatedAt;
      return;
    }
    const time = document.createElement('time');
    time.dateTime = date.toISOString();
    time.textContent = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'medium' }).format(date);
    updatedValue.append(time);
  }

  function showState(kind, message) {
    matchesList.hidden = true;
    matchesList.replaceChildren();
    matchesList.className = '';
    stateMessage.hidden = false;
    stateMessage.replaceChildren();
    if (kind === 'loading') {
      const spinner = document.createElement('span');
      spinner.className = 'spinner';
      spinner.setAttribute('aria-hidden', 'true');
      stateMessage.append(spinner);
    }
    const text = document.createElement('p');
    text.textContent = message;
    stateMessage.append(text);
    if (kind === 'error') {
      const retry = document.createElement('button');
      retry.className = 'state__action';
      retry.type = 'button';
      retry.textContent = 'Réessayer';
      retry.addEventListener('click', () => loadActiveView());
      stateMessage.append(retry);
    }
  }

  function showContent(className, ...elements) {
    stateMessage.hidden = true;
    matchesList.className = className;
    matchesList.replaceChildren(...elements);
    matchesList.hidden = false;
  }

  function flagFor(code) {
    const iso = COUNTRY_CODES[String(code || '').toUpperCase()];
    if (!iso) return null;
    return [...iso].map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0))).join('');
  }

  function makeFlag(code) {
    const span = document.createElement('span');
    span.className = 'team-flag';
    const flag = flagFor(code);
    span.textContent = flag || (textValue(code) || '—');
    span.dataset.fallback = String(!flag);
    span.setAttribute('aria-hidden', 'true');
    return span;
  }

  function safeTeamName(value) {
    const name = textValue(value);
    return !name || /^(TBD|Unknown|To be determined)$/i.test(name) ? 'À déterminer' : name;
  }

  function teamData(match, side) {
    const nested = match?.[`${side}Team`] || match?.[side] || {};
    const alternate = side === 'home' ? match?.team1 : match?.team2;
    const raw = nested && typeof nested === 'object' ? nested : alternate && typeof alternate === 'object' ? alternate : {};
    return {
      name: safeTeamName(firstString(match?.[`${side}TeamName`], raw?.name, raw?.teamName, alternate?.name)),
      code: (firstString(match?.[`${side}TeamCode`], raw?.code, raw?.teamCode, raw?.abbreviation, alternate?.code) || 'TBD').toUpperCase(),
      score: finiteNumber(match?.[`${side}Score`], raw?.score, match?.score?.[side]),
      penaltyScore: finiteNumber(match?.[`${side}PenaltyScore`], raw?.penaltyScore, match?.penalties?.[side]),
    };
  }

  function addTrackedTeams(matches) {
    for (const match of matches) {
      for (const side of ['home', 'away']) {
        const team = teamData(match, side);
        if (team.code === 'TBD' || team.name === 'À déterminer') continue;
        trackedTeamMap.set(team.code, { code: team.code, name: team.name });
      }
    }
    renderTrackedTeams();
  }

  function renderTrackedTeams() {
    const teams = [...trackedTeamMap.values()].slice(0, 32);
    if (!teams.length) {
      const empty = document.createElement('span');
      empty.className = 'team-strip__loading';
      empty.textContent = 'Aucune équipe confirmée';
      trackedTeams.replaceChildren(empty);
      return;
    }
    trackedTeams.replaceChildren(...teams.map((team) => {
      const chip = document.createElement('span');
      chip.className = 'team-chip';
      chip.setAttribute('role', 'listitem');
      chip.title = team.name;
      const code = document.createElement('span');
      code.className = 'team-chip__code';
      code.textContent = team.code;
      chip.append(makeFlag(team.code), code);
      return chip;
    }));
  }

  async function loadTrackedTeams() {
    const viewKeys = ['live', 'today', 'upcoming'];
    const results = await Promise.allSettled(viewKeys.map((key) => fetchJson(VIEWS[key].endpoint)));
    for (let index = 0; index < results.length; index += 1) {
      const result = results[index];
      if (result.status !== 'fulfilled') continue;
      const matches = extractMatches(result.value);
      addTrackedTeams(matches);
    }
    if (!trackedTeamMap.size) renderTrackedTeams();
  }

  function matchKickoff(match) {
    return firstString(match?.newKickoff, match?.kickoff, match?.startDateTimeUtc, match?.startTime, match?.scheduledAt, match?.date);
  }

  function matchVenue(match) {
    return firstString(match?.venue, match?.venueName, match?.stadium, match?.location, match?.venue?.name);
  }

  function matchStatus(match) {
    const status = firstString(match?.status, match?.state, match?.liveStatus) || 'UNKNOWN';
    return status.toUpperCase().replace(/[ -]+/g, '_');
  }

  function formatDate(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return textValue(value);
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    }).format(date);
  }

  function formatPosterDate(value) {
    if (!value) return 'Date à confirmer';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return textValue(value) || 'Date à confirmer';
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
    }).format(date);
  }

  function formatTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(date);
  }

  function formatDay(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: '2-digit', month: 'long' }).format(date);
  }

  function stageKey(value) {
    return String(value || '').trim().toLowerCase().replace(/[ _]+/g, '-');
  }

  function stageLabel(value) {
    const stage = textValue(value);
    if (!stage) return 'Coupe du monde 2026';
    return STAGE_LABELS[stageKey(stage)] || stage.replace(/^group\s+/i, 'Groupe ');
  }

  function setPosterTeam(side, team, featured = null, source = {}) {
    const target = poster[side];
    const nestedTeam = source?.[`${side}Team`] || source?.[side] || {};
    const explicitFlag = firstString(
      featured?.teamFlags?.[side], featured?.flags?.[side], source?.[`${side}TeamFlag`],
      nestedTeam?.flag, nestedTeam?.flagEmoji,
    );
    const flag = explicitFlag || flagFor(team.code);
    target.flag.textContent = flag || team.code;
    target.flag.dataset.fallback = String(!flag);
    target.code.textContent = team.code;
    target.name.textContent = team.name;
  }

  function confirmedPlayerName(value) {
    const name = textValue(typeof value === 'object' ? value?.name : value);
    return name && !/^(à|a) confirmer$/i.test(name) ? name : null;
  }

  function featuredPlayer(featured = {}) {
    const candidates = [
      featured?.verifiedPlayer, featured?.featuredPlayer, featured?.playerToWatch,
      featured?.featuredPlayers?.home, featured?.featuredPlayers?.away,
    ];
    const player = candidates.find((candidate) => candidate && typeof candidate === 'object') || null;
    const name = candidates.map(confirmedPlayerName).find(Boolean) || 'à confirmer';
    const verifiedImageUrl = firstString(
      featured?.verifiedPlayerImageUrl, featured?.playerImage?.verifiedUrl,
      player?.verifiedImageUrl,
      (player?.verified === true || player?.imageVerified === true) && firstString(player?.imageUrl, player?.photoUrl, player?.image),
    );
    return { name, imageUrl: verifiedImageUrl };
  }

  function renderPosterPlayer(featured) {
    const player = featuredPlayer(featured);
    poster.player.textContent = player.name;
    poster.playerImage.onload = null;
    poster.playerImage.onerror = null;
    poster.playerImage.hidden = true;
    poster.playerImage.removeAttribute('src');
    poster.playerVisual.dataset.hasImage = 'false';
    if (!player.imageUrl) return;
    poster.playerImage.onload = () => {
      poster.playerImage.hidden = false;
      poster.playerVisual.dataset.hasImage = 'true';
    };
    poster.playerImage.onerror = () => {
      poster.playerImage.hidden = true;
      poster.playerVisual.dataset.hasImage = 'false';
      poster.playerImage.removeAttribute('src');
    };
    poster.playerImage.src = player.imageUrl;
  }

  function renderDelay(match, statusCode) {
    const heading = DELAY_MESSAGES[statusCode];
    if (!heading) {
      poster.delay.hidden = false;
      poster.delay.dataset.active = 'false';
      poster.delayMessage.textContent = 'Aucun retard ou suspension confirmé';
      return;
    }
    const eta = finiteNumber(match?.restartEtaMinutes);
    const newKickoff = firstString(match?.newKickoff);
    const detail = eta !== null
      ? `Reprise estimée dans ${eta} min`
      : newKickoff
        ? `Nouvelle heure : ${formatTime(newKickoff)}`
        : statusCode === 'POSTPONED'
          ? 'Nouvelle date à confirmer'
          : 'Reprise à confirmer';
    poster.delay.hidden = false;
    poster.delay.dataset.active = 'true';
    poster.delayMessage.textContent = `${heading} ${detail}`;
  }

  function renderPoster(match, featured = null) {
    const source = match || {};
    const home = teamData(source, 'home');
    const away = teamData(source, 'away');
    const kickoff = matchKickoff(source);
    const statusCode = matchStatus(source);
    const hasTeams = home.name !== 'À déterminer' || away.name !== 'À déterminer';
    setPosterTeam('home', home, featured, source);
    setPosterTeam('away', away, featured, source);
    poster.root.style.setProperty('--home-color', textValue(featured?.teamColors?.home) || '#c52f45');
    poster.root.style.setProperty('--away-color', textValue(featured?.teamColors?.away) || '#138e9f');
    poster.kicker.textContent = hasTeams ? stageLabel(firstString(source?.stage, source?.round, source?.competitionName)) : 'Affiche à suivre';
    poster.date.textContent = formatPosterDate(kickoff);
    poster.status.textContent = STATUS_LABELS[statusCode] || (statusCode === 'UNKNOWN' ? 'Programme à confirmer' : statusCode);
    poster.venue.textContent = matchVenue(source) || 'Lieu à confirmer';
    const homePlayer = confirmedPlayerName(featured?.featuredPlayers?.home) || 'à confirmer';
    const awayPlayer = confirmedPlayerName(featured?.featuredPlayers?.away) || 'à confirmer';
    poster.home.player.textContent = homePlayer;
    poster.away.player.textContent = awayPlayer;
    renderPosterPlayer(featured);
    renderDelay(source, statusCode);
  }

  async function loadFeaturedPoster() {
    try {
      const payload = await fetchJson('/api/widget/featured');
      featuredMatch = payload?.match && typeof payload.match === 'object' ? payload.match : null;
      if (featuredMatch) addTrackedTeams([featuredMatch]);
      renderPoster(featuredMatch, payload);
    } catch {
      // Match feeds remain the poster fallback while this optional route is unavailable.
    }
  }

  function makeTeam(name, code, side) {
    const team = document.createElement('div');
    team.className = `match__team match__team--${side}`;
    const label = document.createElement('span');
    label.className = 'match__team-name';
    label.textContent = safeTeamName(name);
    if (side === 'away') team.append(label, makeFlag(code));
    else team.append(makeFlag(code), label);
    return team;
  }

  function makeDetailsPanel(match) {
    const panelElement = document.createElement('section');
    panelElement.className = 'match-details';
    panelElement.hidden = true;
    panelElement.setAttribute('aria-live', 'polite');

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'match__details-button';
    button.textContent = 'Voir détails';
    button.setAttribute('aria-expanded', 'false');

    let loaded = false;
    button.addEventListener('click', async () => {
      const opening = panelElement.hidden;
      panelElement.hidden = !opening;
      button.setAttribute('aria-expanded', String(opening));
      button.textContent = opening ? 'Masquer les détails' : 'Voir détails';
      if (!opening || loaded) return;
      loaded = true;
      await loadMatchDetails(match, panelElement, button);
    });
    return { button, panelElement };
  }

  async function fetchJson(path) {
    const response = await fetch(apiEndpoint(path), { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) throw new Error('Données indisponibles');
    return response.json();
  }

  async function loadMatchDetails(match, container, button) {
    container.textContent = 'Chargement des détails...';
    button.disabled = true;
    try {
      const id = encodeURIComponent(String(match.id || ''));
      const [eventsPayload, statsPayload] = await Promise.all([
        fetchJson(`/api/widget/events/${id}`), fetchJson(`/api/widget/stats/${id}`),
      ]);
      const events = extractDetailItems(eventsPayload, 'events');
      const stats = extractDetailItems(statsPayload, 'stats');
      container.replaceChildren();
      if (!events.length && !stats.length) {
        container.textContent = 'Détails non disponibles pour ce match';
        return;
      }
      if (stats.length) container.append(makeStats(stats, match));
      if (events.length) container.append(makeTimeline(events));
    } catch {
      container.textContent = 'Détails non disponibles pour ce match';
    } finally {
      button.disabled = false;
    }
  }

  function makeStats(stats, match) {
    const section = document.createElement('div');
    section.className = 'details__section';
    const heading = document.createElement('h2');
    heading.textContent = 'Statistiques';
    section.append(heading);
    const table = document.createElement('div');
    table.className = 'stats-table';
    const header = document.createElement('div');
    header.className = 'stats-row stats-row--header';
    header.append(cell(teamData(match, 'home').code), cell('Statistique'), cell(teamData(match, 'away').code));
    table.append(header);
    for (const stat of stats) {
      const row = document.createElement('div');
      row.className = 'stats-row';
      row.append(cell(stat.home ?? '—'), cell(stat.name || stat.label || '—'), cell(stat.away ?? '—'));
      table.append(row);
    }
    section.append(table);
    return section;
  }

  function cell(value) {
    const span = document.createElement('span');
    span.textContent = String(value);
    return span;
  }

  function makeTimeline(events) {
    const section = document.createElement('div');
    section.className = 'details__section';
    const heading = document.createElement('h2');
    heading.textContent = 'Timeline';
    section.append(heading);
    const list = document.createElement('ol');
    list.className = 'timeline';
    for (const event of events) {
      const item = document.createElement('li');
      const minute = document.createElement('strong');
      minute.textContent = `${finiteNumber(event.minute) ?? 0}'`;
      const description = document.createElement('span');
      const label = EVENT_LABELS[event.type] || 'Événement';
      description.textContent = `${label}${event.playerName ? ` · ${event.playerName}` : ''}`;
      item.append(minute, description);
      list.append(item);
    }
    section.append(list);
    return section;
  }

  function makeMatchCard(match) {
    const article = document.createElement('article');
    article.className = 'match';
    const statusCode = matchStatus(match);
    const isLive = LIVE_STATUSES.has(statusCode);
    const isUpcoming = activeView === 'upcoming' && statusCode === 'SCHEDULED';
    const kickoff = matchKickoff(match);
    const home = teamData(match, 'home');
    const away = teamData(match, 'away');

    const topline = document.createElement('div');
    topline.className = 'match__topline';
    const competition = document.createElement('span');
    competition.className = 'match__competition';
    competition.textContent = stageLabel(firstString(match?.stage, match?.group, match?.competitionName, match?.competition));
    const date = document.createElement('time');
    date.textContent = isUpcoming ? formatDay(kickoff) : (formatDate(kickoff) || '—');
    topline.append(competition, date);

    const minute = document.createElement('div');
    minute.className = `match__minute${isUpcoming ? ' match__minute--kickoff' : ''}`;
    const matchMinute = finiteNumber(match?.minute);
    minute.dataset.visible = String((isLive && matchMinute !== null) || isUpcoming);
    minute.textContent = isUpcoming ? formatTime(kickoff) : isLive && matchMinute !== null ? `${matchMinute}'` : ' ';

    const scoreline = document.createElement('div');
    scoreline.className = 'match__scoreline';
    const hasScore = home.score !== null && away.score !== null;
    const score = document.createElement('strong');
    score.className = 'match__score';
    score.dataset.available = String(hasScore || isUpcoming);
    score.classList.toggle('match__score--versus', isUpcoming);
    score.textContent = isUpcoming ? 'VS' : hasScore ? `${home.score} : ${away.score}` : '— : —';
    score.setAttribute('aria-label', hasScore ? `${home.name} ${home.score}, ${away.name} ${away.score}` : 'Score non disponible');
    scoreline.append(makeTeam(home.name, home.code, 'home'), score, makeTeam(away.name, away.code, 'away'));

    const state = document.createElement('div');
    state.className = 'match__state';
    state.dataset.live = String(isLive);
    state.textContent = isUpcoming
      ? `${formatDay(kickoff)} · ${stageLabel(match?.stage || match?.group)}`
      : STATUS_LABELS[statusCode] || statusCode;

    article.append(topline, minute, scoreline);
    if (home.penaltyScore !== null && away.penaltyScore !== null) {
      const penalties = document.createElement('p');
      penalties.className = 'match__penalties';
      penalties.textContent = `Tirs au but : ${home.penaltyScore} – ${away.penaltyScore}`;
      article.append(penalties);
    }
    if (textValue(match?.winnerTeamName)) {
      const winner = document.createElement('p');
      winner.className = 'match__winner';
      winner.textContent = `Vainqueur : ${match.winnerTeamName}`;
      article.append(winner);
    }
    if (DELAY_MESSAGES[statusCode]) {
      const notice = document.createElement('p');
      notice.className = 'match__delay';
      const eta = finiteNumber(match?.restartEtaMinutes);
      const newKickoff = firstString(match?.newKickoff);
      const detail = eta !== null
        ? `Reprise estimée dans ${eta} min`
        : newKickoff ? `Nouvelle heure : ${formatTime(newKickoff)}` : 'Reprise à confirmer';
      notice.textContent = `${DELAY_MESSAGES[statusCode]} ${detail}`;
      article.append(notice);
    }
    article.append(state);

    const metadata = [];
    const venue = matchVenue(match);
    if (venue) metadata.push(`Stade : ${venue}`);
    if (textValue(match?.sourceUsed)) metadata.push(`Source : ${match.sourceUsed}`);
    if (formatDate(match?.lastUpdatedAt)) metadata.push(`Mis à jour : ${formatDate(match.lastUpdatedAt)}`);
    if (metadata.length) {
      const detail = document.createElement('p');
      detail.className = 'match__detail';
      detail.textContent = metadata.join(' · ');
      article.append(detail);
    }
    if (textValue(String(match?.id || ''))) {
      const details = makeDetailsPanel(match);
      article.append(details.button, details.panelElement);
    }
    return article;
  }

  function showMatches(matches) {
    showContent('matches-list', ...matches.map(makeMatchCard));
  }

  function looksLikeMatch(item) {
    return Boolean(item && typeof item === 'object' && (
      item.homeTeamName || item.awayTeamName || item.homeTeam || item.awayTeam || item.team1 || item.team2
    ));
  }

  function roundMatches(round) {
    for (const value of [round?.matches, round?.items, round?.games, round?.fixtures]) {
      if (Array.isArray(value)) return value;
    }
    return [];
  }

  function extractBracketRounds(payload) {
    const nested = payload?.data && !Array.isArray(payload.data) ? payload.data : {};
    const explicitRounds = [payload?.rounds, nested?.rounds, payload?.bracket, nested?.bracket]
      .find((value) => Array.isArray(value));
    if (explicitRounds?.length && explicitRounds.some((round) => roundMatches(round).length)) {
      return explicitRounds.map((round, index) => ({
        key: stageKey(firstString(round?.stage, round?.slug, round?.id, round?.name) || `round-${index + 1}`),
        name: stageLabel(firstString(round?.name, round?.label, round?.stage) || `Tour ${index + 1}`),
        matches: roundMatches(round),
      })).filter((round) => round.matches.length).sort((a, b) => {
        const aIndex = STAGE_ORDER.indexOf(a.key);
        const bIndex = STAGE_ORDER.indexOf(b.key);
        return (aIndex < 0 ? 99 : aIndex) - (bIndex < 0 ? 99 : bIndex);
      });
    }

    let matches = extractMatches(payload);
    if (!matches.length && Array.isArray(explicitRounds) && explicitRounds.every(looksLikeMatch)) matches = explicitRounds;
    const grouped = new Map();
    for (const match of matches.filter(looksLikeMatch)) {
      const rawStage = firstString(match?.stage, match?.round, match?.roundName) || 'Tableau';
      const key = stageKey(rawStage);
      if (!grouped.has(key)) grouped.set(key, { key, name: stageLabel(rawStage), matches: [] });
      grouped.get(key).matches.push(match);
    }
    return [...grouped.values()].sort((a, b) => {
      const aIndex = STAGE_ORDER.indexOf(a.key);
      const bIndex = STAGE_ORDER.indexOf(b.key);
      return (aIndex < 0 ? 99 : aIndex) - (bIndex < 0 ? 99 : bIndex);
    });
  }

  function makeBracketGame(match, index) {
    const game = document.createElement('article');
    game.className = `bracket-game bracket-game--${index % 2 === 0 ? 'top' : 'bottom'}`;
    const home = teamData(match, 'home');
    const away = teamData(match, 'away');
    const statusCode = matchStatus(match);
    const kickoff = matchKickoff(match);

    const meta = document.createElement('div');
    meta.className = 'bracket-game__meta';
    const time = document.createElement('time');
    time.textContent = formatDate(kickoff) || STATUS_LABELS[statusCode] || 'À confirmer';
    meta.append(time);

    const teams = document.createElement('div');
    teams.className = 'bracket-game__teams';
    for (const team of [home, away]) {
      const row = document.createElement('div');
      const name = document.createElement('span');
      name.textContent = team.name;
      const score = document.createElement('strong');
      score.textContent = team.score === null ? '—' : String(team.score);
      row.append(makeFlag(team.code), name, score);
      teams.append(row);
    }
    game.append(meta, teams);
    if (home.penaltyScore !== null && away.penaltyScore !== null) {
      const penalties = document.createElement('p');
      penalties.className = 'bracket-game__penalties';
      penalties.textContent = `TAB ${home.penaltyScore} – ${away.penaltyScore}`;
      game.append(penalties);
    }
    const qualified = firstString(match?.qualifiedTeamName, match?.winnerTeamName);
    const footer = document.createElement('p');
    footer.className = 'bracket-game__status';
    footer.textContent = qualified
      ? `${STATUS_LABELS[statusCode] || statusCode} · ${qualified} qualifié`
      : STATUS_LABELS[statusCode] || 'En attente de confirmation';
    game.append(footer);
    return game;
  }

  function renderBracket(payload) {
    const rounds = extractBracketRounds(payload);
    if (!rounds.length) {
      showState('empty', 'Tableau non disponible pour le moment');
      return;
    }
    const firstMatch = rounds.flatMap((round) => round.matches)[0];
    if (firstMatch) {
      addTrackedTeams(rounds.flatMap((round) => round.matches));
    }
    const heading = document.createElement('div');
    heading.className = 'section-heading';
    const title = document.createElement('h2');
    title.textContent = 'Tableau final';
    const status = document.createElement('span');
    status.textContent = `${rounds.length} tour${rounds.length > 1 ? 's' : ''}`;
    heading.append(title, status);

    const scroller = document.createElement('div');
    scroller.className = 'bracket-scroll';
    scroller.tabIndex = 0;
    scroller.setAttribute('aria-label', 'Tableau des phases finales');
    const board = document.createElement('div');
    board.className = 'bracket-board';
    const maxGames = Math.max(...rounds.map((round) => round.matches.length));
    board.style.setProperty('--bracket-height', `${Math.max(390, maxGames * 92)}px`);
    for (const round of rounds) {
      const column = document.createElement('section');
      column.className = 'bracket-round';
      column.classList.toggle('bracket-round--final', round.key === 'final');
      column.classList.toggle('bracket-round--placement', round.key === 'third-place');
      const roundHeading = document.createElement('h3');
      roundHeading.textContent = round.name;
      const games = document.createElement('div');
      games.className = 'bracket-round__games';
      games.append(...round.matches.map(makeBracketGame));
      column.append(roundHeading, games);
      board.append(column);
    }
    scroller.append(board);
    showContent('bracket-view', heading, scroller);
  }

  function groupRows(group) {
    for (const value of [group?.entries, group?.standings, group?.teams, group?.rows, group?.items, group?.table]) {
      if (Array.isArray(value)) return value;
    }
    return [];
  }

  function groupName(group, index) {
    const value = firstString(group?.name, group?.label, group?.group, group?.id) || `Groupe ${index + 1}`;
    return value.replace(/^group\s*/i, 'Groupe ');
  }

  function extractGroups(payload) {
    const nested = payload?.data && !Array.isArray(payload.data) ? payload.data : {};
    const candidate = [payload?.groups, nested?.groups, payload?.items, Array.isArray(payload?.data) ? payload.data : null]
      .find((value) => Array.isArray(value));
    if (!candidate?.length) return [];
    if (candidate.some((group) => groupRows(group).length)) {
      return candidate.map((group, index) => ({ name: groupName(group, index), rows: groupRows(group) }))
        .filter((group) => group.rows.length);
    }
    const grouped = new Map();
    for (const row of candidate) {
      const name = firstString(row?.group, row?.groupName, row?.stage) || 'Groupe';
      if (!grouped.has(name)) grouped.set(name, []);
      grouped.get(name).push(row);
    }
    return [...grouped].map(([name, rows]) => ({ name: name.replace(/^group\s*/i, 'Groupe '), rows }));
  }

  function standingTeam(row) {
    const nested = row?.team && typeof row.team === 'object' ? row.team : {};
    return {
      name: safeTeamName(firstString(row?.teamName, row?.name, nested?.name)),
      code: (firstString(row?.teamCode, row?.code, nested?.code, nested?.abbreviation) || 'TBD').toUpperCase(),
    };
  }

  function standingValue(row, ...keys) {
    for (const key of keys) {
      const value = finiteNumber(row?.[key]);
      if (value !== null) return String(value);
    }
    return '—';
  }

  function makeGroupCard(group) {
    const card = document.createElement('section');
    card.className = 'group-card';
    const heading = document.createElement('h3');
    heading.textContent = group.name;
    const table = document.createElement('div');
    table.className = 'group-table';
    table.setAttribute('role', 'table');
    table.setAttribute('aria-label', `Classement ${group.name}`);

    const header = document.createElement('div');
    header.className = 'group-row group-row--header';
    header.setAttribute('role', 'row');
    const labels = [
      ['#', ''], ['Équipe', ''], ['J', ''], ['G', 'group-stat--optional'], ['N', 'group-stat--optional'],
      ['P', 'group-stat--optional'], ['Diff', ''], ['Pts', ''],
    ];
    for (const [label, className] of labels) {
      const value = cell(label);
      value.className = className;
      value.setAttribute('role', 'columnheader');
      header.append(value);
    }
    table.append(header);

    group.rows.forEach((row, index) => {
      const team = standingTeam(row);
      const entry = document.createElement('div');
      entry.className = 'group-row';
      entry.setAttribute('role', 'row');
      const position = cell(standingValue(row, 'position', 'rank') === '—' ? index + 1 : standingValue(row, 'position', 'rank'));
      const identity = document.createElement('span');
      identity.className = 'group-team';
      identity.append(makeFlag(team.code), cell(team.name));
      const values = [
        [standingValue(row, 'played', 'playedGames', 'matchesPlayed'), ''],
        [standingValue(row, 'won', 'wins'), 'group-stat--optional'],
        [standingValue(row, 'drawn', 'draws'), 'group-stat--optional'],
        [standingValue(row, 'lost', 'losses'), 'group-stat--optional'],
        [standingValue(row, 'goalDifference', 'goalsDifference', 'difference'), ''],
        [standingValue(row, 'points', 'pts'), 'group-points'],
      ];
      entry.append(position, identity);
      for (const [value, className] of values) {
        const stat = cell(value);
        stat.className = className;
        entry.append(stat);
      }
      table.append(entry);
      if (team.code !== 'TBD' && team.name !== 'À déterminer') trackedTeamMap.set(team.code, team);
    });
    card.append(heading, table);
    return card;
  }

  function renderGroups(payload) {
    const groups = extractGroups(payload);
    if (!groups.length) {
      showState('empty', 'Classements de groupes non disponibles pour le moment');
      return;
    }
    renderTrackedTeams();
    const heading = document.createElement('div');
    heading.className = 'section-heading';
    const title = document.createElement('h2');
    title.textContent = 'Phase de groupes';
    const count = document.createElement('span');
    count.textContent = `${groups.length} groupe${groups.length > 1 ? 's' : ''}`;
    heading.append(title, count);
    const grid = document.createElement('div');
    grid.className = 'groups-grid';
    grid.append(...groups.map(makeGroupCard));
    showContent('groups-view', heading, grid);
  }

  function scheduleNext(view, completedRequestId) {
    window.clearTimeout(timerId);
    if (view !== activeView || completedRequestId !== requestId) return;
    timerId = window.setTimeout(() => loadActiveView({ background: true }), VIEWS[view].interval);
  }

  async function loadActiveView({ background = false } = {}) {
    const view = activeView;
    const config = VIEWS[view];
    const currentRequestId = ++requestId;
    lastRequestAt = Date.now();
    window.clearTimeout(timerId);
    controller?.abort();
    const requestController = new AbortController();
    controller = requestController;
    let timedOut = false;
    const timeoutId = window.setTimeout(() => { timedOut = true; requestController.abort(); }, 25_000);
    refreshButton.disabled = true;
    refreshButton.classList.add('is-loading');
    if (!background) showState('loading', config.kind === 'matches' ? 'Chargement des matchs...' : 'Chargement des données...');

    try {
      const response = await fetch(apiEndpoint(config.endpoint), {
        headers: { Accept: 'application/json' }, signal: requestController.signal, cache: 'no-store',
      });
      const payload = await response.json();
      if (!response.ok) throw new Error('Serveur indisponible');
      if (view !== activeView || currentRequestId !== requestId) return;
      setMetadata(extractMetadata(payload));
      if (payload?.success === false && config.kind !== 'matches') {
        showState('error', config.kind === 'bracket'
          ? 'Tableau temporairement indisponible'
          : 'Classements de groupes temporairement indisponibles');
        return;
      }
      if (payload?.success === false) throw new Error('Serveur indisponible');
      if (config.kind === 'bracket') {
        renderBracket(payload);
      } else if (config.kind === 'groups') {
        renderGroups(payload);
      } else {
        const matches = extractMatches(payload);
        addTrackedTeams(matches);
        if (matches.length) {
          showMatches(matches);
        } else {
          showState('empty', {
            live: 'Aucun match en direct actuellement', today: "Aucun match aujourd'hui", upcoming: 'Aucun match à venir',
          }[view]);
        }
      }
    } catch (error) {
      if (error?.name === 'AbortError' && !timedOut) return;
      if (view !== activeView || currentRequestId !== requestId) return;
      setMetadata();
      showState('error', 'Serveur temporairement indisponible');
    } finally {
      window.clearTimeout(timeoutId);
      if (view === activeView && currentRequestId === requestId) {
        refreshButton.disabled = false;
        refreshButton.classList.remove('is-loading');
        scheduleNext(view, currentRequestId);
      }
    }
  }

  function selectView(view, { focus = false } = {}) {
    if (!VIEWS[view]) return;
    activeView = view;
    const selectedTab = tabs.find((tab) => tab.dataset.view === view);
    for (const tab of tabs) {
      const selected = tab === selectedTab;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    }
    panel.setAttribute('aria-labelledby', selectedTab.id);
    refreshRate.textContent = `Actualisation toutes les ${VIEWS[view].intervalLabel}`;
    if (focus) selectedTab.focus();
    loadActiveView();
  }

  for (const tab of tabs) {
    tab.addEventListener('click', () => selectView(tab.dataset.view));
    tab.addEventListener('keydown', (event) => {
      const currentIndex = tabs.indexOf(tab);
      let targetIndex = null;
      if (event.key === 'ArrowRight') targetIndex = (currentIndex + 1) % tabs.length;
      if (event.key === 'ArrowLeft') targetIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      if (event.key === 'Home') targetIndex = 0;
      if (event.key === 'End') targetIndex = tabs.length - 1;
      if (targetIndex !== null) {
        event.preventDefault();
        selectView(tabs[targetIndex].dataset.view, { focus: true });
      }
    });
  }

  refreshButton.addEventListener('click', () => loadActiveView());
  collapseButton.addEventListener('click', () => {
    const collapsed = widget.classList.toggle('is-collapsed');
    widgetBody.hidden = collapsed;
    collapseButton.setAttribute('aria-expanded', String(!collapsed));
    collapseButton.setAttribute('aria-label', collapsed ? 'Agrandir le widget' : 'Réduire le widget');
    collapseButton.title = collapsed ? 'Agrandir' : 'Réduire';
    collapseButton.firstElementChild.textContent = collapsed ? '+' : '−';
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return window.clearTimeout(timerId);
    if (Date.now() - lastRequestAt >= VIEWS[activeView].interval) loadActiveView({ background: true });
    else scheduleNext(activeView, requestId);
  });

  renderPoster(null);
  loadFeaturedPoster();
  loadTrackedTeams();
  loadActiveView();
})();
