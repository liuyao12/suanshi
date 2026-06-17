const DIFFICULTIES = {
  easy: { label: 'Easy', minDivisor: 2, maxDivisor: 9, minQuotient: 12, maxQuotient: 99, maxRemainder: 8, blankCount: 5, letterGroupCount: 2 },
  medium: { label: 'Medium', minDivisor: 3, maxDivisor: 24, minQuotient: 24, maxQuotient: 399, maxRemainder: 23, blankCount: 9, letterGroupCount: 3 },
  hard: { label: 'Hard', minDivisor: 11, maxDivisor: 98, minQuotient: 101, maxQuotient: 999, maxRemainder: 97, blankCount: 14, letterGroupCount: 4 },
};

const state = {
  difficulty: 'easy',
  problemType: 'classic',
  answers: {},
  status: 'editing',
  puzzle: null,
  expectedDigits: null,
  activeInputId: null,
};

const app = document.getElementById('root');
const NUMBERPAD_MEDIA = '(min-width: 860px) and (orientation: landscape), (min-width: 1024px)';
const PROBLEM_TYPES = {
  classic: { label: 'Long division' },
  letters: { label: 'Letter puzzle' },
};

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
  const dividendCells = String(dividend).split('').map((digit, index) => token(`dividend-${index}`, digit, 'dividend'));
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
    const remainderText = hasNextDigit ? `${remainder === 0 ? '' : remainder}${digits[column + 1]}` : String(remainder);
    const remainderEndColumn = hasNextDigit ? column + 1 : column;
    const remainderStart = Math.max(0, remainderEndColumn - remainderText.length + 1);
    const remainderRow = Array(width).fill(null);
    remainderText.split('').forEach((value, index) => {
      const role = hasNextDigit && index === remainderText.length - 1 ? 'brought-down dividend' : column === width - 1 ? 'final remainder' : 'partial remainder';
      remainderRow[remainderStart + index] = token(`remainder-${column}-${index}`, value, role);
    });
    rows.push({ kind: 'number', cells: remainderRow });
    carried = remainder;
  });

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


function pickLetterBlanks(puzzle, letterGroupCount) {
  const candidatesByDigit = new Map();
  const collect = (cell) => {
    if (cell?.digit === undefined) return;
    if (!candidatesByDigit.has(cell.digit)) candidatesByDigit.set(cell.digit, []);
    candidatesByDigit.get(cell.digit).push(cell.id);
  };

  if (puzzle.layout === 'arithmetic') {
    puzzle.leftCells.forEach(collect);
    puzzle.rightCells.forEach(collect);
    puzzle.resultCells.forEach(collect);
  } else {
    puzzle.quotientCells.forEach(collect);
    puzzle.rows.forEach((row) => row.cells.forEach(collect));
  }

  const rankedDigits = [...candidatesByDigit.entries()]
    .sort((left, right) => right[1].length - left[1].length || Math.random() - 0.5)
    .map(([digit]) => digit);
  const selectedDigits = rankedDigits.slice(0, Math.min(letterGroupCount, rankedDigits.length));
  return new Set(selectedDigits.flatMap((digit) => candidatesByDigit.get(digit)));
}

function arithmeticToken(prefix, value) {
  return String(value).split('').map((digit, index) => token(`${prefix}-${index}`, digit, prefix));
}

function padCells(cells, width) {
  return [...Array(Math.max(0, width - cells.length)).fill(null), ...cells];
}

function makeArithmeticPuzzle(settings) {
  const operation = Math.random() < 0.5 ? 'addition' : 'multiplication';
  const maxOperand = settings.label === 'Easy' ? 99 : settings.label === 'Medium' ? 399 : 999;
  const minOperand = settings.label === 'Easy' ? 12 : settings.label === 'Medium' ? 24 : 101;
  const left = randomInt(minOperand, maxOperand);
  const right = operation === 'addition'
    ? randomInt(minOperand, maxOperand)
    : randomInt(settings.label === 'Easy' ? 2 : 6, settings.label === 'Medium' ? 12 : 24);
  const result = operation === 'addition' ? left + right : left * right;
  const width = Math.max(String(left).length, String(right).length + 1, String(result).length);
  return {
    layout: 'arithmetic',
    operation,
    operator: operation === 'addition' ? '+' : '×',
    leftCells: padCells(arithmeticToken('left', left), width),
    rightCells: padCells(arithmeticToken('right', right), width - 1),
    resultCells: padCells(arithmeticToken('result', result), width),
    width,
    blanks: new Set(),
  };
}

