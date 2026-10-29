'use strict';

const STORAGE_KEY = 'mintVocab_toeic_v3';
const LEGACY_KEYS = ['toeicVocabApp_v2'];

const SAMPLE_WORDS = [
  {
    id: 'sample-submit-20261028',
    english: 'Submit',
    type: 'Động từ (Verb)',
    pronunciation: '/səbˈmɪt/',
    meaning: 'nộp bài, đệ trình',
    studyDate: '2026-10-28',
    examples: [
      {
        english: 'Please submit your report by Friday.',
        vietnamese: 'Vui lòng nộp báo cáo của bạn trước thứ Sáu.'
      },
      {
        english: 'You must submit the application online.',
        vietnamese: 'Bạn phải nộp đơn đăng ký trực tuyến.'
      },
      {
        english: 'Employees should submit their expenses every month.',
        vietnamese: 'Nhân viên nên nộp các khoản chi phí của mình mỗi tháng.'
      }
    ],
    createdAt: '2026-10-28T08:00:00.000Z'
  }
];

const $ = id => document.getElementById(id);

let words = loadWords();
let editingWordId = null;
let pendingDeleteWordId = null;
let activeGameType = 'word';
let gameQuestions = [];
let gameIndex = 0;
let correctCount = 0;
let answered = false;
let gameResults = [];
let toastTimer = null;

const form = $('vocabForm');
const exampleFields = $('exampleFields');
const editExampleFields = $('editExampleFields');

function localDateString(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
}

$('studyDate').value = localDateString();

function normalizeExamples(word) {
  if (Array.isArray(word.examples)) {
    return word.examples
      .filter(example => example && typeof example.english === 'string')
      .map(example => ({
        english: example.english.trim(),
        vietnamese: typeof example.vietnamese === 'string'
          ? example.vietnamese.trim()
          : ''
      }))
      .filter(example => example.english);
  }

  const oldExample = typeof word.example === 'string'
    ? word.example.trim()
    : '';

  return oldExample
    ? [{ english: oldExample, vietnamese: '' }]
    : [];
}

