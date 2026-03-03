// ═══════════════════════════════════════════════════════
// ENGINE.JS — Moteur de jeu, profil, gamification
// ═══════════════════════════════════════════════════════

// ── État global ──────────────────────────────────────
let profile = null;
let game = null;  // Session de jeu en cours
let currentContext = 'personal'; // 'personal' | 'enterprise'
let pendingAvatar = null; // Pour la modale avatar
let shareImageData = null; // Pour le partage

// ── INIT ─────────────────────────────────────────────
function initApp() {
  profile = loadProfile();
  currentContext = profile.lastContext || 'personal';
  updateAllUI();

  // Vérifier si on a déjà un contexte actif → sauter l'écran de sélection
  if (profile.personal.gamesPlayed > 0 || profile.enterprise?.activated) {
    showView('view-menu');
  } else {
    showView('view-env-select');
  }
}

// ── PROFIL ───────────────────────────────────────────
function loadProfile() {
  const raw = localStorage.getItem('mn_profile_v3');
  if (raw) {
    try { return JSON.parse(raw); } catch(e) {}
  }
  return initDefaultProfile();
}

function initDefaultProfile() {
  return {
    // Partagés
    level: 1,
    xp: 0,
    unlockedTechs: getTechsForLevel(1),
    avatar: { type: 'emoji', data: '👤' },
    language: 'fr',
    currency: 'EUR',
    lastContext: 'personal',
    createdAt: Date.now(),
    // Personnel
    personal: {
      gamesPlayed: 0,
      successCount: 0,
      successRate: 0,
      avgScore: 0,
      streak: 0,
      lastPlayDate: null,
      badges: [],
      modeWeights: { competitive: 0, harvard: 0, coercive: 0 },
      modeRevealed: false,
      modeTendencyShown: false,
      history: [],
      techUsage: {},
      techScores: {},
      businessStreak: 0,
      justFailed: false,
      disruptionScore: null,
      comeback: false,
      diplomatBadge: false
    },
    // Entreprise (vide par défaut)
    enterprise: {
      activated: false,
      companyId: null,
      companyName: null,
      managerId: null,
      accessCode: null,
      employeeFunction: null,
      gamesPlayed: 0,
      successCount: 0,
      successRate: 0,
      avgScore: 0,
      streak: 0,
      lastPlayDate: null,
      badges: [],
      modeWeights: { competitive: 0, harvard: 0, coercive: 0 },
      modeRevealed: false,
      history: [],
      techUsage: {},
      techScores: {},
      activeParcoursIds: []
    }
  };
}

function saveProfile() {
  localStorage.setItem('mn_profile_v3', JSON.stringify(profile));
}

// Clé API gérée côté serveur via proxy Netlify
function getApiKey() { return null; }
function saveApiKey() { showToast('La clé API est gérée par le serveur.'); }

// ── CONTEXTE ─────────────────────────────────────────
function selectPersonal() {
  currentContext = 'personal';
  profile.lastContext = 'personal';
  saveProfile();
  showView('view-menu');
  renderMenu();
}

function switchContext(ctx) {
  if (ctx === 'enterprise' && !profile.enterprise.activated) {
    showCodeEntry();
    return;
  }
  currentContext = ctx;
  profile.lastContext = ctx;
  saveProfile();
  renderMenu();
  updateContextToggle();
}

function getCtx() {
  return profile[currentContext];
}

// ── NAVIGATION ───────────────────────────────────────
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
  window.scrollTo(0, 0);
}

function goToMenu() {
  showView('view-menu');
  renderMenu();
  updateHUD();
}

// ── SÉLECTION DU SCÉNARIO ────────────────────────────
function selectScenario(categoryId) {
  const cat = CATEGORIES.find(c => c.id === categoryId);
  if (!cat) return;

  // Vérifier disponibilité dans le contexte
  if (currentContext === 'enterprise' && !cat.enterprise) {
    showToast('Cette catégorie n\'est pas disponible en mode Entreprise.');
    return;
  }

  game = {
    context: currentContext,
    scenarioType: categoryId,
    scenarioCategory: cat,
    scenario: null,
    currentStep: 0,
    maxSteps: 10,
    failCounter: 0,
    disruptionTriggered: false,
    disruptionStep: -1,
    disruptionData: null,
    selectedTechs: [],
    generatedResponses: [],
    selectedChoice: null,
    steps: [],
    totalScore: 0,
    outcome: null,
    quality: 'green',
    sessionModeWeights: { competitive: 0, harvard: 0, coercive: 0 },
    // Stats pour les barres
    statConfidence: 70,
    statCredibility: 70,
    statRelation: 50
  };

  showView('view-loading');
  animateLoadingSteps(() => generateScenario());
}