function makeDivisionPuzzle(settings) {
  const divisor = randomInt(settings.minDivisor, settings.maxDivisor);
  const quotient = randomInt(settings.minQuotient, settings.maxQuotient);
  const remainder = randomInt(0, Math.min(divisor - 1, settings.maxRemainder));
  const dividend = divisor * quotient + remainder;
  const work = makeWorkRows(dividend, divisor);
  const puzzle = {
    layout: 'division',
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
  return puzzle;
}

function makePuzzle(difficultyKey, problemType = 'classic') {
  const settings = DIFFICULTIES[difficultyKey];
  const puzzle = problemType === 'letters' && Math.random() < 0.66
    ? makeArithmeticPuzzle(settings)
    : makeDivisionPuzzle(settings);
  puzzle.blanks = puzzle.layout === 'arithmetic'
    ? pickLetterBlanks(puzzle, settings.letterGroupCount)
    : problemType === 'letters'
      ? pickLetterBlanks(puzzle, settings.letterGroupCount)
      : pickBlanks(puzzle, settings.blankCount);
  puzzle.blanksById = new Map();
  collectExpectedDigits(puzzle).forEach((digit, id) => {
    if (puzzle.blanks.has(id)) puzzle.blanksById.set(id, digit);
  });
  return puzzle;
}

const DIGIT_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K'];

function letterForDigit(digit) {
  return DIGIT_LETTERS[Number(digit)] ?? '';
}

function digitGroupClassForCell(cell) {
  return state.problemType === 'letters' && state.puzzle.blanks.has(cell.id) ? ` digit-code-${cell.digit}` : '';
}

function inputMarkup(cell) {
  const value = state.answers[cell.id] || '';
  const expected = state.expectedDigits?.get(cell.id);
  const checked = state.status === 'checked' ? (expected !== undefined && value === expected ? ' correct' : ' wrong') : '';
  const active = state.activeInputId === cell.id ? ' active' : '';
  const readonly = shouldSuppressDeviceKeyboard() ? ' readonly' : '';
  const digitGroup = digitGroupClassForCell(cell);
  const groupLetter = letterForDigit(cell.digit);
  const placeholder = digitGroup ? ` placeholder="${groupLetter}" title="${groupLetter} represents one digit"` : '';
  return `<input class="digit-input${checked}${active}${digitGroup}" data-id="${cell.id}" data-digit-letter="${groupLetter}" type="tel" inputmode="numeric" pattern="[0-9]*" maxlength="1" autocomplete="off" enterkeyhint="done" aria-label="${digitGroup ? `${groupLetter} coded ` : ''}${cell.role} digit" value="${value}"${placeholder}${readonly}>`;
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
  return `<div class="work-row ${className}" style="grid-template-columns: repeat(${cells.length}, var(--cell));">${contents}</div>`;
}

function divisionMarkup(puzzle) {
  return `<section class="division-problem">
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
  </section>`;
}

function arithmeticMarkup(puzzle) {
  return `<section class="division-problem arithmetic-problem" aria-label="${puzzle.operation} puzzle">
    ${rowMarkup(puzzle.leftCells, 'arithmetic-row')}
    <div class="arithmetic-line">
      <span class="operator">${puzzle.operator}</span>
      ${rowMarkup(puzzle.rightCells, 'arithmetic-row')}
    </div>
    <div class="answer-line" style="width: calc(${puzzle.width} * var(--cell));"></div>
    ${rowMarkup(puzzle.resultCells, 'arithmetic-row')}
  </section>`;
}

function render() {
  const puzzle = state.puzzle;
  app.innerHTML = `
    <main class="division-screen">
      <div class="stage">
      <div class="sheet" aria-label="Arithmetic puzzle">
        <div class="topbar">
          <div class="segmented" aria-label="Problem type">
            ${Object.entries(PROBLEM_TYPES).map(([key, setting]) => `<button class="mini ${key === state.problemType ? 'active' : ''}" data-type="${key}" type="button">${setting.label}</button>`).join('')}
          </div>
          <div class="segmented" aria-label="Difficulty">
            ${Object.entries(DIFFICULTIES).map(([key, setting]) => `<button class="mini ${key === state.difficulty ? 'active' : ''}" data-difficulty="${key}" type="button">${setting.label}</button>`).join('')}
          </div>
        </div>
        ${puzzle.layout === 'arithmetic' ? arithmeticMarkup(puzzle) : divisionMarkup(puzzle)}
        <div class="feedback" aria-live="polite">${state.message || 'Fill in every box. It checks automatically.'}</div>
      </div>
      <aside class="numberpad" aria-label="Number pad">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((digit) => `<button type="button" data-pad="${digit}" ${isDigitUnavailable(digit) ? 'disabled aria-disabled="true"' : ''}>${digit}</button>`).join('')}
      </aside>
      </div>
    </main>`;
}

function usedDigits() {
  return new Set(Object.values(state.answers).filter(Boolean));
}

function isDigitUnavailable(digit) {
  return state.problemType === 'letters' && usedDigits().has(String(digit));
}

function newPuzzle(difficulty = state.difficulty) {
  state.difficulty = difficulty;
  state.answers = {};
  state.status = 'editing';
  state.expectedDigits = null;
  state.activeInputId = null;
  state.message = helpMessage();
  state.puzzle = makePuzzle(difficulty, state.problemType);
  render();
}

function checkAnswer() {
  const blanks = [...state.puzzle.blanks];
  if (blanks.some((id) => !state.answers[id])) {
    state.status = 'editing';
    state.expectedDigits = null;
    state.message = helpMessage();
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

  state.message = 'Some boxes do not make a valid equation.';
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
  if (puzzle.layout === 'arithmetic') {
    puzzle.leftCells.forEach(collect);
    puzzle.rightCells.forEach(collect);
    puzzle.resultCells.forEach(collect);
  } else {
    puzzle.divisorCells.forEach(collect);
    puzzle.dividendCells.forEach(collect);
    puzzle.quotientCells.forEach(collect);
    puzzle.rows.forEach((row) => row.cells.forEach(collect));
  }
  return expected;
}

function expectedDigitsFromFilledProblem() {
  if (state.puzzle.layout === 'arithmetic') return collectExpectedDigits(state.puzzle);
  const divisor = numberFromCells(state.puzzle.divisorCells);
  const dividend = numberFromCells(state.puzzle.dividendCells, new Set(['dividend']));
  if (!Number.isInteger(divisor) || !Number.isInteger(dividend) || divisor <= 0) return null;

  const expectedWork = makeWorkRows(dividend, divisor);
  const expectedPuzzle = {
    layout: 'division',
    divisorCells: String(divisor).split('').map((digit, index) => token(`divisor-${index}`, digit, 'divisor')),
    dividendCells: expectedWork.dividendCells,
    quotientCells: expectedWork.quotientCells,
    rows: expectedWork.rows,
  };
  return collectExpectedDigits(expectedPuzzle);
}

function allRenderedDigitsMatch(expected) {
  const currentCells = (state.puzzle.layout === 'arithmetic'
    ? [
      ...state.puzzle.leftCells,
      ...state.puzzle.rightCells,
      ...state.puzzle.resultCells,
    ]
    : [
      ...state.puzzle.divisorCells,
      ...state.puzzle.dividendCells,
      ...state.puzzle.quotientCells,
      ...state.puzzle.rows.flatMap((row) => row.cells),
    ]).filter((cell) => cell?.digit !== undefined);

  return currentCells.every((cell) => expected.get(cell.id) === valueForCell(cell));
}

app.addEventListener('click', (event) => {
  const difficulty = event.target.closest('[data-difficulty]')?.dataset.difficulty;
  const type = event.target.closest('[data-type]')?.dataset.type;
  const padButton = event.target.closest('[data-pad]');
  const padDigit = padButton?.dataset.pad;
  if (type) newPuzzleWithType(type);
  if (difficulty) newPuzzle(difficulty);
  if (padDigit !== undefined && state.activeInputId && !padButton.disabled) {
    fillDigit(state.activeInputId, padDigit);
    state.activeInputId = null;
    render();
  }
});

function helpMessage() {
  return state.problemType === 'letters'
    ? 'Use the letters to identify each digit. Same letters share a digit.'
    : 'Fill in every box. It checks automatically.';
}

function newPuzzleWithType(type) {
  state.problemType = type;
  newPuzzle();
}

function fillDigit(id, digit) {
  const nextDigit = String(digit).replace(/\D/g, '').slice(-1);
  const codedDigit = state.problemType === 'letters' && state.puzzle.blanks.has(id) ? state.puzzle.blanksById.get(id) : null;
  if (!nextDigit && state.problemType === 'letters') {
    [...state.puzzle.blanks].forEach((blankId) => {
      if (state.puzzle.blanksById.get(blankId) === codedDigit) state.answers[blankId] = '';
    });
  } else if (!nextDigit) {
    state.answers[id] = '';
  } else if (state.problemType === 'letters' && isDigitUnavailable(nextDigit) && state.answers[id] !== nextDigit) {
    render();
    return false;
  } else if (state.problemType === 'letters') {
    [...state.puzzle.blanks].forEach((blankId) => {
      if (state.puzzle.blanksById.get(blankId) === codedDigit) state.answers[blankId] = nextDigit;
    });
  } else {
    state.answers[id] = nextDigit;
  }
  state.status = 'editing';
  state.expectedDigits = null;
  state.message = helpMessage();
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
