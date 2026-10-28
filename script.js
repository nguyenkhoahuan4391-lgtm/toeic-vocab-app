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
      { english: 'Please submit your report by Friday.', vietnamese: 'Vui lòng nộp báo cáo của bạn trước thứ Sáu.' },
      { english: 'You must submit the application online.', vietnamese: 'Bạn phải nộp đơn đăng ký trực tuyến.' },
      { english: 'Employees should submit their expenses every month.', vietnamese: 'Nhân viên nên nộp các khoản chi phí của mình mỗi tháng.' }
    ],
    createdAt: '2026-10-28T08:00:00.000Z'
  }
];

const $ = id => document.getElementById(id);
const form = $('vocabForm');
const exampleFields = $('exampleFields');
const editExampleFields = $('editExampleFields');
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

function localDateString(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
$('studyDate').value = localDateString();

function normalizeExamples(word) {
  if (Array.isArray(word.examples)) {
    return word.examples
      .filter(ex => ex && typeof ex.english === 'string')
      .map(ex => ({
        english: ex.english.trim(),
        vietnamese: typeof ex.vietnamese === 'string' ? ex.vietnamese.trim() : ''
      }))
      .filter(ex => ex.english);
  }
  const oldExample = typeof word.example === 'string' ? word.example.trim() : '';
  return oldExample ? [{ english: oldExample, vietnamese: '' }] : [];
}

function normalizeWord(word) {
  if (!word || typeof word !== 'object' ||
      typeof word.english !== 'string' ||
      typeof word.meaning !== 'string' ||
      typeof word.studyDate !== 'string') return null;

  return {
    id: typeof word.id === 'string' ? word.id : `import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    english: word.english.trim(),
    type: typeof word.type === 'string' ? word.type : 'Khác (Other)',
    pronunciation: typeof word.pronunciation === 'string' ? word.pronunciation : '',
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
      if (Array.isArray(parsed)) return parsed.map(normalizeWord).filter(Boolean);
    }

    // Chuyển dữ liệu từ bản trước sang định dạng mới nếu có.
    for (const oldKey of LEGACY_KEYS) {
      const oldSaved = localStorage.getItem(oldKey);
      if (!oldSaved) continue;
      const oldParsed = JSON.parse(oldSaved);
      if (Array.isArray(oldParsed)) {
        const migrated = oldParsed.map(normalizeWord).filter(Boolean);
        if (migrated.length) {
          // Đảm bảo từ mẫu Submit có đủ ba cặp câu ví dụ Anh - Việt.
          const sampleSubmit = normalizeWord(SAMPLE_WORDS[0]);
          const existingSubmitIndex = migrated.findIndex(word =>
            word.english.toLowerCase() === 'submit' && word.studyDate === '2026-10-28'
          );
          if (existingSubmitIndex >= 0) {
            migrated[existingSubmitIndex] = {
              ...migrated[existingSubmitIndex],
              examples: sampleSubmit.examples
            };
          } else {
            migrated.push(sampleSubmit);
          }
          localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
          return migrated;
        }
      }
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(SAMPLE_WORDS));
    return SAMPLE_WORDS.map(normalizeWord).filter(Boolean);
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return 'Ngày chưa xác định';
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
  toastTimer = window.setTimeout(() => toast.classList.remove('show'), 3000);
}

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
  if (tabName === 'add' && !$('englishWord').value) $('englishWord').focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.querySelectorAll('.nav-tab').forEach(button => {
  button.addEventListener('click', () => setTab(button.dataset.tab));
});
document.querySelectorAll('[data-go-tab]').forEach(button => {
  button.addEventListener('click', () => setTab(button.dataset.goTab));
});

function addExampleField(container, example = {}, index = 0) {
  const entry = el('div', 'example-entry');
  const head = el('div', 'example-entry-head');
  head.appendChild(el('strong', '', `Câu ví dụ ${index + 1}`));

  const remove = el('button', 'remove-example', '×');
  remove.type = 'button';
  remove.setAttribute('aria-label', `Xóa câu ví dụ ${index + 1}`);
  remove.title = 'Xóa câu ví dụ';
  remove.addEventListener('click', () => {
    if (container.children.length <= 1) {
      const english = entry.querySelector('[data-example-english]');
      const vietnamese = entry.querySelector('[data-example-vietnamese]');
      english.value = '';
      vietnamese.value = '';
      english.focus();
      return;
    }
    entry.remove();
    renumberExampleFields(container);
  });
  head.appendChild(remove);

  const englishLabel = el('label', 'field-label', 'Câu tiếng Anh *');
  const englishInput = document.createElement('input');
  englishInput.type = 'text';
  englishInput.required = true;
  englishInput.maxLength = 600;
  englishInput.placeholder = 'Ví dụ: Please submit your report.';
  englishInput.value = example.english || '';
  englishInput.dataset.exampleEnglish = 'true';

  const vietnameseLabel = el('label', 'field-label', 'Câu tiếng Việt tương ứng *');
  const vietnameseInput = document.createElement('input');
  vietnameseInput.type = 'text';
  vietnameseInput.required = true;
  vietnameseInput.maxLength = 600;
  vietnameseInput.placeholder = 'Ví dụ: Vui lòng nộp báo cáo của bạn.';
  vietnameseInput.value = example.vietnamese || '';
  vietnameseInput.dataset.exampleVietnamese = 'true';

  entry.append(head, englishLabel, englishInput, vietnameseLabel, vietnameseInput);
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
      remove.disabled = false;
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
  const lastInput = exampleFields.lastElementChild?.querySelector('[data-example-english]');
  if (lastInput) lastInput.focus();
});

function renderDateFilter() {
  const filter = $('dateFilter');
  const oldValue = filter.value || 'all';
  filter.replaceChildren();
  filter.appendChild(new Option('Tất cả ngày', 'all'));
  sortedDates().forEach(date => {
    filter.appendChild(new Option(`Ngày ${formatDate(date)}`, date));
  });
  filter.value = [...filter.options].some(option => option.value === oldValue) ? oldValue : 'all';
}

function renderWordCard(word) {
  const card = el('article', 'word-card');
  const top = el('div', 'word-card-top');
  top.append(el('h3', '', word.english), el('span', 'type-pill', word.type || 'Khác'));

  const previews = el('div', 'example-list');
  word.examples.forEach((example, index) => {
    if (index >= 2) return;
    const preview = el('div', 'example-preview');
    preview.appendChild(el('p', 'example-en', example.english));
    preview.appendChild(el('p', example.vietnamese ? 'example-vi' : 'example-vi missing-translation',
      example.vietnamese || 'Chưa có bản dịch tiếng Việt'));
    previews.appendChild(preview);
  });
  if (!word.examples.length) {
    const preview = el('div', 'example-preview');
    preview.appendChild(el('p', 'example-vi missing-translation', 'Chưa có câu ví dụ. Bấm Sửa để thêm.'));
    previews.appendChild(preview);
  }

  const actions = el('div', 'word-card-actions');
  actions.appendChild(el('span', 'example-count', `${word.examples.length} câu ví dụ`));

  const buttons = el('div');
  const edit = el('button', 'edit-word-button', '✏️ Sửa');
  edit.type = 'button';
  edit.addEventListener('click', () => openEditModal(word.id));
  const remove = el('button', 'delete-word-button', 'Xóa');
  remove.type = 'button';
  remove.addEventListener('click', () => deleteWord(word.id));
  buttons.append(edit, document.createTextNode(' '), remove);
  actions.appendChild(buttons);

  card.append(
    top,
    el('p', 'word-pronunciation', word.pronunciation || 'Chưa có phiên âm'),
    el('span', 'word-date', `📅 ${formatDate(word.studyDate)}`),
    el('p', 'meaning-caption', 'Nghĩa tiếng Việt'),
    el('p', 'word-meaning', word.meaning),
    el('p', 'examples-caption', 'CÂU VÍ DỤ'),
    previews,
    actions
  );
  return card;
}

function renderVault() {
  const query = $('searchInput').value.trim().toLocaleLowerCase('vi');
  const dateFilter = $('dateFilter').value;
  const filtered = words.filter(word => {
    const matchesDate = dateFilter === 'all' || word.studyDate === dateFilter;
    const examplesText = word.examples.map(example => `${example.english} ${example.vietnamese}`).join(' ');
    const text = [
      word.english, word.type, word.pronunciation, word.meaning,
      formatDate(word.studyDate), examplesText
    ].join(' ').toLocaleLowerCase('vi');
    return matchesDate && text.includes(query);
  }).sort((a, b) => b.studyDate.localeCompare(a.studyDate) || a.english.localeCompare(b.english));

  $('wordGrid').replaceChildren();
  const fragment = document.createDocumentFragment();
  filtered.forEach(word => fragment.appendChild(renderWordCard(word)));
  $('wordGrid').appendChild(fragment);

  $('vaultEmpty').hidden = filtered.length > 0;
  $('wordGrid').hidden = filtered.length === 0;
  $('vaultTotal').textContent = String(words.length);
  $('totalWords').textContent = String(words.length);
  $('vaultCount').textContent = String(words.length);
  $('streakDays').textContent = String(sortedDates().length);
}

function getSelectedDates() {
  return [...$('lessonList').querySelectorAll('input[type="checkbox"]:checked')]
    .map(input => input.value);
}

function renderLessons() {
  const previouslySelected = new Set(getSelectedDates());
  const dates = sortedDates();
  const list = $('lessonList');
  list.replaceChildren();

  if (!dates.length) {
    list.appendChild(el('div', 'no-lessons', 'Chưa có bài học. Hãy thêm từ vựng trước nhé!'));
    updateSelectionSummary();
    return;
  }

  dates.forEach(date => {
    const count = words.filter(word => word.studyDate === date).length;
    const label = el('label', 'lesson-item');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = date;
    checkbox.checked = previouslySelected.has(date);
    checkbox.setAttribute('aria-label', `Chọn bài học ngày ${formatDate(date)}`);
    checkbox.addEventListener('change', updateSelectionSummary);

    const details = el('span', 'lesson-details');
    details.append(el('strong', '', `Bài học ngày ${formatDate(date)}`), el('small', '', `${count} từ trong bài`));
    label.append(checkbox, details, el('span', 'lesson-count', `${count} từ`));
    list.appendChild(label);
  });
  updateSelectionSummary();
}

function updateSelectionSummary() {
  const selected = getSelectedDates();
  const count = words.filter(word => selected.includes(word.studyDate)).length;
  $('selectedSummary').textContent = selected.length
    ? `Đã chọn ${selected.length} ngày · ${count} từ vựng`
    : 'Bạn chưa chọn ngày học.';
}

function renderAll() {
  renderDateFilter();
  renderVault();
  renderLessons();
}

form.addEventListener('submit', event => {
  event.preventDefault();
  const english = $('englishWord').value.trim();
  const type = $('wordType').value;
  const pronunciation = $('pronunciation').value.trim();
  const meaning = $('meaning').value.trim();
  const studyDate = $('studyDate').value;
  const examples = readExampleFields(exampleFields);
  const message = $('formMessage');
  message.textContent = '';
  message.classList.remove('error');

  if (!english || !type || !meaning || !studyDate) {
    message.textContent = 'Vui lòng điền đủ các thông tin bắt buộc.';
    message.classList.add('error');
    return;
  }
  if (!examples.length || examples.some(example => !example.english || !example.vietnamese)) {
    message.textContent = 'Mỗi câu ví dụ cần có cả câu tiếng Anh và câu tiếng Việt.';
    message.classList.add('error');
    return;
  }
  if (words.some(word => word.english.toLowerCase() === english.toLowerCase() && word.studyDate === studyDate)) {
    message.textContent = `Từ “${english}” đã tồn tại trong bài học ngày ${formatDate(studyDate)}.`;
    message.classList.add('error');
    return;
  }

  words.unshift({
    id: `word-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    english, type, pronunciation, meaning, studyDate, examples,
    createdAt: new Date().toISOString()
  });
  const saved = saveWords();
  const retainedDate = studyDate;
  form.reset();
  exampleFields.replaceChildren();
  addExampleField(exampleFields, {}, 0);
  $('studyDate').value = retainedDate;
  renderAll();
  message.textContent = saved ? `Đã thêm “${english}” thành công! 🌱` : 'Đã thêm từ trong phiên này nhưng chưa lưu được.';
  showToast(saved ? `Đã thêm ${english} vào kho từ!` : 'Chưa lưu được dữ liệu.', !saved);
  $('englishWord').focus({ preventScroll: true });
});