// ── ANIMATION DE CHARGEMENT ──────────────────────────
function animateLoadingSteps(callback) {
  const steps = document.querySelectorAll('.loading-step');
  steps.forEach(s => { s.className = 'loading-step'; s.textContent = s.textContent.replace('✓ ', '').replace('→ ', ''); });

  let i = 0;
  const labels = [
    'Analyse du type de négociation...',
    'Création des personnages...',
    'Définition des enjeux...',
    'Contexte narratif...',
    'Dialogues réalistes...',
    'Étapes de négociation...',
    'Calibrage des techniques...',
    'Finalisation...'
  ];

  function nextStep() {
    if (i > 0) {
      document.getElementById(`lstep${i-1}`).className = 'loading-step done';
      document.getElementById(`lstep${i-1}`).textContent = '✓ ' + labels[i-1];
    }
    if (i < steps.length) {
      document.getElementById(`lstep${i}`).className = 'loading-step active';
      document.getElementById(`lstep${i}`).textContent = '→ ' + labels[i];
      i++;
      setTimeout(nextStep, 400);
    } else {
      callback && callback();
    }
  }
  nextStep();
}

// ── JEUX ─────────────────────────────────────────────
function startGameDisplay() {
  const s = game.scenario;
  showView('view-negotiation');

  // Header
  document.getElementById('hudScenarioType').textContent = game.scenarioCategory.icon + ' ' + game.scenarioCategory.name;
  document.getElementById('hudLevelGame').textContent = profile.level;

  // Scene window
  document.getElementById('sceneLocation').textContent = s.location || '';
  document.getElementById('sceneTension').textContent = s.context || '';

  // Adversaire
  document.getElementById('opponentAvatarPanel').textContent = s.opponentEmoji || '🧑‍💼';
  document.getElementById('opponentSceneAvatar').textContent = s.opponentEmoji || '🧑‍💼';
  document.getElementById('opponentNamePanel').textContent = s.opponentName || 'Adversaire';
  document.getElementById('opponentRolePanel').textContent = s.opponentRole || '';
  document.getElementById('sceneOpponentLabel').textContent = s.opponentName || 'Adversaire';

  // Joueur
  const av = profile.avatar;
  const playerDisplay = av.type === 'photo' ? `<img src="${av.data}">` : av.data;
  document.getElementById('playerAvatarPanel').innerHTML = playerDisplay;
  document.getElementById('playerSceneAvatar').innerHTML = av.type === 'photo' ? `<img src="${av.data}" style="width:52px;height:52px;border-radius:50%;object-fit:cover;">` : av.data;
  document.getElementById('playerRolePanel').textContent = s.yourRole || '';
  document.getElementById('scenePlayerLabel').textContent = 'Vous';

  // Profil psychologique adversaire
  renderOpponentProfile(s.opponentProfile || { openness: 'Prudent', patience: 'Limitée', flexibility: 'Faible' });

  // Initialiser les barres
  updateStatBars(game.statConfidence, game.statCredibility, game.statRelation);

  loadStep(0);
}

function loadStep(stepIndex) {
  game.currentStep = stepIndex;
  const s = game.scenario;
  const step = s.steps[stepIndex];

  // Vérifier si l'événement perturbateur se déclenche
  if (s.disruption?.enabled && stepIndex === s.disruption.stepIndex && !game.disruptionTriggered) {
    activateDisruption(s.disruption);
  }

  // Mettre à jour l'indicateur d'étape
  const stepLabel = `Étape ${stepIndex + 1} / ?`;
  document.getElementById('hudStep').textContent = stepLabel;
  document.getElementById('sceneStepIndicator').textContent = stepLabel;

  // Mettre à jour l'humeur adversaire
  updateOpponentMood(step.mood || 'neutral');

  // Afficher la situation (Moment 1)
  document.getElementById('opponentSpeech').textContent = `"${step.opponentLine}"`;
  document.getElementById('situationText').textContent = step.situation;
  document.getElementById('opponentMiniSpeech').textContent = `"${step.opponentLine.substring(0, 80)}..."`;

  // Réinitialiser les phases
  showPhase('phaseSituation');
  game.selectedTechs = [];
  game.selectedChoice = null;
  renderTechGrid();
}

