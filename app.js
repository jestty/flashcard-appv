// ======================================================
// FLASHCARD APP – CLEAN OPTIMIZED VERSION
// ======================================================

let data = { categories: [], currentCategoryIndex: 0 };
let currentCardIndex = 0, showingFront = true, editingIndex = null;
let isRenderingCategories = false;

const qs = (id) => document.getElementById(id);

// DOM cache
const flashcard = qs('flashcard');
const counter = qs('cardCounter');
const categorySelect = qs('categorySelect');
const modal = qs('formModal');
const frontInput = qs('frontInput');
const backInput = qs('backInput');
const formTitle = qs('formTitle');
const categoryModal = qs('categoryModal');
const categoryNameInput = qs('categoryNameInput');
const showUnlearnedOnly = qs('showUnlearnedOnly');
const sliderContainer = qs('sliderContainer');
const slider = qs('slider');

const exportBtn = qs('exportBtn');
const importBtn = qs('importBtn');
const importInput = qs('importInput');
const syncBtn = qs('syncBtn');

const nextBtn = qs('nextBtn');
const prevBtn = qs('prevBtn');
const addBtn = qs('addBtn');
const editBtn = qs('editBtn');
const deleteBtn = qs('deleteBtn');
const saveBtn = qs('saveBtn');
const cancelBtn = qs('cancelBtn');
const addCategoryBtn = qs('addCategoryBtn');
const cancelCategoryBtn = qs('cancelCategoryBtn');
const saveCategoryBtn = qs('saveCategoryBtn');
const themeToggleBtn = qs('themeToggleBtn');

// ======================================================
// LOCAL STORAGE
// ======================================================
const ensureShape = () => {
  if (!data || typeof data !== 'object') data = { categories: [], currentCategoryIndex: 0 };
  if (!Array.isArray(data.categories)) data.categories = [];
  if (typeof data.currentCategoryIndex !== 'number') data.currentCategoryIndex = 0;
};

const saveLocal = (mark = true) => {
  localStorage.setItem('flashcardData', JSON.stringify(data));
  if (mark) localStorage.setItem('flashcardDataModified', '1');
};

const loadLocal = () => {
  const stored = localStorage.getItem('flashcardData');
  if (stored) {
    try { data = JSON.parse(stored); } catch { }
  }
  ensureShape();
};

// ======================================================
// RENDER
// ======================================================
const furigana = (txt) =>
  txt.replace(/([一-龯々〆ヵヶ]+)\(([ぁ-ん]+)\)/g, '<ruby>$1<rt>$2</rt></ruby>');

const visibleCards = () => {
  const cat = data.categories[data.currentCategoryIndex];
  if (!cat) return [];
  return showUnlearnedOnly.checked
    ? cat.cards.filter(c => !c.learned)
    : cat.cards;
};

const renderCard = () => {
  const cards = visibleCards();
  if (!cards.length) {
    flashcard.textContent = 'Không có thẻ';
    counter.textContent = '0 / 0';
    sliderContainer.style.display = 'none';
    return;
  }

  if (currentCardIndex >= cards.length) currentCardIndex = 0;

  const card = cards[currentCardIndex];
  flashcard.innerHTML = furigana(showingFront ? card.front : card.back);
  counter.textContent = `${currentCardIndex + 1} / ${cards.length}`;

  slider.max = cards.length - 1;
  slider.value = currentCardIndex;
  sliderContainer.style.display = 'block';
};

const renderCategorySelect = () => {
  isRenderingCategories = true;
  categorySelect.innerHTML = data.categories
    .map((c, i) => `<option value="${i}">${c.name}</option>`)
    .join('');
  categorySelect.value = data.currentCategoryIndex;
  isRenderingCategories = false;
};

// ======================================================
// LOAD DATA.JSON (ONLY FIRST TIME IF LOCAL NOT MODIFIED)
// ======================================================
const normalizeData = (fd) => {
  if (!fd) return null;

  if (Array.isArray(fd)) {
    if (fd[0]?.cards) return { categories: fd, currentCategoryIndex: 0 };
    if (fd[0]?.front) return { categories: [{ name: 'Mặc định', cards: fd }], currentCategoryIndex: 0 };
    return null;
  }

  if (fd.categories) return fd;
  if (fd.cards) return { categories: [{ name: fd.name || 'Mặc định', cards: fd.cards }], currentCategoryIndex: 0 };

  return null;
};

const loadData = async () => {
  loadLocal();
  if (localStorage.getItem('flashcardDataModified') === '1') {
    renderCategorySelect();
    renderCard();
    return;
  }

  try {
    const res = await fetch('./data.json', { cache: 'no-store' });
    const json = normalizeData(await res.json());
    if (json) {
      data = json;
      saveLocal();
    }
  } catch { }

  ensureShape();
  renderCategorySelect();
  renderCard();
};

// ======================================================
// SYNC REMOTE (MERGE ONLY, NO DELETE)
// ======================================================
const mergeRemote = async () => {
  try {
    const res = await fetch('./data.json', { cache: 'no-store' });
    const remote = normalizeData(await res.json());
    if (!remote) return alert("data.json không hợp lệ");

    remote.categories.forEach(rCat => {
      let lCat = data.categories.find(c => c.name === rCat.name);
      if (!lCat) {
        data.categories.push(JSON.parse(JSON.stringify(rCat)));
        return;
      }
      rCat.cards.forEach(rc => {
        if (!lCat.cards.some(lc => lc.front === rc.front && lc.back === rc.back))
          lCat.cards.push({ ...rc });
      });
    });

    saveLocal(false);
    renderCategorySelect();
    renderCard();
    alert("Đã đồng bộ (merge) thành công");
  } catch {
    alert("Không thể sync");
  }
};