function normalizeWord(word) {
  if (
    !word ||
    typeof word !== 'object' ||
    typeof word.english !== 'string' ||
    typeof word.meaning !== 'string' ||
    typeof word.studyDate !== 'string'
  ) {
    return null;
  }

  return {
    id: typeof word.id === 'string'
      ? word.id
      : `import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    english: word.english.trim(),
    type: typeof word.type === 'string'
      ? word.type
      : 'Khác (Other)',
    pronunciation: typeof word.pronunciation === 'string'
      ? word.pronunciation
      : '',
    meaning: word.meaning.trim(),
    studyDate: word.studyDate,
    examples: normalizeExamples(word),
    createdAt: word.createdAt || new Date().toISOString()
  };
}

function loadWords() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed.map(normalizeWord).filter(Boolean);
      }
    }

    for (const oldKey of LEGACY_KEYS) {
      const oldSaved = localStorage.getItem(oldKey);
      if (!oldSaved) continue;

      const oldParsed = JSON.parse(oldSaved);

      if (Array.isArray(oldParsed)) {
        const migrated = oldParsed.map(normalizeWord).filter(Boolean);

        if (migrated.length) {
          const sample = normalizeWord(SAMPLE_WORDS[0]);

          const existingIndex = migrated.findIndex(word =>
            word.english.toLowerCase() === 'submit' &&
            word.studyDate === '2026-10-28'
          );

          if (existingIndex >= 0) {
            migrated[existingIndex] = {
              ...migrated[existingIndex],
              examples: sample.examples
            };
          } else {
            migrated.push(sample);
          }

          localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
          return migrated;
        }
      }
    }

    const initialWords = SAMPLE_WORDS.map(normalizeWord).filter(Boolean);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initialWords));
    return initialWords;
  } catch (error) {
    console.error('Không thể đọc dữ liệu:', error);
    return SAMPLE_WORDS.map(normalizeWord).filter(Boolean);
  }
}

function saveWords() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
    return true;
  } catch (error) {
    console.error('Không thể lưu dữ liệu:', error);
    showToast('Không lưu được dữ liệu. Hãy kiểm tra bộ nhớ trình duyệt.', true);
    return false;
  }
}

function el(tag, className, text) {
  const node = document.createElement(tag);

  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;

  return node;
}

function formatDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
    return 'Ngày chưa xác định';
  }

  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

function sortedDates() {
  return [...new Set(words.map(word => word.studyDate).filter(Boolean))]
    .sort((a, b) => b.localeCompare(a));
}

function showToast(message, isError = false) {
  const toast = $('toast');

  toast.textContent = message;
  toast.style.borderColor = isError ? '#f2a8af' : '';
  toast.style.color = isError ? '#c13e4b' : '';
  toast.classList.add('show');

  window.clearTimeout(toastTimer);

  toastTimer = window.setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

/* Navigation */

function setTab(tabName) {
  document.querySelectorAll('.nav-tab').forEach(button => {
    const selected = button.dataset.tab === tabName;

    button.classList.toggle('active', selected);
    button.setAttribute('aria-selected', String(selected));
  });

  document.querySelectorAll('[data-panel]').forEach(panel => {
    const selected = panel.dataset.panel === tabName;

    panel.classList.toggle('active', selected);
    panel.hidden = !selected;
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.querySelectorAll('.nav-tab').forEach(button => {
  button.addEventListener('click', () => setTab(button.dataset.tab));
});

document.querySelectorAll('[data-go-tab]').forEach(button => {
  button.addEventListener('click', () => setTab(button.dataset.goTab));
});

/* Example fields */

function addExampleField(container, example = {}, index = 0) {
  const entry = el('div', 'example-entry');
  const head = el('div', 'example-entry-head');
  const title = el('strong', '', `Câu ví dụ ${index + 1}`);

  const remove = el('button', 'remove-example', '×');
  remove.type = 'button';
  remove.setAttribute('aria-label', `Xóa câu ví dụ ${index + 1}`);
  remove.title = 'Xóa câu ví dụ';

  remove.addEventListener('click', () => {
    if (container.children.length <= 1) {
      entry.querySelector('[data-example-english]').value = '';
      entry.querySelector('[data-example-vietnamese]').value = '';
      entry.querySelector('[data-example-english]').focus();
      return;
    }

    entry.remove();
    renumberExampleFields(container);
  });

  head.append(title, remove);

  const vietnameseLabel = el('label', 'field-label', 'Câu tiếng Việt *');
  const vietnameseInput = document.createElement('input');

  vietnameseInput.type = 'text';
  vietnameseInput.required = true;
  vietnameseInput.maxLength = 600;
  vietnameseInput.placeholder = 'Nhập câu tiếng Việt làm đề bài đố (Ví dụ: Vui lòng nộp báo cáo của bạn.)';
  vietnameseInput.value = example.vietnamese || '';
  vietnameseInput.dataset.exampleVietnamese = 'true';

  const englishLabel = el(
    'label',
    'field-label',
    'Câu tiếng Anh tương ứng *'
  );
  const englishInput = document.createElement('input');

  englishInput.type = 'text';
  englishInput.required = true;
  englishInput.maxLength = 600;
  englishInput.placeholder = 'Nhập câu tiếng Anh đáp án chính xác (Ví dụ: Please submit your report.)';
  englishInput.value = example.english || '';
  englishInput.dataset.exampleEnglish = 'true';

  entry.append(
    head,
    vietnameseLabel,
    vietnameseInput,
    englishLabel,
    englishInput
  );

  container.appendChild(entry);
  renumberExampleFields(container);
}

function renumberExampleFields(container) {
  [...container.children].forEach((entry, index) => {
    const title = entry.querySelector('.example-entry-head strong');
    const remove = entry.querySelector('.remove-example');

    if (title) title.textContent = `Câu ví dụ ${index + 1}`;

    if (remove) {
      remove.setAttribute('aria-label', `Xóa câu ví dụ ${index + 1}`);
    }
  });
}

function readExampleFields(container) {
  return [...container.querySelectorAll('.example-entry')].map(entry => ({
    english: entry.querySelector('[data-example-english]').value.trim(),
    vietnamese: entry.querySelector('[data-example-vietnamese]').value.trim()
  }));
}

$('addExample').addEventListener('click', () => {
  addExampleField(exampleFields, {}, exampleFields.children.length);

  const input = exampleFields.lastElementChild
    ?.querySelector('[data-example-english]');

  if (input) input.focus();
});

/* Vocabulary rendering */

function renderDateFilter() {
  const filter = $('dateFilter');
  const oldValue = filter.value || 'all';

  filter.replaceChildren();
  filter.appendChild(new Option('Tất cả ngày', 'all'));

  sortedDates().forEach(date => {
    filter.appendChild(new Option(`Ngày ${formatDate(date)}`, date));
  });

  filter.value = [...filter.options].some(option => option.value === oldValue)
    ? oldValue
    : 'all';
}

function renderWordCard(word) {
  const card = el('article', 'word-card');
  const top = el('div', 'word-card-top');

  top.append(
    el('h3', '', word.english),
    el('span', 'type-pill', word.type || 'Khác')
  );

  const pronunciation = el(
    'p',
    'word-pronunciation',
    word.pronunciation || 'Chưa có phiên âm'
  );

  const date = el('span', 'word-date', `📅 ${formatDate(word.studyDate)}`);
  const meaningCaption = el('p', 'meaning-caption', 'NGHĨA TIẾNG VIỆT');
  const meaning = el('p', 'word-meaning', word.meaning);
  const examplesCaption = el(
    'p',
    'examples-caption',
    `CÂU VÍ DỤ (${word.examples.length})`
  );

  const previews = el('div', 'example-list');

  word.examples.forEach((example, index) => {
    if (index >= 2) return;

    const preview = el('div', 'example-preview');

    preview.appendChild(el('p', 'example-en', example.english));
    preview.appendChild(el(
      'p',
      example.vietnamese ? 'example-vi' : 'example-vi missing-translation',
      example.vietnamese || 'Chưa có bản dịch tiếng Việt'
    ));

    previews.appendChild(preview);
  });

  if (!word.examples.length) {
    previews.appendChild(el('p', 'word-pronunciation', 'Chưa có câu ví dụ.'));
  }

  const actions = el('div', 'word-card-actions');
  actions.appendChild(el('span', 'example-count', `${word.examples.length} câu ví dụ`));

  const actionButtons = el('div', 'word-action-buttons');

  const editButton = el('button', 'edit-word-button', '✏️ Sửa ví dụ');
  editButton.type = 'button';
  editButton.addEventListener('click', () => openEditModal(word.id));

  const deleteButton = el('button', 'delete-word-button', '🗑️ Xóa');
  deleteButton.type = 'button';
  deleteButton.addEventListener('click', () => deleteWord(word.id));

  actionButtons.append(editButton, deleteButton);
  actions.appendChild(actionButtons);

  card.append(
    top,
    pronunciation,
    date,
    meaningCaption,
    meaning,
    examplesCaption,
    previews,
    actions
  );

  return card;
}

function renderVault() {
  const grid = $('wordGrid');
  const search = $('searchInput').value.trim().toLocaleLowerCase();
  const dateFilter = $('dateFilter').value;

  const filtered = words.filter(word => {
    const matchesDate = dateFilter === 'all' || word.studyDate === dateFilter;

    const matchesSearch = !search ||
      word.english.toLocaleLowerCase().includes(search) ||
      word.meaning.toLocaleLowerCase().includes(search) ||
      word.examples.some(example =>
        example.english.toLocaleLowerCase().includes(search) ||
        example.vietnamese.toLocaleLowerCase().includes(search)
      );

    return matchesDate && matchesSearch;
  });

  grid.replaceChildren();
  filtered.forEach(word => grid.appendChild(renderWordCard(word)));

  $('vaultEmpty').hidden = filtered.length !== 0;
  $('wordGrid').hidden = filtered.length === 0;
  $('vaultTotal').textContent = String(words.length);
  $('vaultCount').textContent = String(words.length);
  $('totalWords').textContent = String(words.length);
  $('streakDays').textContent = String(sortedDates().length);
}

function getSelectedDates() {
  return [...document.querySelectorAll('input[name="lessonDate"]:checked')]
    .map(input => input.value);
}

function renderLessonList() {
  const list = $('lessonList');
  const previousSelection = getSelectedDates();

  list.replaceChildren();

  const dates = sortedDates();

  if (!dates.length) {
    list.appendChild(el(
      'p',
      'empty-lessons',
      'Bạn chưa có ngày học nào. Hãy thêm từ vựng trước nhé.'
    ));

    $('selectedSummary').textContent = 'Chưa có ngày học để chọn.';
    return;
  }

  dates.forEach(date => {
    const row = el('label', 'lesson-row');
    const checkbox = document.createElement('input');

    checkbox.type = 'checkbox';
    checkbox.value = date;
    checkbox.name = 'lessonDate';
    checkbox.checked = previousSelection.includes(date);

    const details = el('span', 'lesson-details');
    const dateWords = words.filter(word => word.studyDate === date);

    details.append(
      el('strong', '', formatDate(date)),
      el('small', '', `${dateWords.length} từ vựng`)
    );

    row.append(checkbox, details);
    list.appendChild(row);

    checkbox.addEventListener('change', updateSelectedSummary);
  });

  updateSelectedSummary();
}

function updateSelectedSummary() {
  const dates = getSelectedDates();
  const count = words.filter(word => dates.includes(word.studyDate)).length;

  $('selectedSummary').textContent = dates.length
    ? `Đã chọn ${dates.length} ngày học · ${count} từ vựng`
    : 'Bạn chưa chọn ngày học.';
}

$('selectAllDays').addEventListener('click', () => {
  document.querySelectorAll('input[name="lessonDate"]').forEach(input => {
    input.checked = true;
  });

  updateSelectedSummary();
});

$('clearDays').addEventListener('click', () => {
  document.querySelectorAll('input[name="lessonDate"]').forEach(input => {
    input.checked = false;
  });

  updateSelectedSummary();
});

function renderAll() {
  renderDateFilter();
  renderVault();
  renderLessonList();
}

$('searchInput').addEventListener('input', renderVault);
$('dateFilter').addEventListener('change', renderVault);

/* Add a vocabulary item */

function collectFormWord() {
  const english = $('englishWord').value.trim();
  const type = $('wordType').value;
  const pronunciation = $('pronunciation').value.trim();
  const meaning = $('meaning').value.trim();
  const studyDate = $('studyDate').value;
  const examples = readExampleFields(exampleFields);

  if (!english || !type || !meaning || !studyDate) {
    throw new Error(
      'Vui lòng điền đầy đủ từ tiếng Anh, từ loại, nghĩa và ngày học.'
    );
  }

  if (!examples.length || examples.some(example =>
    !example.english || !example.vietnamese
  )) {
    throw new Error(
      'Mỗi câu ví dụ cần có cả câu tiếng Anh và bản dịch tiếng Việt.'
    );
  }

  return {
    id: `word-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    english,
    type,
    pronunciation,
    meaning,
    studyDate,
    examples,
    createdAt: new Date().toISOString()
  };
}

