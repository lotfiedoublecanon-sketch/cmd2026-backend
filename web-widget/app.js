(() => {
  'use strict';

  const RENDER_ORIGIN = 'https://cmd2026-backend-1.onrender.com';
  const isGitHubPages = location.hostname.endsWith('.github.io');
  const apiEndpoint = (path) => isGitHubPages ? `${RENDER_ORIGIN}${path}` : path;

  const VIEWS = {
    live: { endpoint: '/api/widget/live', interval: 15_000, intervalLabel: '15 s' },
    today: { endpoint: '/api/widget/today', interval: 60_000, intervalLabel: '60 s' },
    upcoming: { endpoint: '/api/widget/upcoming?days=60', interval: 300_000, intervalLabel: '5 min' },
  };

  const STATUS_LABELS = {
    SCHEDULED: 'Programmé',
    LIVE: 'En direct',
    HALF_TIME: 'Mi-temps',
    EXTRA_TIME: 'Prolongation',
    PENALTIES: 'Tirs au but',
    FINISHED: 'Terminé',
    POSTPONED: 'Reporté',
    CANCELLED: 'Annulé',
    UNKNOWN: 'Statut inconnu',
    AWAITING_LIVE_DATA: 'Données live en attente',
  };

  const LIVE_STATUSES = new Set(['LIVE', 'HALF_TIME', 'EXTRA_TIME', 'PENALTIES']);
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
    goal: 'But', own_goal: 'But contre son camp', penalty_goal: 'Penalty',
    penalty_missed: 'Penalty manqué', yellow_card: 'Carton jaune', red_card: 'Carton rouge',
    second_yellow_card: 'Second carton jaune', substitution: 'Remplacement',
    period_start: 'Reprise', period_end: 'Fin de période', var_decision: 'Décision VAR',
  };

  const STAGE_LABELS = {
    'group-stage': 'Phase de groupes',
    'round-of-32': 'Seizièmes de finale',
    'round-of-16': 'Huitièmes de finale',
    quarterfinals: 'Quarts de finale',
    semifinals: 'Demi-finales',
    'third-place': 'Match pour la troisième place',
    final: 'Finale',
  };

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

  let activeView = 'live';
  let timerId = null;
  let controller = null;
  let requestId = 0;
  let lastRequestAt = 0;
  const trackedTeamMap = new Map();

  function textValue(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  function firstString(...values) {
    return values.map(textValue).find(Boolean) || null;
  }

  function extractMatches(payload) {
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.data?.matches)) return payload.data.matches;
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

  function addTrackedTeams(matches) {
    for (const match of matches) {
      for (const side of ['home', 'away']) {
        const name = safeTeamName(match?.[`${side}TeamName`]);
        const code = textValue(match?.[`${side}TeamCode`])?.toUpperCase();
        if (!code || code === 'TBD' || name === 'À déterminer') continue;
        trackedTeamMap.set(code, { code, name });
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
      chip.role = 'listitem';
      chip.title = team.name;
      const code = document.createElement('span');
      code.className = 'team-chip__code';
      code.textContent = team.code;
      chip.append(makeFlag(team.code), code);
      return chip;
    }));
  }

  async function loadTrackedTeams() {
    const results = await Promise.allSettled(Object.values(VIEWS).map((view) => fetchJson(view.endpoint)));
    for (const result of results) {
      if (result.status === 'fulfilled') addTrackedTeams(extractMatches(result.value));
    }
    if (!trackedTeamMap.size) renderTrackedTeams();
  }

  function safeTeamName(value) {
    const name = textValue(value);
    return !name || /^(TBD|Unknown)$/i.test(name) ? 'À déterminer' : name;
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

  function formatDate(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return textValue(value);
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
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

  function stageLabel(value) {
    const stage = textValue(value);
    if (!stage) return 'Coupe du monde 2026';
    return STAGE_LABELS[stage.toLowerCase()] || stage;
  }

  function matchStatus(match) {
    return firstString(match?.status, match?.state, match?.liveStatus) || 'UNKNOWN';
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
    if (!response.ok) throw new Error('Détails indisponibles');
    return response.json();
  }

  async function loadMatchDetails(match, container, button) {
    container.textContent = 'Chargement des détails...';
    button.disabled = true;
    try {
      const id = encodeURIComponent(String(match.id || ''));
      const [eventsPayload, statsPayload] = await Promise.all([
        fetchJson(`/api/widget/events/${id}`),
        fetchJson(`/api/widget/stats/${id}`),
      ]);
      const events = extractMatches(eventsPayload);
      const stats = extractMatches(statsPayload);
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
    header.append(cell(match.homeTeamCode || 'DOM'), cell('Statistique'), cell(match.awayTeamCode || 'EXT'));
    table.append(header);
    for (const stat of stats) {
      const row = document.createElement('div');
      row.className = 'stats-row';
      row.append(cell(stat.home ?? '—'), cell(stat.name || '—'), cell(stat.away ?? '—'));
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
      minute.textContent = `${Number(event.minute) || 0}'`;
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
    const kickoff = firstString(match?.kickoff, match?.startDateTimeUtc, match?.date);

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
    minute.dataset.visible = String((isLive && Number.isFinite(match?.minute)) || isUpcoming);
    minute.textContent = isUpcoming
      ? formatTime(kickoff)
      : isLive && Number.isFinite(match?.minute) ? `${match.minute}'` : ' ';

    const scoreline = document.createElement('div');
    scoreline.className = 'match__scoreline';
    const homeName = safeTeamName(match?.homeTeamName);
    const awayName = safeTeamName(match?.awayTeamName);
    const hasScore = Number.isFinite(match?.homeScore) && Number.isFinite(match?.awayScore);
    const score = document.createElement('strong');
    score.className = 'match__score';
    score.dataset.available = String(hasScore || isUpcoming);
    score.classList.toggle('match__score--versus', isUpcoming);
    score.textContent = isUpcoming ? 'VS' : hasScore ? `${match.homeScore} : ${match.awayScore}` : '— : —';
    score.setAttribute('aria-label', hasScore ? `${homeName} ${match.homeScore}, ${awayName} ${match.awayScore}` : 'Score non disponible');
    scoreline.append(
      makeTeam(homeName, match?.homeTeamCode, 'home'),
      score,
      makeTeam(awayName, match?.awayTeamCode, 'away'),
    );

    const state = document.createElement('div');
    state.className = 'match__state';
    state.dataset.live = String(isLive);
    state.textContent = isUpcoming
      ? `${formatDay(kickoff)} · ${stageLabel(match?.stage || match?.group)}`
      : STATUS_LABELS[statusCode] || statusCode;

    article.append(topline, minute, scoreline);

    if (Number.isFinite(match?.homePenaltyScore) && Number.isFinite(match?.awayPenaltyScore)) {
      const penalties = document.createElement('p');
      penalties.className = 'match__penalties';
      penalties.textContent = `Tirs au but : ${match.homePenaltyScore} – ${match.awayPenaltyScore}`;
      article.append(penalties);
    }
    if (textValue(match?.winnerTeamName)) {
      const winner = document.createElement('p');
      winner.className = 'match__winner';
      winner.textContent = `Vainqueur : ${match.winnerTeamName}`;
      article.append(winner);
    }
    article.append(state);

    const metadata = [];
    if (textValue(match?.venue)) metadata.push(`Stade : ${match.venue}`);
    if (textValue(match?.sourceUsed)) metadata.push(`Source : ${match.sourceUsed}`);
    if (formatDate(match?.lastUpdatedAt)) metadata.push(`Mis à jour : ${formatDate(match.lastUpdatedAt)}`);
    if (metadata.length) {
      const detail = document.createElement('p');
      detail.className = 'match__detail';
      detail.textContent = metadata.join(' · ');
      article.append(detail);
    }

    if (textValue(match?.id)) {
      const details = makeDetailsPanel(match);
      article.append(details.button, details.panelElement);
    }
    return article;
  }

  function showMatches(matches) {
    stateMessage.hidden = true;
    matchesList.replaceChildren(...matches.map(makeMatchCard));
    matchesList.hidden = false;
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
    if (!background) showState('loading', 'Chargement des matchs...');

    try {
      const response = await fetch(apiEndpoint(config.endpoint), {
        headers: { Accept: 'application/json' }, signal: requestController.signal, cache: 'no-store',
      });
      const payload = await response.json();
      if (!response.ok || payload?.success === false) throw new Error('Serveur indisponible');
      if (view !== activeView || currentRequestId !== requestId) return;
      const matches = extractMatches(payload);
      addTrackedTeams(matches);
      setMetadata(extractMetadata(payload));
      if (matches.length) showMatches(matches);
      else showState('empty', {
        live: 'Aucun match en direct actuellement',
        today: "Aucun match aujourd'hui",
        upcoming: 'Aucun match à venir',
      }[view]);
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

  loadTrackedTeams();
  loadActiveView();
})();