function showPhase(phaseId) {
  ['phaseSituation','phaseTechs','phaseGenerating','phaseResponses','phaseFeedback'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
  document.getElementById(phaseId).classList.remove('hidden');
}

// ── TECHNIQUES ───────────────────────────────────────
function showTechSelection() {
  showPhase('phaseTechs');
  renderTechGrid();
  // Afficher la situation dans la zone sticky
  const step = game.scenario?.steps[game.currentStep];
  if (step) {
    const speechEl = document.getElementById('stickyOpponentLine');
    const ctxEl = document.getElementById('stickyStepContext');
    if (speechEl) speechEl.textContent = step.opponentLine || '';
    if (ctxEl) ctxEl.textContent = step.situation || '';
  }
}

function renderTechGrid() {
  const grid = document.getElementById('techsGrid');
  const unlocked = profile.unlockedTechs;
  grid.innerHTML = '';

  TECHNIQUES.forEach(tech => {
    const isUnlocked = unlocked.includes(tech.id);
    const isSelected = game.selectedTechs.includes(tech.id);
    const isMaxed = game.selectedTechs.length >= 3 && !isSelected;

    const card = document.createElement('div');
    card.className = `tech-card ${isSelected ? 'selected' : ''} ${!isUnlocked ? 'locked' : ''} ${isMaxed && !isSelected ? 'disabled' : ''}`;
    card.innerHTML = `
      <div class="tech-icon">${tech.icon}</div>
      <div class="tech-name">${tech.name}</div>
      <div class="tech-desc-short">${tech.shortDesc}</div>
      <div class="tech-mode-badge mode-badge-${tech.mode}">${tech.mode === 'competitive' ? '⚔ Compétitif' : tech.mode === 'harvard' ? '🤝 Harvard' : '👁 Coercitif'}</div>
      ${!isUnlocked ? `<div class="locked-banner">🔒 Niveau ${tech.level}</div>` : ''}
    `;
    if (isUnlocked && !(isMaxed && !isSelected)) {
      card.onclick = () => toggleTech(tech.id);
    }
    grid.appendChild(card);
  });

  updateTechCounter();
}

function toggleTech(techId) {
  const idx = game.selectedTechs.indexOf(techId);
  if (idx >= 0) {
    game.selectedTechs.splice(idx, 1);
  } else if (game.selectedTechs.length < 3) {
    game.selectedTechs.push(techId);
  }
  renderTechGrid();
  updateSidePanelTags();
}

function updateTechCounter() {
  const count = game.selectedTechs.length;
  const counter = document.getElementById('techCounter');
  const btn = document.getElementById('btnGenerateResponses');
  counter.textContent = `${count} / 3 choisies`;
  counter.className = count >= 2 ? 'tech-counter ready' : 'tech-counter';
  btn.disabled = count < 2;
  if (count >= 2) btn.textContent = 'Générer mes réponses →';
  else btn.textContent = `Choisissez encore ${2 - count} technique(s)`;
}

function updateSidePanelTags() {
  const container = document.getElementById('activeTechTags');
  container.innerHTML = game.selectedTechs.map(id => {
    const t = getTechById(id);
    return t ? `<span class="tech-tag">${t.icon} ${t.name}</span>` : '';
  }).join('');
}

// ── GÉNÉRER LES RÉPONSES ─────────────────────────────
async function generateResponses() {
  if (game.selectedTechs.length < 2) return;

  showPhase('phaseGenerating');

  // Afficher la modale "Saviez-vous que" pendant la génération
  if (typeof showDidYouKnow === 'function') {
    showDidYouKnow(game.selectedTechs);
  }

  const step = game.scenario.steps[game.currentStep];
  const techs = game.selectedTechs.map(id => getTechById(id));
  const disruption = game.disruptionTriggered && game.currentStep === game.disruptionStep;

  try {
    const responses = await callGenerateResponsesAPI(step, techs, disruption);
    game.generatedResponses = responses;
    if (typeof hideDidYouKnow === 'function') hideDidYouKnow();
    displayResponses(responses);
    showPhase('phaseResponses');
  } catch(err) {
    console.error('Génération réponses:', err);
    if (typeof hideDidYouKnow === 'function') hideDidYouKnow();
    // Fallback avec des réponses génériques
    game.generatedResponses = generateFallbackResponses(techs);
    displayResponses(game.generatedResponses);
    showPhase('phaseResponses');
  }
}

function generateFallbackResponses(techs) {
  return techs.map((tech, i) => ({
    id: i,
    letter: String.fromCharCode(65 + i),
    techTag: `${tech.icon} ${tech.name}`,
    text: `[Technique : ${tech.name}] Je comprends votre position. Permettez-moi de vous proposer une approche basée sur ${tech.shortDesc.toLowerCase()}.`,
    explanation: `Cette réponse applique la technique "${tech.name}".`
  }));
}

function displayResponses(responses) {
  const list = document.getElementById('responsesList');
  list.innerHTML = '';
  const btnConfirm = document.getElementById('btnConfirm');
  if (btnConfirm) {
    btnConfirm.disabled = true;
    btnConfirm.classList.remove('hidden');
  }
  game.selectedChoice = null;

  responses.forEach((resp, i) => {
    const card = document.createElement('div');
    card.className = 'response-card';
    card.id = `resp-${i}`;
    card.innerHTML = `
      <div class="response-header">
        <div class="response-letter">${resp.letter || String.fromCharCode(65+i)}</div>
        <span class="response-tech-tag">${resp.techTag || ''}</span>
      </div>
      <div class="response-text">"${resp.text}"</div>
      <div class="response-explanation">${resp.explanation || ''}</div>
    `;
    card.onclick = () => selectChoice(i);
    list.appendChild(card);
  });
}

function selectChoice(idx) {
  document.querySelectorAll('.response-card').forEach(c => c.classList.remove('selected'));
  const card = document.getElementById(`resp-${idx}`);
  if (card) card.classList.add('selected');
  game.selectedChoice = idx;
  const btnConfirm = document.getElementById('btnConfirm');
  if (btnConfirm) {
    btnConfirm.disabled = false;
    btnConfirm.classList.remove('hidden');
  }
}

// ── CONFIRMER ET ÉVALUER ─────────────────────────────
async function confirmChoice() {
  if (game.selectedChoice === null) return;

  const step = game.scenario.steps[game.currentStep];
  const response = game.generatedResponses[game.selectedChoice];
  const techs = game.selectedTechs.map(id => getTechById(id));
  const disruption = game.disruptionTriggered && game.currentStep === game.disruptionStep;

  // Accumuler les poids de mode
  game.selectedTechs.forEach(techId => {
    const weights = MODE_WEIGHTS_BY_TECH[techId] || {};
    Object.entries(weights).forEach(([mode, pts]) => {
      game.sessionModeWeights[mode] = (game.sessionModeWeights[mode] || 0) + pts;
    });
  });

  showPhase('phaseGenerating');
  document.querySelector('#phaseGenerating .generating-spinner').textContent = '🧠 Évaluation de votre réponse...';

  try {
    const evaluation = await callEvaluateAPI(step, response, techs, disruption, game.failCounter);
    processEvaluation(evaluation, response);
  } catch(err) {
    console.error('Évaluation:', err);
    // Fallback évaluation
    const score = 60 + Math.floor(Math.random() * 30);
    processEvaluation({
      score,
      quality: score >= 75 ? 'good' : 'poor',
      feedback: 'Réponse analysée. Continuez à pratiquer pour affiner votre technique.',
      continuitySignal: score >= 75 ? 'continue' : 'failing',
      modeWeight: {}
    }, response);
  }
}

function processEvaluation(eval_, response) {
  const score = eval_.score || 65;
  const signal = eval_.continuitySignal || 'continue';
  const disruption = game.disruptionTriggered && game.currentStep === game.disruptionStep;

  // Enregistrer l'étape
  game.steps.push({
    stepIndex: game.currentStep,
    techs: [...game.selectedTechs],
    response: response?.text || '',
    score,
    feedback: eval_.feedback || '',
    signal,
    disruptionActive: disruption
  });

  // Traiter le signal
  if (signal === 'failing' || signal === 'fail') {
    game.failCounter++;
  } else {
    game.failCounter = 0; // Réinitialiser sur bonne réponse
    if (signal === 'continue' || signal === 'conclude' || signal === 'extend') {
      if (game.steps.length >= 2 && game.steps[game.steps.length-2]?.signal === 'failing') {
        profile.personal.comeback = true; // Badge récupération
      }
    }
  }

  // Mettre à jour les stats visuelles
  if (score >= 80) {
    game.statConfidence = Math.min(100, game.statConfidence + 8);
    game.statCredibility = Math.min(100, game.statCredibility + 6);
    game.statRelation = Math.min(100, game.statRelation + 10);
  } else if (score >= 60) {
    game.statConfidence = Math.min(100, game.statConfidence + 3);
    game.statRelation = Math.min(100, game.statRelation + 3);
  } else {
    game.statConfidence = Math.max(20, game.statConfidence - 8);
    game.statRelation = Math.max(10, game.statRelation - 10);
  }
  updateStatBars(game.statConfidence, game.statCredibility, game.statRelation);

  // Mettre à jour l'humeur adversaire
  const newMood = score >= 80 ? 'warm' : score >= 60 ? 'neutral' : 'hostile';
  updateOpponentMood(newMood);

  // Mettre à jour le score HUD
  const avgScore = game.steps.reduce((a, s) => a + s.score, 0) / game.steps.length;
  document.getElementById('hudScoreLive').textContent = Math.round(avgScore);

  // Afficher le feedback
  showFeedback(score, eval_.feedback, disruption ? game.scenario.disruption : null);

  // Préparer le bouton suivant selon le signal
  if (signal === 'fail' || game.failCounter >= 3) {
    game.outcome = 'fail';
    document.getElementById('btnNextStep').textContent = 'Voir le résumé →';
    document.getElementById('btnNextStep').onclick = () => endNegotiation('fail');
  } else if (signal === 'conclude') {
    game.outcome = 'success';
    document.getElementById('btnNextStep').textContent = 'Voir le résumé →';
    document.getElementById('btnNextStep').onclick = () => endNegotiation('success');
  } else {
    document.getElementById('btnNextStep').textContent = 'Étape suivante →';
    document.getElementById('btnNextStep').onclick = () => nextStep();
  }
}

function showFeedback(score, feedbackText, disruption) {
  const numEl = document.getElementById('stepScoreNum');
  numEl.textContent = score;
  numEl.className = 'score-number ' + (score >= 80 ? 'excellent' : score >= 60 ? 'good' : 'poor');

  document.getElementById('feedbackText').textContent = feedbackText || '';

  // Révélation de la disruption si applicable
  const disruptReveal = document.getElementById('disruptionReveal');
  if (disruption && game.disruptionTriggered && game.currentStep === game.disruptionStep) {
    disruptReveal.classList.remove('hidden');
    document.getElementById('disruptionText').textContent = disruption.revealText || '';
    // Badge sang-froid si score élevé malgré disruption
    if (score >= 80) {
      profile.personal.disruptionScore = score;
    }
  } else {
    disruptReveal.classList.add('hidden');
  }

  showPhase('phaseFeedback');
}

function nextStep() {
  const nextIndex = game.currentStep + 1;

  // Vérifier les limites
  if (nextIndex >= game.scenario.steps.length && game.scenario.steps.length < game.maxSteps) {
    // Si scénario pas encore conclu, générer une conclusion
    endNegotiation('success');
    return;
  }
  if (nextIndex >= game.scenario.steps.length) {
    endNegotiation('success');
    return;
  }

  loadStep(nextIndex);
  showPhase('phaseSituation');
}

// ── DISRUPTION ───────────────────────────────────────
function activateDisruption(disruption) {
  game.disruptionTriggered = true;
  game.disruptionStep = disruption.stepIndex;
  game.disruptionData = disruption;

  // Montrer l'indicateur
  const indicator = document.getElementById('disruptionIndicator');
  indicator.classList.remove('hidden');

  // Changer l'humeur de l'adversaire
  updateOpponentMood(disruption.moodShift || 'hostile');

  // Changer le profil visible
  if (disruption.moodShift === 'hostile') {
    document.getElementById('moodText').textContent = 'Tendu';
    renderOpponentProfile({ openness: 'Fermé', patience: 'Nulle', flexibility: 'Très faible' });
  } else if (disruption.moodShift === 'pressured') {
    document.getElementById('moodText').textContent = 'Pressé';
    renderOpponentProfile({ openness: 'Limitée', patience: 'Faible', flexibility: 'Sur les délais' });
  } else if (disruption.moodShift === 'relaxed') {
    document.getElementById('moodText').textContent = 'Détendu';
    renderOpponentProfile({ openness: 'Ouverte', patience: 'Bonne', flexibility: 'Plus souple' });
  }
}

function renderOpponentProfile(profile_) {
  const container = document.getElementById('profileTraits');
  container.innerHTML = Object.entries(profile_).map(([key, val]) => `
    <div class="profile-trait">
      <span>${key}</span>
      <span style="color:var(--text-light)">${val}</span>
    </div>
  `).join('');
}

// ── FIN DE PARTIE ────────────────────────────────────
async function endNegotiation(outcome) {
  game.outcome = outcome;

  // Calculer le score final
  const steps = game.steps;
  if (steps.length === 0) { goToMenu(); return; }

  const avgScore = steps.reduce((a, s) => a + s.score, 0) / steps.length;
  game.totalScore = Math.round(avgScore);

  // Déterminer le vrai outcome
  const lastSignal = steps[steps.length - 1]?.signal;
  if (outcome === 'fail' || game.failCounter >= 3 || lastSignal === 'fail') {
    game.outcome = 'fail';
  } else if (steps.length <= 5 && avgScore >= 80) {
    game.outcome = 'success'; // Succès rapide
  } else if (steps.length > 5) {
    game.outcome = avgScore >= 65 ? 'recovery' : 'fail';
  } else {
    game.outcome = avgScore >= 65 ? 'success' : 'fail';
  }

  // Mettre à jour le profil
  const ctx = getCtx();
  ctx.gamesPlayed++;
  if (game.outcome !== 'fail') ctx.successCount = (ctx.successCount || 0) + 1;
  ctx.successRate = Math.round((ctx.successCount / ctx.gamesPlayed) * 100);

  const allScores = [...(ctx.history || []).map(h => h.score), game.totalScore];
  ctx.avgScore = Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length);

  // Mettre à jour le streak
  updateStreak();

  // Accumuler les poids de mode
  accumulateModeWeights();

  // Ajouter XP
  const xpGained = calculateXP(game.totalScore, game.outcome);
  addXP(xpGained);

  // Enregistrer dans l'historique
  ctx.history = ctx.history || [];

  // Tracker l'usage des techniques et leurs scores moyens
  game.steps.forEach(step => {
    step.techs.forEach(techId => {
      ctx.techUsage = ctx.techUsage || {};
      ctx.techScores = ctx.techScores || {};
      ctx.techUsage[techId] = (ctx.techUsage[techId] || 0) + 1;
      const prev = ctx.techScores[techId] || 0;
      const count = ctx.techUsage[techId];
      ctx.techScores[techId] = Math.round((prev * (count - 1) + step.score) / count);
    });
  });

  ctx.history.unshift({
    scenarioType: game.scenarioType,
    score: game.totalScore,
    outcome: game.outcome,
    date: Date.now(),
    steps: steps.length,
    disruption: game.disruptionTriggered
  });
  if (ctx.history.length > 50) ctx.history = ctx.history.slice(0, 50);

  // Statistiques pour badges
  ctx.lastScore = game.totalScore;
  ctx.lastModeScore = { ...game.sessionModeWeights };
  if (game.scenarioType === 'business') {
    ctx.businessStreak = (ctx.businessStreak || 0) + (game.outcome !== 'fail' && game.totalScore >= 80 ? 1 : 0);
  } else {
    ctx.businessStreak = 0;
  }
  if ((game.scenarioType === 'politics' || game.scenarioType === 'crisis') && game.totalScore >= 75) {
    ctx.diplomatBadge = true;
  }

  // Vérifier les badges
  checkBadges();
  saveProfile();

  // Générer le résumé éducatif
  showView('view-result');
  renderResultScreen(xpGained);

  // Générer le résumé IA (asynchrone)
  generateEndSummary();

  // Vérifier révélation du mode
  const history = ctx.history;
  if (!ctx.modeRevealed && history.length >= 5) {
    setTimeout(() => showModeReveal(), 4000);
  } else if (!ctx.modeTendencyShown && history.length >= 3) {
    ctx.modeTendencyShown = true;
    saveProfile();
  }
}