form.addEventListener('submit', event => {
  event.preventDefault();

  const message = $('formMessage');
  message.textContent = '';
  message.classList.remove('error');

  let newWord;

  try {
    newWord = collectFormWord();
  } catch (error) {
    message.textContent = error.message;
    message.classList.add('error');
    return;
  }

  const duplicate = words.some(word =>
    word.english.toLocaleLowerCase() === newWord.english.toLocaleLowerCase() &&
    word.studyDate === newWord.studyDate
  );

  if (duplicate) {
    message.textContent =
      'Từ này đã có trong kho ở ngày học đã chọn. Bạn có thể sửa từ hiện có.';
    message.classList.add('error');
    return;
  }

  words.unshift(newWord);

  if (!saveWords()) {
    words = words.filter(word => word.id !== newWord.id);
    renderAll();
    return;
  }

  renderAll();
  form.reset();

  $('studyDate').value = localDateString();
  exampleFields.replaceChildren();
  addExampleField(exampleFields, {}, 0);

  message.textContent = `Đã thêm “${newWord.english}” vào kho từ vựng!`;
  showToast(`Đã lưu từ ${newWord.english}! ✨`);
});

/* Edit examples */

function openEditModal(wordId) {
  const word = words.find(item => item.id === wordId);
  if (!word) return;

  editingWordId = wordId;
  $('editWordSubtitle').textContent = `${word.english} · ${word.meaning}`;
  editExampleFields.replaceChildren();

  if (word.examples.length) {
    word.examples.forEach((example, index) => {
      addExampleField(editExampleFields, example, index);
    });
  } else {
    addExampleField(editExampleFields, {}, 0);
  }

  $('editMessage').textContent = '';
  $('editMessage').classList.remove('error');
  $('editModal').hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeEditModal() {
  $('editModal').hidden = true;
  editingWordId = null;

  if ($('gameModal').hidden && $('deleteModal').hidden) {
    document.body.style.overflow = '';
  }
}

$('closeEdit').addEventListener('click', closeEditModal);

$('editModal')
  .querySelector('[data-close-edit]')
  .addEventListener('click', closeEditModal);

$('addEditExample').addEventListener('click', () => {
  addExampleField(editExampleFields, {}, editExampleFields.children.length);

  const input = editExampleFields.lastElementChild
    ?.querySelector('[data-example-english]');

  if (input) input.focus();
});

$('editForm').addEventListener('submit', event => {
  event.preventDefault();

  const word = words.find(item => item.id === editingWordId);
  if (!word) return;

  const examples = readExampleFields(editExampleFields);
  const message = $('editMessage');

  if (!examples.length || examples.some(example =>
    !example.english || !example.vietnamese
  )) {
    message.textContent =
      'Mỗi câu ví dụ cần có cả câu tiếng Anh và bản dịch tiếng Việt.';
    message.classList.add('error');
    return;
  }

  const previousExamples = word.examples;
  word.examples = examples;

  if (!saveWords()) {
    word.examples = previousExamples;
    message.textContent = 'Không lưu được thay đổi. Hãy thử lại.';
    message.classList.add('error');
    return;
  }

  renderAll();
  closeEditModal();
  showToast(`Đã cập nhật ví dụ cho ${word.english}!`);
});

/* Custom delete confirmation */

function deleteWord(wordId) {
  const word = words.find(item => item.id === wordId);
  if (!word) return;

  pendingDeleteWordId = wordId;
  $('deleteWordPreview').textContent = `${word.english} · ${word.meaning}`;
  $('deleteModal').hidden = false;
  document.body.style.overflow = 'hidden';

  window.setTimeout(() => {
    $('cancelDelete').focus({ preventScroll: true });
  }, 30);
}

function closeDeleteModal() {
  $('deleteModal').hidden = true;
  pendingDeleteWordId = null;

  if ($('editModal').hidden && $('gameModal').hidden) {
    document.body.style.overflow = '';
  }
}

function confirmDeleteWord() {
  if (!pendingDeleteWordId) return;

  const word = words.find(item => item.id === pendingDeleteWordId);

  if (!word) {
    closeDeleteModal();
    return;
  }

  const previousWords = words;
  words = words.filter(item => item.id !== pendingDeleteWordId);

  if (!saveWords()) {
    words = previousWords;
    renderAll();
    closeDeleteModal();
    return;
  }

  renderAll();
  closeDeleteModal();
  showToast(`Đã xóa ${word.english} khỏi kho từ.`);
}

$('cancelDelete').addEventListener('click', closeDeleteModal);
$('confirmDelete').addEventListener('click', confirmDeleteWord);

$('deleteModal')
  .querySelector('[data-close-delete]')
  .addEventListener('click', closeDeleteModal);

/* Games */

function shuffle(items) {
  const result = [...items];

  for (let index = result.length - 1; index > 0; index--) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[randomIndex]] = [
      result[randomIndex],
      result[index]
    ];
  }

  return result;
}