$('searchInput').addEventListener('input', renderVault);
$('dateFilter').addEventListener('change', renderVault);
$('selectAllDays').addEventListener('click', () => {
  $('lessonList').querySelectorAll('input[type="checkbox"]').forEach(input => input.checked = true);
  updateSelectionSummary();
});
$('clearDays').addEventListener('click', () => {
  $('lessonList').querySelectorAll('input[type="checkbox"]').forEach(input => input.checked = false);
  updateSelectionSummary();
});

function openEditModal(wordId) {
  const word = words.find(item => item.id === wordId);
  if (!word) return;
  editingWordId = wordId;
  $('editWordSubtitle').textContent = `${word.english} · ${word.meaning}`;
  editExampleFields.replaceChildren();
  const examples = word.examples.length ? word.examples : [{ english: '', vietnamese: '' }];
  examples.forEach((example, index) => addExampleField(editExampleFields, example, index));
  $('editMessage').textContent = '';
  $('editMessage').classList.remove('error');
  $('editModal').hidden = false;
  document.body.style.overflow = 'hidden';
  window.setTimeout(() => editExampleFields.querySelector('[data-example-english]')?.focus(), 40);
}

function closeEditModal() {
  $('editModal').hidden = true;
  editingWordId = null;
  if ($('gameModal').hidden) document.body.style.overflow = '';
}