function calculateXP(score, outcome) {
  if (outcome === 'fail') return Math.max(5, Math.round(score * 0.3));
  return Math.max(10, Math.round(score));
}

function addXP(amount) {
  profile.xp += amount;
  const needed = getXPForLevel(profile.level);
  if (profile.xp >= needed) {
    profile.xp -= needed;
    profile.level++;
    profile.unlockedTechs = getTechsForLevel(profile.level);
    saveProfile();
    // Notification de passage de niveau
    setTimeout(() => showNotification('🎉 Niveau ' + profile.level + ' !', `Vous avez déverrouillé 2 nouvelles techniques !`), 2000);
  }
  saveProfile();
}

function updateStreak() {
  const ctx = getCtx();
  const today = new Date().toDateString();
  const lastPlay = ctx.lastPlayDate;
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  if (lastPlay === today) {
    // Déjà joué aujourd'hui
  } else if (lastPlay === yesterday) {
    ctx.streak = (ctx.streak || 0) + 1;
  } else {
    ctx.streak = 1;
  }
  ctx.lastPlayDate = today;
}

function accumulateModeWeights() {
  const ctx = getCtx();
  const weights = game.sessionModeWeights;
  Object.entries(weights).forEach(([mode, pts]) => {
    ctx.modeWeights[mode] = (ctx.modeWeights[mode] || 0) + pts;
  });
}