function buildGameQuestions(type, selectedWords) {
  if (type === 'word') {
    return shuffle(selectedWords.map(word => ({
      type: 'word',
      word,
      prompt: word.meaning,
      answer: word.english,
      hint: `${word.type} · Bài học ${formatDate(word.studyDate)}`
    })));
  }

  const pairs = [];

  selectedWords.forEach(word => {
    word.examples.forEach(example => {
      if (example.english.trim() && example.vietnamese.trim()) {
        pairs.push({
          type: 'sentence',
          word,
          prompt: example.vietnamese,
          answer: example.english,
          hint: `Câu ví dụ của từ “${word.english}”`
        });
      }
    });
  });

  return shuffle(pairs);
}

function launchGame(type) {
  const selectedDates = getSelectedDates();

  if (!selectedDates.length) {
    showToast('Hãy tick chọn ít nhất một ngày học trước nhé.', true);
    return;
  }

  const selectedWords = words.filter(word =>
    selectedDates.includes(word.studyDate)
  );

  if (!selectedWords.length) {
    showToast('Ngày học đã chọn chưa có từ vựng.', true);
    return;
  }

  gameQuestions = buildGameQuestions(type, selectedWords);

  if (!gameQuestions.length) {
    showToast(
      'Các từ đã chọn chưa có cặp câu Anh – Việt. Hãy sửa từ để thêm bản dịch.',
      true
    );
    return;
  }

  activeGameType = type;
  gameIndex = 0;
  correctCount = 0;
  answered = false;
  gameResults = [];

  $('gameView').hidden = false;
  $('resultView').hidden = true;
  $('gameModal').hidden = false;
  document.body.style.overflow = 'hidden';

  showQuestion();
}