$('closeEdit').addEventListener('click', closeEditModal);
$('editModal').querySelector('[data-close-edit]').addEventListener('click', closeEditModal);
$('addEditExample').addEventListener('click', () => {
  addExampleField(editExampleFields, {}, editExampleFields.children.length);
  editExampleFields.lastElementChild?.querySelector('[data-example-english]')?.focus();
});

$('editForm').addEventListener('submit', event => {
  event.preventDefault();
  const word = words.find(item => item.id === editingWordId);
  if (!word) return;

  const examples = readExampleFields(editExampleFields);
  const message = $('editMessage');
  message.textContent = '';
  message.classList.remove('error');

  if (!examples.length || examples.some(example => !example.english || !example.vietnamese)) {
    message.textContent = 'Mỗi câu cần có cả tiếng Anh và bản dịch tiếng Việt.';
    message.classList.add('error');
    return;
  }

  word.examples = examples;
  const saved = saveWords();
  renderAll();
  closeEditModal();
  showToast(saved ? `Đã cập nhật ví dụ cho ${word.english}!` : 'Chưa lưu được dữ liệu.', !saved);
});

function deleteWord(wordId) {
  const word = words.find(item => item.id === wordId);
  if (!word) return;

  // Mở hộp thoại xác nhận riêng của ứng dụng thay cho hộp thoại mặc định của trình duyệt.
  pendingDeleteWordId = wordId;
  $('deleteWordPreview').textContent = `${word.english} · ${word.meaning}`;
  $('deleteModal').hidden = false;
  document.body.style.overflow = 'hidden';
  window.setTimeout(() => $('cancelDelete').focus({ preventScroll: true }), 30);
}

