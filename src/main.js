const DIFFICULTIES = {
  easy: { label: 'Easy', minDivisor: 2, maxDivisor: 9, minQuotient: 12, maxQuotient: 99, blankRate: 0.38 },
  medium: { label: 'Medium', minDivisor: 3, maxDivisor: 24, minQuotient: 24, maxQuotient: 399, blankRate: 0.46 },
  hard: { label: 'Hard', minDivisor: 11, maxDivisor: 98, minQuotient: 101, maxQuotient: 999, blankRate: 0.54 },
};

const state = {
  difficulty: 'easy',
  answers: {},
  status: 'editing',
  solved: 0,
  message: 'Fill every blank box, then check your answer.',
  puzzle: null,
};

const app = document.getElementById('root');

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickBlanks(values, rate) {
  const digitIndexes = values
    .map((item, index) => (item.type === 'digit' ? index : null))
    .filter((index) => index !== null);
  const blankCount = Math.max(3, Math.round(digitIndexes.length * rate));
  const shuffled = [...digitIndexes].sort(() => Math.random() - 0.5);
  return new Set(shuffled.slice(0, Math.min(blankCount, digitIndexes.length - 1)));
}

function makePuzzle(difficultyKey) {
  const settings = DIFFICULTIES[difficultyKey];
  const divisor = randomInt(settings.minDivisor, settings.maxDivisor);
  const quotient = randomInt(settings.minQuotient, settings.maxQuotient);
  const dividend = divisor * quotient;
  const remainder = 0;
  const tokens = [
    { label: 'divisor', value: String(divisor) },
    { label: 'dividend', value: String(dividend) },
    { label: 'quotient', value: String(quotient) },
    { label: 'remainder', value: String(remainder) },
  ].flatMap((group, groupIndex) => [
    ...group.value.split('').map((digit) => ({ type: 'digit', digit, group: group.label })),
    ...(groupIndex < 3 ? [{ type: 'separator' }] : []),
  ]);

  return { divisor, dividend, quotient, remainder, tokens, blankIndexes: pickBlanks(tokens, settings.blankRate) };
}

function digitMarkup(group) {
  return state.puzzle.tokens.map((token, index) => {
    if (token.type !== 'digit' || token.group !== group) return '';
    if (!state.puzzle.blankIndexes.has(index)) return `<span class="digit">${token.digit}</span>`;
    const value = state.answers[index] || '';
    const checkedClass = state.status === 'checked' ? (value === token.digit ? ' correct' : ' wrong') : '';
    return `<input class="digit-input${checkedClass}" data-index="${index}" inputmode="numeric" pattern="[0-9]*" maxlength="1" aria-label="Blank digit ${index + 1}" value="${value}">`;
  }).join('');
}

function render() {
  app.innerHTML = `
    <main class="app-shell">
      <header class="hero">
        <p class="eyebrow">Mobile math practice</p>
        <h1>Long Division Digit Puzzles</h1>
        <p>Complete the hidden digits in the dividend, divisor, quotient, and remainder. A correct solution automatically advances to the next puzzle.</p>
      </header>
      <section class="controls" aria-label="Puzzle settings">
        ${Object.entries(DIFFICULTIES).map(([key, setting]) => `
          <button class="${key === state.difficulty ? 'active' : ''}" type="button" data-difficulty="${key}">${setting.label}</button>
        `).join('')}
      </section>
      <section class="puzzle-card" aria-label="Long division puzzle">
        <div class="equation-header">
          <span>${digitMarkup('dividend')}</span><span>÷</span><span>${digitMarkup('divisor')}</span><span>=</span><span>${digitMarkup('quotient')}</span><span>R</span><span>${digitMarkup('remainder')}</span>
        </div>
        <div class="division-layout">
          <div class="quotient-row">${digitMarkup('quotient')}</div>
          <div class="work-row">
            <div class="divisor-box">${digitMarkup('divisor')}</div>
            <div class="dividend-box">${digitMarkup('dividend')}</div>
          </div>
          <div class="remainder-row">Remainder ${digitMarkup('remainder')}</div>
        </div>
      </section>
      <section class="action-panel" aria-live="polite">
        <p class="${state.status === 'checked' ? 'feedback checked' : 'feedback'}">${state.message}</p>
        <div class="button-row">
          <button class="primary" type="button" data-action="check">Check answer</button>
          <button class="secondary" type="button" data-action="skip">Skip</button>
        </div>
        <p class="score">Solved this session: <strong>${state.solved}</strong></p>
      </section>
    </main>`;
}

function newPuzzle(difficulty = state.difficulty) {
  state.difficulty = difficulty;
  state.answers = {};
  state.status = 'editing';
  state.message = 'Fill every blank box, then check your answer.';
  state.puzzle = makePuzzle(difficulty);
  render();
}

function checkAnswer() {
  const blanks = [...state.puzzle.blankIndexes];
  const missing = blanks.some((index) => !state.answers[index]);
  state.status = 'checked';
  if (missing) {
    state.message = 'Some boxes are still empty. Add a digit to every blank.';
  } else if (blanks.every((index) => state.answers[index] === state.puzzle.tokens[index].digit)) {
    state.solved += 1;
    state.message = 'Correct! Loading a fresh puzzle...';
    render();
    window.setTimeout(() => newPuzzle(), 900);
    return;
  } else {
    state.message = 'Not quite yet. Red boxes need another digit.';
  }
  render();
}

app.addEventListener('click', (event) => {
  const difficulty = event.target.closest('[data-difficulty]')?.dataset.difficulty;
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (difficulty) newPuzzle(difficulty);
  if (action === 'skip') newPuzzle();
  if (action === 'check') checkAnswer();
});

app.addEventListener('input', (event) => {
  if (!event.target.matches('.digit-input')) return;
  const index = Number(event.target.dataset.index);
  state.answers[index] = event.target.value.replace(/\D/g, '').slice(-1);
  event.target.value = state.answers[index];
  if (state.answers[index]) {
    const blanks = [...state.puzzle.blankIndexes];
    const next = blanks[blanks.indexOf(index) + 1];
    document.querySelector(`[data-index="${next}"]`)?.focus();
  }
});

newPuzzle();