function calculateModeProfile(context) {
  const ctx = profile[context || currentContext];
  const w = ctx.modeWeights || { competitive: 0, harvard: 0, coercive: 0 };
  const total = Object.values(w).reduce((a, b) => a + b, 0) || 1;
  return {
    competitive: Math.round((w.competitive / total) * 100),
    harvard: Math.round((w.harvard / total) * 100),
    coercive: Math.round((w.coercive / total) * 100)
  };
}

function getDominantMode(context) {
  const profile_ = calculateModeProfile(context || currentContext);
  return Object.entries(profile_).sort((a, b) => b[1] - a[1])[0][0];
}

// ── GAMIFICATION — BADGES ─────────────────────────────
function checkBadges() {
  const ctx = getCtx();
  const stats = {
    gamesPlayed: ctx.gamesPlayed,
    lastScore: ctx.lastScore,
    streak: ctx.streak,
    successCount: ctx.successCount || 0,
    lastModeScore: ctx.lastModeScore,
    justFailed: game.outcome === 'fail',
    businessStreak: ctx.businessStreak || 0,
    diplomatBadge: ctx.diplomatBadge || false,
    disruptionScore: ctx.disruptionScore,
    comeback: ctx.comeback || false
  };

  BADGES.forEach(badge => {
    if (!ctx.badges.includes(badge.id) && badge.condition(stats)) {
      ctx.badges.push(badge.id);
      showNotification(badge.icon + ' Badge débloqué !', badge.name + ' — ' + badge.desc);
    }
  });
}