function closeDeleteModal() {
  $('deleteModal').hidden = true;
  pendingDeleteWordId = null;
  if ($('editModal').hidden && $('gameModal').hidden) document.body.style.overflow = '';
}

function confirmDeleteWord() {
  if (!pendingDeleteWordId) return;
  const word = words.find(item => item.id === pendingDeleteWordId);
  if (!word) {
    closeDeleteModal();
    return;
  }
  words = words.filter(item => item.id !== pendingDeleteWordId);
  const saved = saveWords();
  renderAll();
  closeDeleteModal();
  showToast(saved ? `Đã xóa ${word.english} khỏi kho từ.` : `Đã xóa ${word.english} trong phiên này; chưa lưu được thay đổi.`, !saved);
}

$('cancelDelete').addEventListener('click', closeDeleteModal);
$('confirmDelete').addEventListener('click', confirmDeleteWord);
$('deleteModal').querySelector('[data-close-delete]').addEventListener('click', closeDeleteModal);

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
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
  const selectedWords = words.filter(word => selectedDates.includes(word.studyDate));
  if (!selectedWords.length) {
    showToast('Ngày học đã chọn chưa có từ vựng.', true);
    return;
  }

  gameQuestions = buildGameQuestions(type, selectedWords);
  if (!gameQuestions.length) {
    showToast('Các từ đã chọn chưa có cặp câu Anh – Việt. Hãy bấm Sửa để thêm bản dịch.', true);
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
  window.setTimeout(() => $('answerInput').focus(), 50);
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
  $('gameEyebrow').textContent = activeGameType === 'word' ? 'VOCAB CHALLENGE · 01' : 'SENTENCE CHALLENGE · 02';
  $('gameTitle').textContent = activeGameType === 'word' ? 'Đoán từ tiếng Anh' : 'Dịch câu ví dụ';
  $('questionCounter').textContent = `Câu ${gameIndex + 1}/${gameQuestions.length}`;
  $('progressPercent').textContent = `${Math.round(gameIndex / gameQuestions.length * 100)}%`;
  $('progressBar').style.width = `${gameIndex / gameQuestions.length * 100}%`;
  $('scoreCounter').textContent = String(correctCount);
  $('questionLabel').textContent = activeGameType === 'word' ? 'NGHĨA TIẾNG VIỆT' : 'DỊCH SANG TIẾNG ANH';
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

  const correct = answer.toLocaleLowerCase() === question.answer.trim().toLocaleLowerCase();
  answered = true;

  const feedback = $('answerFeedback');
  feedback.className = `answer-feedback ${correct ? 'correct' : 'incorrect'}`;
  feedback.textContent = correct
    ? 'Chính xác! 🎉 Bạn đã nhớ đúng đáp án.'
    : `Chưa đúng rồi! ❌\nĐáp án đúng: ${question.answer}`;

  if (correct) correctCount++;
  gameResults.push({ question, answer, correct });
  $('scoreCounter').textContent = String(correctCount);
  $('progressPercent').textContent = `${Math.round((gameIndex + 1) / gameQuestions.length * 100)}%`;
  $('progressBar').style.width = `${(gameIndex + 1) / gameQuestions.length * 100}%`;
  $('answerInput').disabled = true;
  $('checkAnswer').hidden = true;
  $('nextQuestion').hidden = false;
  $('nextQuestion').textContent = gameIndex === gameQuestions.length - 1
    ? 'Xem kết quả 🏆'
    : 'Tiếp tục →';
  $('nextQuestion').focus();
});