$('launchWordGame').addEventListener('click', () => launchGame('word'));
$('launchSentenceGame').addEventListener('click', () => launchGame('sentence'));

function showQuestion() {
  const question = gameQuestions[gameIndex];
  if (!question) {
    showResults();
    return;
  }

  answered = false;

  $('gameEyebrow').textContent = activeGameType === 'word'
    ? 'VOCAB CHALLENGE · 01'
    : 'SENTENCE CHALLENGE · 02';

  $('gameTitle').textContent = activeGameType === 'word'
    ? 'Đoán từ tiếng Anh'
    : 'Dịch câu ví dụ';

  $('questionCounter').textContent =
    `Câu ${gameIndex + 1}/${gameQuestions.length}`;

  $('progressPercent').textContent =
    `${Math.round(gameIndex / gameQuestions.length * 100)}%`;

  $('progressBar').style.width =
    `${gameIndex / gameQuestions.length * 100}%`;

  $('scoreCounter').textContent = String(correctCount);

  $('questionLabel').textContent = activeGameType === 'word'
    ? 'NGHĨA TIẾNG VIỆT'
    : 'DỊCH SANG TIẾNG ANH';

  $('questionPrompt').textContent = question.prompt;
  $('questionHint').textContent = question.hint;

  $('answerLabel').textContent = activeGameType === 'word'
    ? 'Từ tiếng Anh tương ứng là gì?'
    : 'Hãy tự gõ nguyên câu tiếng Anh:';

  $('answerInput').value = '';
  $('answerInput').disabled = false;
  $('answerInput').placeholder = activeGameType === 'word'
    ? 'Gõ từ tiếng Anh...'
    : 'Gõ toàn bộ câu tiếng Anh...';

  $('answerFeedback').textContent = '';
  $('answerFeedback').className = 'answer-feedback';
  $('checkAnswer').hidden = false;
  $('checkAnswer').disabled = false;
  $('nextQuestion').hidden = true;
}

