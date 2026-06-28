(() => {
  'use strict';

  const RENDER_ORIGIN = 'https://cmd2026-backend-1.onrender.com';
  const useSameOriginWidgetApi = location.hostname.endsWith('.onrender.com')
    || location.port === '3107';
  const apiEndpoint = (widgetPath, publicPath) => useSameOriginWidgetApi
    ? widgetPath
    : `${RENDER_ORIGIN}${publicPath}`;

  const VIEWS = {
    live: {
      endpoint: apiEndpoint('/api/widget/live', '/matches/live'),
      interval: 15_000,
      intervalLabel: '15 s',
    },
    today: {
      endpoint: apiEndpoint('/api/widget/today', '/matches/today'),
      interval: 60_000,
      intervalLabel: '60 s',
    },
    upcoming: {
      endpoint: apiEndpoint('/api/widget/upcoming?days=60', '/matches/upcoming?days=60'),
      interval: 300_000,
      intervalLabel: '5 min',
    },
  };

  const STATUS_LABELS = {
    scheduled: 'Programmé',
    SCHEDULED: 'Programmé',
    in_progress: 'En direct',
    LIVE: 'En direct',
    halftime: 'Mi-temps',
    HALF_TIME: 'Mi-temps',
    extra_time: 'Prolongation',
    EXTRA_TIME: 'Prolongation',
    penalties: 'Tirs au but',
    PENALTIES: 'Tirs au but',
    finished: 'Terminé',
    FINISHED: 'Terminé',
    postponed: 'Reporté',
    POSTPONED: 'Reporté',
    cancelled: 'Annulé',
    CANCELLED: 'Annulé',
    unknown: 'Statut inconnu',
    UNKNOWN: 'Statut inconnu',
    AWAITING_LIVE_DATA: 'Match en attente de données live',
  };

  const LIVE_STATUSES = new Set([
    'in_progress',
    'halftime',
    'extra_time',
    'penalties',
    'LIVE',
    'HALF_TIME',
    'EXTRA_TIME',
    'PENALTIES',
  ]);
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

  let activeView = 'live';
  let timerId = null;
  let controller = null;
  let requestId = 0;
  let lastRequestAt = 0;

  function asNonEmptyString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  function firstString(...values) {
    for (const value of values) {
      const text = asNonEmptyString(value);
      if (text) return text;
    }
    return null;
  }

  function isAwaitingLiveData(payload) {
    const data = payload && typeof payload.data === 'object' ? payload.data : null;
    return [
      payload?.liveDataStatus === 'waiting' ? 'AWAITING_LIVE_DATA' : null,
      payload?.status,
      payload?.state,
      payload?.code,
      payload?.error,
      data?.status,
      data?.state,
      data?.code,
    ].some((value) => value === 'AWAITING_LIVE_DATA');
  }

  function extractMatches(payload) {
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.data?.matches)) return payload.data.matches;
    if (Array.isArray(payload?.matches)) return payload.matches;
    return [];
  }

  function extractMetadata(payload) {
    const nested = payload?.data && !Array.isArray(payload.data) ? payload.data : {};
    return {
      source: firstString(payload?.sourceUsed, payload?.source, nested?.sourceUsed, nested?.source),
      updatedAt: firstString(
        payload?.lastUpdatedAt,
        payload?.updatedAt,
        payload?.cachedAt,
        nested?.lastUpdatedAt,
        nested?.updatedAt,
        nested?.cachedAt,
      ),
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
    time.textContent = new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(date);
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

  function readTeamName(match, side) {
    const directName = asNonEmptyString(match?.[`${side}TeamName`]);
    if (directName) return directName;
    const team = match?.[`${side}Team`] ?? match?.[side];
    if (typeof team === 'string') return asNonEmptyString(team);
    return firstString(team?.name, team?.shortName, team?.threeCharCode);
  }

  function readScore(value) {
    return typeof value === 'number' && Number.isFinite(value) ? String(value) : '—';
  }

  function readMatchStatus(match) {
    const status = firstString(match?.status, match?.state, match?.liveStatus);
    const kickoff = firstString(
      match?.kickoff,
      match?.startDateTimeUtc,
      match?.startTime,
      match?.date,
    );
    const scoreMissing = readScore(match?.homeScore) === '—'
      && readScore(match?.awayScore) === '—';
    const kickoffTime = kickoff ? new Date(kickoff).getTime() : Number.NaN;
    const isUnconfirmed = ['scheduled', 'SCHEDULED', 'unknown', 'UNKNOWN'].includes(status);
    if (isUnconfirmed && scoreMissing && Number.isFinite(kickoffTime) && kickoffTime <= Date.now()) {
      return 'AWAITING_LIVE_DATA';
    }
    return status;
  }

  function statusLabel(status) {
    return status ? (STATUS_LABELS[status] || status) : '—';
  }

  function formatMatchDate(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return asNonEmptyString(value);
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  function makeMatchCard(match) {
    const article = document.createElement('article');
    article.className = 'match';

    const topline = document.createElement('div');
    topline.className = 'match__topline';

    const competition = document.createElement('span');
    competition.className = 'match__competition';
    competition.textContent = firstString(
      match?.competitionName,
      match?.competition,
      match?.group,
      match?.stage,
    ) || '—';

    const rawStatus = readMatchStatus(match);
    const status = document.createElement('span');
    status.className = 'match__status';
    status.dataset.live = String(LIVE_STATUSES.has(rawStatus));
    status.textContent = statusLabel(rawStatus);
    topline.append(competition, status);

    const scoreline = document.createElement('div');
    scoreline.className = 'match__scoreline';

    const homeName = readTeamName(match, 'home') || '—';
    const awayName = readTeamName(match, 'away') || '—';
    const home = document.createElement('span');
    home.className = 'match__team';
    home.textContent = homeName;

    const score = document.createElement('strong');
    score.className = 'match__score';
    const hasScore = typeof match?.homeScore === 'number'
      && Number.isFinite(match.homeScore)
      && typeof match?.awayScore === 'number'
      && Number.isFinite(match.awayScore);
    const homeScore = readScore(match?.homeScore);
    const awayScore = readScore(match?.awayScore);
    score.dataset.available = String(hasScore);
    score.textContent = hasScore ? `${homeScore} : ${awayScore}` : 'Score non disponible';
    score.setAttribute(
      'aria-label',
      hasScore
        ? `Score ${homeName}, ${homeScore}; ${awayName}, ${awayScore}`
        : 'Score non disponible',
    );

    const away = document.createElement('span');
    away.className = 'match__team match__team--away';
    away.textContent = awayName;
    scoreline.append(home, score, away);

    article.append(topline, scoreline);

    const details = [];
    const date = formatMatchDate(firstString(
      match?.kickoff,
      match?.startDateTimeUtc,
      match?.startTime,
      match?.date,
    ));
    if (date) details.push(date);
    if (typeof match?.minute === 'number' && Number.isFinite(match.minute)) details.push(`${match.minute}'`);
    const venue = firstString(match?.venue);
    if (venue) details.push(venue);
    const source = firstString(match?.sourceUsed);
    if (source) details.push(`Source : ${source}`);
    const updatedAt = formatMatchDate(match?.lastUpdatedAt);
    if (updatedAt) details.push(`Mis à jour : ${updatedAt}`);

    if (details.length) {
      const detail = document.createElement('p');
      detail.className = 'match__detail';
      detail.textContent = details.join(' · ');
      article.append(detail);
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
    const requestTimeoutId = window.setTimeout(() => {
      timedOut = true;
      requestController.abort();
    }, 25_000);

    refreshButton.disabled = true;
    refreshButton.classList.add('is-loading');
    if (!background) showState('loading', 'Chargement des matchs...');

    try {
      const response = await fetch(config.endpoint, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: requestController.signal,
        cache: 'no-store',
      });

      let payload;
      try {
        payload = await response.json();
      } catch {
        throw new Error('Réponse du serveur illisible.');
      }

      if (!response.ok || (payload?.success === false && !isAwaitingLiveData(payload))) {
        throw new Error('Serveur temporairement indisponible');
      }

      if (view !== activeView || currentRequestId !== requestId) return;

      const metadata = extractMetadata(payload);
      const matches = extractMatches(payload);
      setMetadata(metadata);

      if (matches.length) {
        showMatches(matches);
      } else if (isAwaitingLiveData(payload)) {
        showState('empty', 'Match en attente de données live');
      } else {
        const emptyMessages = {
          live: 'Aucun match en direct actuellement',
          today: "Aucun match aujourd'hui",
          upcoming: 'Aucun match à venir',
        };
        showState('empty', emptyMessages[view]);
      }
    } catch (error) {
      if (error?.name === 'AbortError' && !timedOut) return;
      if (view !== activeView || currentRequestId !== requestId) return;
      setMetadata();
      showState('error', 'Serveur temporairement indisponible');
    } finally {
      window.clearTimeout(requestTimeoutId);
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
    if (document.hidden) {
      window.clearTimeout(timerId);
      return;
    }

    const elapsed = Date.now() - lastRequestAt;
    if (elapsed >= VIEWS[activeView].interval) {
      loadActiveView({ background: true });
    } else {
      scheduleNext(activeView, requestId);
    }
  });

  loadActiveView();
})();