// ── RÉVÉLATION DU MODE ───────────────────────────────
function showModeReveal() {
  const ctx = getCtx();
  ctx.modeRevealed = true;
  saveProfile();

  const modeProfile = calculateModeProfile(currentContext);
  const dominant = getDominantMode(currentContext);

  const modeInfo = {
    competitive: { name: 'Négociateur Compétitif', icon: '⚔', color: '#1A2744' },
    harvard: { name: 'Négociateur Harvard', icon: '🤝', color: '#1A6B3C' },
    coercive: { name: 'Négociateur Coercitif', icon: '👁', color: '#6B1A1A' }
  };

  const info = modeInfo[dominant] || modeInfo.competitive;

  document.getElementById('modeRevealIcon').textContent = info.icon;
  document.getElementById('modeRevealName').textContent = info.name;
  document.getElementById('modeRevealCard').style.background = info.color;

  // Barres
  setTimeout(() => {
    document.getElementById('modeBarComp').style.width = modeProfile.competitive + '%';
    document.getElementById('modeBarHarv').style.width = modeProfile.harvard + '%';
    document.getElementById('modeBarCoerc').style.width = modeProfile.coercive + '%';
    document.getElementById('modePctComp').textContent = modeProfile.competitive + '%';
    document.getElementById('modePctHarv').textContent = modeProfile.harvard + '%';
    document.getElementById('modePctCoerc').textContent = modeProfile.coercive + '%';
  }, 300);

  const analyses = {
    competitive: `Vos choix montrent un négociateur à dominante compétitive (${modeProfile.competitive}%). Vous maximisez votre position en priorité. Efficace dans les transactions ponctuelles, mais laissez parfois des traces dans les relations durables.`,
    harvard: `Vous êtes un négociateur Harvard (${modeProfile.harvard}%). Vous cherchez instinctivement les solutions qui satisfont les deux parties. Vos accords durent dans le temps et vos relations sont préservées.`,
    coercive: `Votre profil coercitif (${modeProfile.coercive}%) est présent. Attention aux dommages relationnels — un accord forcé est rarement tenu avec enthousiasme. C'est une opportunité d'explorer les approches collaboratives.`
  };

  document.getElementById('modeAnalysis').textContent = analyses[dominant] || '';

  showView('view-mode-reveal');
}