// ======================================================
// CARD HANDLERS
// ======================================================
const flipCard = () => {
  showingFront = !showingFront;
  if (!showingFront) {
    const card = visibleCards()[currentCardIndex];
    const cat = data.categories[data.currentCategoryIndex];
    const real = cat.cards.indexOf(card);
    if (real >= 0) cat.cards[real].learned = true;
    saveLocal();
  }
  renderCard();
};

const nextCard = () => {
  const cards = visibleCards();
  currentCardIndex = (currentCardIndex + 1) % cards.length;
  showingFront = true;
  renderCard();
};

const prevCard = () => {
  const cards = visibleCards();
  currentCardIndex = (currentCardIndex - 1 + cards.length) % cards.length;
  showingFront = true;
  renderCard();
};

// ======================================================
// FORMS
// ======================================================
const showForm = (edit = false) => {
  const cards = visibleCards();
  const card = cards[currentCardIndex];

  editingIndex = edit ? currentCardIndex : null;
  formTitle.textContent = edit ? "Sửa thẻ" : "Thêm thẻ";
  frontInput.value = edit ? card.front : '';
  backInput.value = edit ? card.back : '';

  modal.classList.remove('hidden');
  frontInput.focus();
};

const saveForm = () => {
  const front = frontInput.value.trim();
  if (!front) return alert("Không được để trống mặt trước");

  const cat = data.categories[data.currentCategoryIndex];

  if (editingIndex !== null) {
    const card = visibleCards()[editingIndex];
    const real = cat.cards.indexOf(card);
    cat.cards[real] = { front, back: backInput.value.trim(), learned: card.learned };
    currentCardIndex = editingIndex;
  } else {
    cat.cards.push({ front, back: backInput.value.trim(), learned: false });
    currentCardIndex = cat.cards.length - 1;
  }

  saveLocal();
  modal.classList.add('hidden');
  showingFront = true;
  renderCard();
};

// ======================================================
// CATEGORY FORM
// ======================================================
const saveCategory = () => {
  const name = categoryNameInput.value.trim();
  if (!name) return;
  if (data.categories.some(c => c.name === name)) return alert("Tên đã tồn tại");

  data.categories.push({ name, cards: [] });
  data.currentCategoryIndex = data.categories.length - 1;

  saveLocal();
  categoryModal.classList.add('hidden');
  renderCategorySelect();
  currentCardIndex = 0;
  renderCard();
};

// ======================================================
// EXPORT / IMPORT
// ======================================================
const exportData = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  a.download = "data.json";
  a.click();
};

const importData = (file) => {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const parsed = normalizeData(JSON.parse(e.target.result));
      if (!parsed) return alert("JSON không hợp lệ");

      data = parsed;
      saveLocal();
      renderCategorySelect();
      renderCard();
      alert("Import thành công!");
    } catch { alert("Import lỗi"); }
  };
  reader.readAsText(file);
};

// ======================================================
// EVENT LISTENERS
// ======================================================
flashcard.onclick = flipCard;
flashcard.addEventListener('touchend', flipCard, { passive: false });

nextBtn.onclick = nextCard;
prevBtn.onclick = prevCard;
addBtn.onclick = () => showForm(false);
editBtn.onclick = () => showForm(true);

deleteBtn.onclick = () => {
  const cards = visibleCards();
  if (!cards.length) return;

  const cat = data.categories[data.currentCategoryIndex];
  const real = cat.cards.indexOf(cards[currentCardIndex]);
  cat.cards.splice(real, 1);

  if (!cat.cards.length) {
    data.categories.splice(data.currentCategoryIndex, 1);
    data.currentCategoryIndex = Math.max(0, data.currentCategoryIndex - 1);
  }

  saveLocal();
  renderCategorySelect();
  currentCardIndex = 0;
  renderCard();
};

saveBtn.onclick = saveForm;
cancelBtn.onclick = () => modal.classList.add('hidden');

categorySelect.onchange = (e) => {
  if (isRenderingCategories) return;
  data.currentCategoryIndex = +e.target.value;
  currentCardIndex = 0;
  showingFront = true;
  renderCard();
};

addCategoryBtn.onclick = () => {
  categoryModal.classList.remove('hidden');
  categoryNameInput.focus();
};
cancelCategoryBtn.onclick = () => categoryModal.classList.add('hidden');
saveCategoryBtn.onclick = saveCategory;

showUnlearnedOnly.onchange = () => {
  currentCardIndex = 0;
  showingFront = true;
  renderCard();
};

themeToggleBtn.onclick = () => document.body.classList.toggle('dark-mode');

slider.oninput = () => {
  currentCardIndex = +slider.value;
  showingFront = true;
  renderCard();
};

exportBtn.onclick = exportData;
importBtn.onclick = () => importInput.click();
importInput.onchange = (e) => {
  if (e.target.files[0]) importData(e.target.files[0]);
  e.target.value = '';
};

syncBtn.onclick = mergeRemote;

// ======================================================
// LOAD
// ======================================================
document.addEventListener('DOMContentLoaded', loadData);