$('nextQuestion').addEventListener('click', () => {
  if (!answered) return;
  gameIndex++;
  if (gameIndex >= gameQuestions.length) showResults();
  else showQuestion();
});

function showResults() {
  $('gameView').hidden = true;
  $('resultView').hidden = false;
  const total = gameQuestions.length;
  const percent = total ? Math.round(correctCount / total * 100) : 0;
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
      el('strong', '', result.question.type === 'word'
        ? result.question.word.english
        : result.question.answer),
      el('small', '', `${result.question.prompt} · Bạn nhập: ${result.answer}`)
    );
    item.append(
      details,
      el('span', `review-result ${result.correct ? 'good' : 'bad'}`, result.correct ? '✓ Đúng' : '✕ Sai')
    );
    list.appendChild(item);
  });
}

function closeGame() {
  $('gameModal').hidden = true;
  if ($('editModal').hidden) document.body.style.overflow = '';
}
$('closeGame').addEventListener('click', closeGame);
$('finishGame').addEventListener('click', closeGame);
$('gameModal').querySelector('[data-close-game]').addEventListener('click', closeGame);
$('playAgain').addEventListener('click', () => launchGame(activeGameType));

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    if (!$('deleteModal').hidden) closeDeleteModal();
    if (!$('gameModal').hidden) closeGame();
    if (!$('editModal').hidden) closeEditModal();
  }
});

addExampleField(exampleFields, {}, 0);
renderAll();


// Vuốt từ sát cạnh trái sang phải để quay về Kho từ vựng trên điện thoại.
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
    tracking = touch.clientX <= EDGE_ZONE && (activeTab === 'add' || activeTab === 'games');
    horizontalIntent = false;
    startX = touch.clientX;
    startY = touch.clientY;
  }, { passive: true });

  document.addEventListener('touchmove', event => {
    if (!tracking || event.touches.length !== 1) return;
    const touch = event.touches[0];
    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;

    // Chỉ nhận dạng khi chuyển động ngang chiếm ưu thế; cuộn dọc vẫn hoạt động bình thường.
    if (Math.abs(deltaY) > MAX_VERTICAL_DRIFT && Math.abs(deltaY) > Math.abs(deltaX)) {
      tracking = false;
      return;
    }
    if (deltaX > 12 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) horizontalIntent = true;
    if (horizontalIntent && deltaX > 12 && event.cancelable) event.preventDefault();
  }, { passive: false });

  document.addEventListener('touchend', event => {
    if (!tracking) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;
    tracking = false;
    if (deltaX >= MIN_SWIPE_X && Math.abs(deltaY) <= MAX_VERTICAL_DRIFT && deltaX > Math.abs(deltaY) * 1.2) {
      setTab('vault');
    }
  }, { passive: true });

  document.addEventListener('touchcancel', () => {
    tracking = false;
    horizontalIntent = false;
  }, { passive: true });
})();