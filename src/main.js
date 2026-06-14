const DIFFICULTIES = {
  easy: { label: 'Easy', minDivisor: 2, maxDivisor: 9, minQuotient: 12, maxQuotient: 99, maxRemainder: 8, blankRate: 0.35 },
  medium: { label: 'Medium', minDivisor: 3, maxDivisor: 24, minQuotient: 24, maxQuotient: 399, maxRemainder: 23, blankRate: 0.45 },
  hard: { label: 'Hard', minDivisor: 11, maxDivisor: 98, minQuotient: 101, maxQuotient: 999, maxRemainder: 97, blankRate: 0.55 },
};

const state = {
  difficulty: 'easy',
  answers: {},
  status: 'editing',
  puzzle: null,
  expectedDigits: null,
  activeInputId: null,
};

const app = document.getElementById('root');
const NUMBERPAD_MEDIA = '(min-width: 860px) and (orientation: landscape), (min-width: 1024px)';

function usesCustomNumberpad() {
  return window.matchMedia?.(NUMBERPAD_MEDIA).matches ?? false;
}

function shouldSuppressDeviceKeyboard() {
  const touchKeyboardLikely = window.matchMedia?.('(hover: none), (pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  return usesCustomNumberpad() && touchKeyboardLikely;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function token(id, digit, role) {
  return { id, digit: String(digit), role };
}

function makeWorkRows(dividend, divisor) {
  const digits = String(dividend).split('').map(Number);
  const width = digits.length;
  const quotientCells = Array(width).fill(null);
  const rows = [];
  let carried = 0;
  let started = false;

  digits.forEach((digit, column) => {
    const partial = carried * 10 + digit;
    const qDigit = Math.floor(partial / divisor);

    if (!started && qDigit === 0 && column < width - 1) {
      carried = partial;
      return;
    }

    started = true;
    quotientCells[column] = token(`q-${column}`, qDigit, 'quotient');
    const product = qDigit * divisor;
    const remainder = partial - product;
    const partialText = String(partial);
    const productText = String(product);
    const remainderText = String(remainder);
    const startColumn = Math.max(0, column - partialText.length + 1);
    const productStart = Math.max(0, column - productText.length + 1);

    const productRow = Array(width).fill(null);
    productText.split('').forEach((value, index) => {
      productRow[productStart + index] = token(`product-${column}-${index}`, value, 'product');
    });
    rows.push({ kind: 'product', cells: productRow });

    const lineRow = Array(width).fill(null);
    for (let index = Math.min(startColumn, productStart); index <= column; index += 1) {
      lineRow[index] = { id: `line-${column}-${index}`, mark: '−' };
    }
    rows.push({ kind: 'line', cells: lineRow });

    const hasNextDigit = column < width - 1;
    const remainderWithBringDown = hasNextDigit ? `${remainder === 0 ? '' : remainder}${digits[column + 1]}` : remainderText;
    const remainderEndColumn = hasNextDigit ? column + 1 : column;
    const remainderWithBringDownStart = Math.max(0, remainderEndColumn - remainderWithBringDown.length + 1);
    const remainderRow = Array(width).fill(null);
    remainderWithBringDown.split('').forEach((value, index) => {
      const role = hasNextDigit && index === remainderWithBringDown.length - 1 ? 'brought-down dividend' : column === width - 1 ? 'final remainder' : 'partial remainder';
      remainderRow[remainderWithBringDownStart + index] = token(`remainder-${column}-${index}`, value, role);
    });
    rows.push({ kind: 'number', cells: remainderRow });

    carried = remainder;
  });

  return { quotientCells, rows };
}

function pickBlanks(puzzle, rate) {
  const candidates = [];
  const collect = (cell) => {
    if (cell?.digit !== undefined) candidates.push(cell.id);
  };

  puzzle.divisorCells.forEach(collect);
  puzzle.dividendCells.forEach(collect);
  puzzle.quotientCells.forEach(collect);
  puzzle.rows.forEach((row) => row.cells.forEach(collect));

  const target = Math.max(6, Math.round(candidates.length * rate));
  const shuffled = [...new Set(candidates)].sort(() => Math.random() - 0.5);
  return new Set(shuffled.slice(0, Math.min(target, shuffled.length - 1)));
}

function makePuzzle(difficultyKey) {
  const settings = DIFFICULTIES[difficultyKey];
  const divisor = randomInt(settings.minDivisor, settings.maxDivisor);
  const quotient = randomInt(settings.minQuotient, settings.maxQuotient);
  const remainder = randomInt(0, Math.min(divisor - 1, settings.maxRemainder));
  const dividend = divisor * quotient + remainder;
  const dividendWidth = String(dividend).length;
  const work = makeWorkRows(dividend, divisor);
  const puzzle = {
    divisor,
    dividend,
    quotient,
    remainder,
    divisorCells: String(divisor).split('').map((digit, index) => token(`divisor-${index}`, digit, 'divisor')),
    dividendCells: String(dividend).split('').map((digit, index) => token(`dividend-${index}`, digit, 'dividend')),
    quotientCells: work.quotientCells,
    rows: work.rows,
    width: dividendWidth,
    blanks: new Set(),
  };
  puzzle.blanks = pickBlanks(puzzle, settings.blankRate);
  return puzzle;
}

function inputMarkup(cell) {
  const value = state.answers[cell.id] || '';
  const expected = state.expectedDigits?.get(cell.id);
  const checked = state.status === 'checked' ? (expected !== undefined && value === expected ? ' correct' : ' wrong') : '';
  const active = state.activeInputId === cell.id ? ' active' : '';
  const readonly = shouldSuppressDeviceKeyboard() ? ' readonly' : '';
  return `<input class="digit-input${checked}${active}" data-id="${cell.id}" type="tel" inputmode="numeric" pattern="[0-9]*" maxlength="1" autocomplete="off" enterkeyhint="done" aria-label="${cell.role} digit" value="${value}"${readonly}>`;
}

function cellMarkup(cell, extraClass = '') {
  const classSuffix = extraClass ? ` ${extraClass}` : '';
  if (!cell) return '<span class="cell empty"></span>';
  if (cell.mark) return `<span class="cell line-mark${classSuffix}">${cell.mark}</span>`;
  if (state.puzzle.blanks.has(cell.id)) return inputMarkup(cell).replace('digit-input', `digit-input${classSuffix}`);
  return `<span class="cell digit${classSuffix}">${cell.digit}</span>`;
}

function rowMarkup(cells, className = '') {
  const contents = cells.map((cell) => cellMarkup(cell)).join('');
  return `<div class="work-row ${className}" style="grid-template-columns: repeat(${state.puzzle.width}, var(--cell));">${contents}</div>`;
}

function render() {
  const puzzle = state.puzzle;
  app.innerHTML = `
    <main class="division-screen">
      <div class="stage">
      <div class="sheet" aria-label="Full long division puzzle">
        <div class="topbar">
          ${Object.entries(DIFFICULTIES).map(([key, setting]) => `<button class="mini ${key === state.difficulty ? 'active' : ''}" data-difficulty="${key}" type="button">${setting.label}</button>`).join('')}
        </div>
        <section class="division-problem">
          <div class="quotient-band">
            <span class="divisor-spacer"></span>
            ${rowMarkup(puzzle.quotientCells, 'quotient-row')}
          </div>
          <div class="bracket-band">
            <div class="divisor-area">${puzzle.divisorCells.map(cellMarkup).join('')}</div>
            <div class="dividend-area" style="grid-template-columns: repeat(${puzzle.width}, var(--cell));">${puzzle.dividendCells.map(cellMarkup).join('')}</div>
          </div>
          <div class="work-band">
            <span class="divisor-spacer"></span>
            <div class="rows">${puzzle.rows.map((row) => rowMarkup(row.cells, row.kind)).join('')}</div>
          </div>
        </section>
        <div class="feedback" aria-live="polite">${state.message || 'Fill in every box. It checks automatically.'}</div>
      </div>
      <aside class="numberpad" aria-label="Number pad">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((digit) => `<button type="button" data-pad="${digit}">${digit}</button>`).join('')}
      </aside>
      </div>
    </main>`;
}

function newPuzzle(difficulty = state.difficulty) {
  state.difficulty = difficulty;
  state.answers = {};
  state.status = 'editing';
  state.expectedDigits = null;
  state.activeInputId = null;
  state.message = 'Fill in every box. It checks automatically.';
  state.puzzle = makePuzzle(difficulty);
  render();
}

function checkAnswer() {
  const blanks = [...state.puzzle.blanks];
  if (blanks.some((id) => !state.answers[id])) {
    state.status = 'editing';
    state.expectedDigits = null;
    state.message = 'Fill in every box. It checks automatically.';
    return false;
  }

  state.status = 'checked';
  state.expectedDigits = expectedDigitsFromFilledProblem();
  if (state.expectedDigits && allRenderedDigitsMatch(state.expectedDigits)) {
    state.message = '👍 Correct! New puzzle coming up.';
    render();
    window.setTimeout(() => newPuzzle(), 900);
    return true;
  }

  state.message = 'Some boxes do not make a valid long division.';
  render();
  return false;
}

function valueForCell(cell) {
  if (!cell) return '';
  return state.puzzle.blanks.has(cell.id) ? state.answers[cell.id] || '' : cell.digit;
}

function numberFromCells(cells) {
  const text = cells.map(valueForCell).join('').replace(/^0+(?=\d)/, '');
  return text === '' ? NaN : Number(text);
}

function collectExpectedDigits(puzzle) {
  const expected = new Map();
  const collect = (cell) => {
    if (cell?.digit !== undefined) expected.set(cell.id, cell.digit);
  };
  puzzle.divisorCells.forEach(collect);
  puzzle.dividendCells.forEach(collect);
  puzzle.quotientCells.forEach(collect);
  puzzle.rows.forEach((row) => row.cells.forEach(collect));
  return expected;
}

function expectedDigitsFromFilledProblem() {
  const divisor = numberFromCells(state.puzzle.divisorCells);
  const dividend = numberFromCells(state.puzzle.dividendCells);
  const quotient = numberFromCells(state.puzzle.quotientCells);
  if (!Number.isInteger(divisor) || !Number.isInteger(dividend) || !Number.isInteger(quotient) || divisor <= 0) return null;
  if (Math.floor(dividend / divisor) !== quotient) return null;

  const expectedWork = makeWorkRows(dividend, divisor);
  const expectedPuzzle = {
    divisorCells: String(divisor).split('').map((digit, index) => token(`divisor-${index}`, digit, 'divisor')),
    dividendCells: String(dividend).split('').map((digit, index) => token(`dividend-${index}`, digit, 'dividend')),
    quotientCells: expectedWork.quotientCells,
    rows: expectedWork.rows,
  };
  return collectExpectedDigits(expectedPuzzle);
}

function allRenderedDigitsMatch(expected) {
  const currentCells = [
    ...state.puzzle.divisorCells,
    ...state.puzzle.dividendCells,
    ...state.puzzle.quotientCells,
    ...state.puzzle.rows.flatMap((row) => row.cells),
  ].filter((cell) => cell?.digit !== undefined);

  return currentCells.every((cell) => expected.get(cell.id) === valueForCell(cell));
}

app.addEventListener('click', (event) => {
  const difficulty = event.target.closest('[data-difficulty]')?.dataset.difficulty;
  const padDigit = event.target.closest('[data-pad]')?.dataset.pad;
  if (difficulty) newPuzzle(difficulty);
  if (padDigit !== undefined && state.activeInputId) {
    fillDigit(state.activeInputId, padDigit);
    state.activeInputId = null;
    render();
  }
});

function fillDigit(id, digit) {
  state.answers[id] = String(digit).replace(/\D/g, '').slice(-1);
  state.status = 'editing';
  state.expectedDigits = null;
  state.message = 'Fill in every box. It checks automatically.';
  return checkAnswer();
}

app.addEventListener('input', (event) => {
  if (!event.target.matches('.digit-input')) return;
  const id = event.target.dataset.id;
  fillDigit(id, event.target.value);
  event.target.value = state.answers[id];
  if (state.answers[id]) {
    state.activeInputId = null;
    event.target.blur();
  }
});

app.addEventListener('focusin', (event) => {
  if (!event.target.matches('.digit-input')) return;
  state.activeInputId = event.target.dataset.id;
  document.querySelectorAll('.digit-input.active').forEach((input) => input.classList.remove('active'));
  event.target.classList.add('active');
  event.target.select();
});

window.matchMedia?.(NUMBERPAD_MEDIA).addEventListener?.('change', () => {
  if (state.puzzle) render();
});

newPuzzle();