$('answerForm').addEventListener('submit', event => {
  event.preventDefault();

  if (answered) return;

  const question = gameQuestions[gameIndex];
  const answer = $('answerInput').value.trim();

  if (!answer) {
    $('answerInput').focus();
    return;
  }

  const correct =
    answer.toLocaleLowerCase() === question.answer.trim().toLocaleLowerCase();

  answered = true;

  const feedback = $('answerFeedback');
  feedback.className = `answer-feedback ${correct ? 'correct' : 'incorrect'}`;

  feedback.textContent = correct
    ? 'Chính xác! 🎉 Bạn đã nhớ đúng đáp án.'
    : `Chưa đúng rồi! ❌\nĐáp án đúng: ${question.answer}`;

  if (correct) correctCount++;

  gameResults.push({ question, answer, correct });

  $('scoreCounter').textContent = String(correctCount);
  $('progressPercent').textContent =
    `${Math.round((gameIndex + 1) / gameQuestions.length * 100)}%`;

  $('progressBar').style.width =
    `${(gameIndex + 1) / gameQuestions.length * 100}%`;

  $('answerInput').disabled = true;
  $('checkAnswer').hidden = true;
  $('nextQuestion').hidden = false;

  $('nextQuestion').textContent =
    gameIndex === gameQuestions.length - 1
      ? 'Xem kết quả 🏆'
      : 'Tiếp tục →';

  $('nextQuestion').focus();
});