// ── LANGUE & DEVISE ──────────────────────────────────
function updateLanguage(lang) {
  profile.language = lang;
  saveProfile();
  showToast('Langue mise à jour');
}

function updateCurrency(currency) {
  profile.currency = currency;
  saveProfile();
  showToast('Devise mise à jour');
}

// ── QUITTER ───────────────────────────────────────────
function confirmQuit() {
  if (confirm('Quitter cette partie ? Votre progression sera perdue.')) {
    game = null;
    goToMenu();
  }
}

function confirmReset() {
  if (confirm('Réinitialiser complètement votre profil ? Cette action est irréversible.')) {
    localStorage.removeItem('mn_profile_v3');
    profile = initDefaultProfile();
    saveProfile();
    showView('view-env-select');
  }
}

// ── REPLAY ────────────────────────────────────────────
function replayScenario() {
  if (!game) return;
  const type = game.scenarioType;
  // Si échec, badge persévérant
  const ctx = getCtx();
  if (game.outcome === 'fail') {
    ctx.justFailed = true;
    saveProfile();
  }
  selectScenario(type);
}

// ── VALIDATION CODE ENTREPRISE ────────────────────────
function showCodeEntry() {
  showView('view-code-entry');
}

function validateAccessCode() {
  const code = document.getElementById('accessCodeInput').value.trim().toUpperCase();
  if (code.length < 6) {
    document.getElementById('codeError').textContent = 'Code invalide — au moins 6 caractères requis.';
    document.getElementById('codeError').classList.remove('hidden');
    return;
  }

  document.getElementById('codeLoading').classList.remove('hidden');
  document.getElementById('codeError').classList.add('hidden');

  // Simulation : en version beta, on valide simplement avec un code de test
  // En production, cette fonction ferait un appel Supabase
  setTimeout(() => {
    document.getElementById('codeLoading').classList.add('hidden');
    // Code de test pour la demo
    if (code === 'DEMO2026' || code === 'TESTCODE') {
      activateDemoEnterprise(code);
    } else {
      document.getElementById('codeError').textContent = 'Code non reconnu. Vérifiez le code envoyé par votre gestionnaire.';
      document.getElementById('codeError').classList.remove('hidden');
    }
  }, 1200);
}

function activateDemoEnterprise(code) {
  profile.enterprise = {
    ...profile.enterprise,
    activated: true,
    companyId: 'demo',
    companyName: 'Entreprise Démo',
    managerId: 'demo-manager',
    accessCode: code,
    employeeFunction: 'Représentant Ventes',
    aiSummary: {
      sector: 'Technologie B2B',
      products: ['Logiciel SaaS', 'Solutions cloud'],
      clients: ['PME', 'Grands comptes'],
      vocabulary: ['ARR', 'churn', 'SLA', 'onboarding']
    }
  };
  currentContext = 'enterprise';
  profile.lastContext = 'enterprise';
  saveProfile();
  showView('view-menu');
  renderMenu();
  showToast('🏢 Espace Entreprise Démo activé !');
}
