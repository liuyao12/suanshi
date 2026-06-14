const DIFFICULTIES = {
  easy: { label: 'Easy', minDivisor: 2, maxDivisor: 9, minQuotient: 12, maxQuotient: 99, maxRemainder: 8, blankCount: 5, decimal: false },
  medium: { label: 'Medium', minDivisor: 3, maxDivisor: 24, minQuotient: 24, maxQuotient: 399, maxRemainder: 23, blankCount: 9, decimal: false },
  hard: { label: 'Hard', minDivisor: 3, maxDivisor: 24, minQuotient: 24, maxQuotient: 399, maxRemainder: 23, blankCount: 14, decimal: true },
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

function gcd(a, b) {
  return b === 0 ? Math.abs(a) : gcd(b, a % b);
}

function hasRepeatingDecimal(divisor, remainder) {
  let reduced = divisor / gcd(divisor, remainder);
  while (reduced % 2 === 0) reduced /= 2;
  while (reduced % 5 === 0) reduced /= 5;
  return reduced !== 1;
}

function token(id, digit, role) {
  return { id, digit: String(digit), role };
}

function makeWorkRows(dividend, divisor, allowDecimal = false) {
  const dividendDigits = String(dividend).split('').map(Number);
  const quotientCells = [];
  const dividendCells = String(dividend).split('').map((digit, index) => token(`dividend-${index}`, digit, 'dividend'));
  const rows = [];
  const seenDecimalRemainders = new Map();
  let carried = 0;
  let started = false;
  let column = -1;

  function ensureColumn() {
    column += 1;
    rows.forEach((row) => row.cells.push(null));
    quotientCells.push(null);
    return column;
  }

  function addStep(partial, qDigit, product, remainder, currentColumn, nextDigit, repeating) {
    const width = quotientCells.length;
    const partialText = String(partial);
    const productText = String(product);
    const startColumn = Math.max(0, currentColumn - partialText.length + 1);
    const productStart = Math.max(0, currentColumn - productText.length + 1);

    const productRow = Array(width).fill(null);
    productText.split('').forEach((value, index) => {
      productRow[productStart + index] = token(`product-${currentColumn}-${index}`, value, 'product');
    });
    rows.push({ kind: 'product', cells: productRow });

    const lineRow = Array(width).fill(null);
    for (let index = Math.min(startColumn, productStart); index <= currentColumn; index += 1) {
      lineRow[index] = { id: `line-${currentColumn}-${index}`, mark: '−' };
    }
    rows.push({ kind: 'line', cells: lineRow });

    const remainderText = nextDigit === undefined ? String(remainder) : `${remainder === 0 ? '' : remainder}${nextDigit}`;
    const remainderEndColumn = nextDigit === undefined ? currentColumn : currentColumn + 1;
    const remainderStart = Math.max(0, remainderEndColumn - remainderText.length + 1);
    const remainderRow = Array(width).fill(null);
    while (remainderRow.length <= remainderEndColumn) remainderRow.push(null);
    remainderText.split('').forEach((value, index) => {
      const isBroughtDown = nextDigit !== undefined && index === remainderText.length - 1;
      const role = isBroughtDown ? 'brought-down dividend' : repeating ? 'repeating remainder' : 'partial remainder';
      const cell = token(`remainder-${currentColumn}-${index}`, value, role);
      if (repeating && !isBroughtDown) cell.repeating = true;
      remainderRow[remainderStart + index] = cell;
    });
    rows.push({ kind: repeating ? 'repeat number' : 'number', cells: remainderRow });
  }

  dividendDigits.forEach((digit, digitIndex) => {
    const currentColumn = ensureColumn();
    const partial = carried * 10 + digit;
    const qDigit = Math.floor(partial / divisor);
    if (!started && qDigit === 0 && digitIndex < dividendDigits.length - 1) {
      carried = partial;
      return;
    }

    started = true;
    quotientCells[currentColumn] = token(`q-${currentColumn}`, qDigit, 'quotient');
    const product = qDigit * divisor;
    const remainder = partial - product;
    const nextDigit = digitIndex < dividendDigits.length - 1 ? dividendDigits[digitIndex + 1] : undefined;
    addStep(partial, qDigit, product, remainder, currentColumn, nextDigit, false);
    carried = remainder;
  });

  if (allowDecimal && carried !== 0) {
    const decimalColumn = ensureColumn();
    quotientCells[decimalColumn] = { id: 'q-decimal', mark: '.', role: 'decimal point' };
    dividendCells.push({ id: 'dividend-decimal', mark: '.', role: 'decimal point' });

    for (let guard = 0; guard < 64 && carried !== 0; guard += 1) {
      const decimalDigitColumn = ensureColumn();
      dividendCells.push(token(`dividend-zero-${guard}`, 0, 'added decimal zero'));
      const partial = carried * 10;
      const qDigit = Math.floor(partial / divisor);
      quotientCells[decimalDigitColumn] = token(`q-${decimalDigitColumn}`, qDigit, 'decimal quotient');
      const product = qDigit * divisor;
      const remainder = partial - product;
      const nextDigit = remainder === 0 ? undefined : 0;
      addStep(partial, qDigit, product, remainder, decimalDigitColumn, nextDigit, false);

      if (remainder !== 0) {
        const currentRowIndex = rows.length - 1;
        if (seenDecimalRemainders.has(remainder)) {
          const previousRowIndex = seenDecimalRemainders.get(remainder);
          [previousRowIndex, currentRowIndex].forEach((rowIndex) => {
            rows[rowIndex].kind = 'repeat number';
            rows[rowIndex].cells.forEach((cell) => {
              if (cell?.digit !== undefined) cell.repeating = true;
            });
          });
          break;
        }
        seenDecimalRemainders.set(remainder, currentRowIndex);
      }

      carried = remainder;
    }
  }

  const width = Math.max(quotientCells.length, dividendCells.length, ...rows.map((row) => row.cells.length));
  return { quotientCells, dividendCells, rows, width };
}

function pickBlanks(puzzle, blankCount) {
  const candidates = [];
  const collect = (cell) => {
    if (cell?.digit !== undefined) candidates.push(cell.id);
  };

  puzzle.divisorCells.forEach(collect);
  puzzle.dividendCells.forEach(collect);
  puzzle.quotientCells.forEach(collect);
  puzzle.rows.forEach((row) => row.cells.forEach(collect));

  const target = blankCount;
  const shuffled = [...new Set(candidates)].sort(() => Math.random() - 0.5);
  return new Set(shuffled.slice(0, Math.min(target, shuffled.length - 1)));
}

function makePuzzle(difficultyKey) {
  const settings = DIFFICULTIES[difficultyKey];
  let divisor = randomInt(settings.minDivisor, settings.maxDivisor);
  let quotient = randomInt(settings.minQuotient, settings.maxQuotient);
  let remainder = settings.decimal ? randomInt(1, Math.min(divisor - 1, settings.maxRemainder)) : randomInt(0, Math.min(divisor - 1, settings.maxRemainder));
  for (let attempt = 0; settings.decimal && attempt < 100 && !hasRepeatingDecimal(divisor, remainder); attempt += 1) {
    divisor = randomInt(settings.minDivisor, settings.maxDivisor);
    quotient = randomInt(settings.minQuotient, settings.maxQuotient);
    remainder = randomInt(1, Math.min(divisor - 1, settings.maxRemainder));
  }
  const dividend = divisor * quotient + remainder;
  const work = makeWorkRows(dividend, divisor, settings.decimal);
  const puzzle = {
    divisor,
    dividend,
    quotient,
    remainder,
    divisorCells: String(divisor).split('').map((digit, index) => token(`divisor-${index}`, digit, 'divisor')),
    dividendCells: work.dividendCells,
    quotientCells: work.quotientCells,
    rows: work.rows,
    width: work.width,
    blanks: new Set(),
  };
  puzzle.blanks = pickBlanks(puzzle, settings.blankCount);
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
  const repeatingClass = cell?.repeating ? ' repeating' : '';
  const classSuffix = `${extraClass ? ` ${extraClass}` : ''}${repeatingClass}`;
  if (!cell) return '<span class="cell empty"></span>';
  if (cell.mark === '.') return `<span class="cell digit decimal-point${classSuffix}">.</span>`;
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
          <div class="segmented" aria-label="Difficulty">
            ${Object.entries(DIFFICULTIES).map(([key, setting]) => `<button class="mini ${key === state.difficulty ? 'active' : ''}" data-difficulty="${key}" type="button">${setting.label}</button>`).join('')}
          </div>
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

function numberFromCells(cells, roles = null) {
  const selected = roles ? cells.filter((cell) => roles.has(cell?.role)) : cells;
  const text = selected.map(valueForCell).join('').replace(/^0+(?=\d)/, '');
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
  const dividend = numberFromCells(state.puzzle.dividendCells, new Set(['dividend']));
  if (!Number.isInteger(divisor) || !Number.isInteger(dividend) || divisor <= 0) return null;

  const expectedWork = makeWorkRows(dividend, divisor, state.puzzle.quotientCells.some((cell) => cell?.mark === '.'));
  const expectedPuzzle = {
    divisorCells: String(divisor).split('').map((digit, index) => token(`divisor-${index}`, digit, 'divisor')),
    dividendCells: expectedWork.dividendCells,
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