$('nextQuestion').addEventListener('click', () => {
  if (!answered) return;

  gameIndex++;

  if (gameIndex >= gameQuestions.length) {
    showResults();
  } else {
    showQuestion();
  }
});

function showResults() {
  $('gameView').hidden = true;
  $('resultView').hidden = false;

  const total = gameQuestions.length;
  const percent = total
    ? Math.round(correctCount / total * 100)
    : 0;

  $('finalScore').textContent = `${correctCount}/${total}`;
  $('finalPercent').textContent = `${percent}%`;

  $('resultMessage').textContent = percent === 100
    ? 'Xuất sắc! Bạn đã chinh phục tất cả câu hỏi. 🌟'
    : percent >= 70
      ? 'Tiến bộ tốt lắm! Ôn lại câu sai để ghi nhớ lâu hơn nhé.'
      : 'Cứ luyện tập từng chút một. Bạn sẽ làm tốt hơn ở lần tiếp theo!';

  const list = $('reviewList');
  list.replaceChildren();

  gameResults.forEach(result => {
    const item = el('div', 'review-item');
    const details = el('div');

    details.append(
      el(
        'strong',
        '',
        result.question.type === 'word'
          ? result.question.word.english
          : result.question.answer
      ),
      el(
        'small',
        '',
        `${result.question.prompt} · Bạn nhập: ${result.answer}`
      )
    );

    item.append(
      details,
      el(
        'span',
        `review-result ${result.correct ? 'good' : 'bad'}`,
        result.correct ? '✓ Đúng' : '✕ Sai'
      )
    );

    list.appendChild(item);
  });
}

function closeGame() {
  $('gameModal').hidden = true;

  if ($('editModal').hidden && $('deleteModal').hidden) {
    document.body.style.overflow = '';
  }
}

$('closeGame').addEventListener('click', closeGame);
$('finishGame').addEventListener('click', closeGame);

$('gameModal')
  .querySelector('[data-close-game]')
  .addEventListener('click', closeGame);

$('playAgain').addEventListener('click', () => launchGame(activeGameType));

/* Keyboard handling */

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;

  if (!$('deleteModal').hidden) closeDeleteModal();
  if (!$('gameModal').hidden) closeGame();
  if (!$('editModal').hidden) closeEditModal();
});

/* Initialize app */

addExampleField(exampleFields, {}, 0);
renderAll();

/* Mobile edge swipe: swipe from the left edge to return to Vocabulary.
   Vertical scrolling remains available and is not treated as a back swipe. */

(() => {
  const EDGE_ZONE = 26;
  const MIN_SWIPE_X = 78;
  const MAX_VERTICAL_DRIFT = 64;

  let startX = 0;
  let startY = 0;
  let tracking = false;
  let horizontalIntent = false;

  document.addEventListener('touchstart', event => {
    if (event.touches.length !== 1) {
      tracking = false;
      return;
    }

    const touch = event.touches[0];
    const activeTab = document.querySelector('.nav-tab.active')?.dataset.tab;

    tracking = touch.clientX <= EDGE_ZONE &&
      (activeTab === 'add' || activeTab === 'games');

    horizontalIntent = false;
    startX = touch.clientX;
    startY = touch.clientY;
  }, { passive: true });

  document.addEventListener('touchmove', event => {
    if (!tracking || event.touches.length !== 1) return;

    const touch = event.touches[0];
    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;

    if (
      Math.abs(deltaY) > MAX_VERTICAL_DRIFT &&
      Math.abs(deltaY) > Math.abs(deltaX)
    ) {
      tracking = false;
      return;
    }

    if (deltaX > 12 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
      horizontalIntent = true;
    }

    if (horizontalIntent && deltaX > 12 && event.cancelable) {
      event.preventDefault();
    }
  }, { passive: false });

  document.addEventListener('touchend', event => {
    if (!tracking) return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;

    tracking = false;

    if (
      deltaX >= MIN_SWIPE_X &&
      Math.abs(deltaY) <= MAX_VERTICAL_DRIFT &&
      deltaX > Math.abs(deltaY) * 1.2
    ) {
      setTab('vault');
    }
  }, { passive: true });

  document.addEventListener('touchcancel', () => {
    tracking = false;
    horizontalIntent = false;
  }, { passive: true });
})();