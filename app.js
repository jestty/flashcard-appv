// =======================
// Flashcard App JS (hoàn chỉnh + online/offline + slider)
// =======================

const apiUrl = '/api/data'; // endpoint server

let data = { categories: [], currentCategoryIndex: 0 };
let currentCardIndex = 0;
let showingFront = true;
let editingIndex = null;

document.addEventListener('DOMContentLoaded', async () => {
  // --- DOM Elements ---
  const flashcard = document.getElementById('flashcard');
  const counter = document.getElementById('cardCounter');
  const categorySelect = document.getElementById('categorySelect');
  const modal = document.getElementById('formModal');
  const frontInput = document.getElementById('frontInput');
  const backInput = document.getElementById('backInput');
  const formTitle = document.getElementById('formTitle');
  const categoryModal = document.getElementById('categoryModal');
  const categoryNameInput = document.getElementById('categoryNameInput');
  const showUnlearnedOnly = document.getElementById('showUnlearnedOnly');
  const sliderContainer = document.getElementById('sliderContainer');
  const slider = document.getElementById('slider');

  const nextBtn = document.getElementById('nextBtn');
  const prevBtn = document.getElementById('prevBtn');
  const addBtn = document.getElementById('addBtn');
  const editBtn = document.getElementById('editBtn');
  const deleteBtn = document.getElementById('deleteBtn');
  const saveBtn = document.getElementById('saveBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const addCategoryBtn = document.getElementById('addCategoryBtn');
  const cancelCategoryBtn = document.getElementById('cancelCategoryBtn');
  const saveCategoryBtn = document.getElementById('saveCategoryBtn');
  const themeToggleBtn = document.getElementById('themeToggleBtn');

  // =======================
  // Local Storage
  // =======================
  const saveLocalData = () =>
    localStorage.setItem('flashcardData', JSON.stringify(data));
  const loadLocalData = () => {
    const stored = localStorage.getItem('flashcardData');
    if (stored) data = JSON.parse(stored);
  };

  // =======================
  // Load/Save Server + Local
  // =======================

const loadData = async () => {
  // Bước 1: Load từ localStorage trước (để hiển thị nhanh)
  loadLocalData();
  renderCategorySelect();
  renderCard();

  try {
    // Bước 2: Thử đọc từ file local JSON (data.json)
    const res = await fetch('./data.json');
    if (!res.ok) throw new Error('Không tìm thấy file data.json');
    const fileData = await res.json();

    // Bước 3: Cập nhật data trong app
    data = fileData;
    saveLocalData(); // Lưu xuống localStorage để offline dùng tiếp

    console.log('✅ Dữ liệu được tải từ file data.json');
  } catch (e) {
    console.warn('⚠️ Không thể tải file data.json, dùng localStorage');
    // Nếu chưa có dữ liệu thì tạo mặc định
    if (!data.categories || data.categories.length === 0) {
      data = {
        categories: [{ name: 'Mặc định', cards: [] }],
        currentCategoryIndex: 0,
      };
      saveLocalData();
    }
  }

  renderCategorySelect();
  renderCard();
};

  const saveData = async () => {
    saveLocalData();
    try {
      await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([data]),
      });
    } catch (e) {
      console.warn('⚠️ Không thể lưu server, chỉ lưu local');
    }
  };

  // =======================
  // Render / Utility
  // =======================
  const getVisibleCards = () => {
    const cat = data.categories[data.currentCategoryIndex];
    if (!cat) return [];
    return showUnlearnedOnly?.checked
      ? cat.cards.filter((c) => !c.learned)
      : cat.cards;
  };

  const convertFurigana = (text) =>
    text.replace(
      /([一-龯々〆ヵヶ]+)\(([\u3040-\u309F]+)\)/g,
      '<ruby>$1<rt>$2</rt></ruby>'
    );

  const renderCard = () => {
    const cards = getVisibleCards();
    if (!cards.length) {
      flashcard.textContent = data.categories.length
        ? 'Không còn thẻ'
        : 'Chưa có nhóm nào';
      counter.textContent = '0 / 0';
      sliderContainer.style.display = 'none';
      return;
    }
    if (currentCardIndex >= cards.length) currentCardIndex = 0;

    const card = cards[currentCardIndex];
    flashcard.innerHTML = convertFurigana(
      showingFront ? card.front : card.back
    );
    counter.textContent = `${currentCardIndex + 1} / ${cards.length}`;

    if (slider) {
      slider.max = cards.length - 1;
      slider.value = currentCardIndex;
      sliderContainer.style.display = 'block';
    }
  };

  const renderCategorySelect = () => {
    if (!categorySelect) return;
    categorySelect.innerHTML = '';
    data.categories.forEach((c, i) => {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = c.name;
      categorySelect.appendChild(opt);
    });
    if (data.currentCategoryIndex >= data.categories.length)
      data.currentCategoryIndex = 0;
    categorySelect.value = data.currentCategoryIndex;
  };

  // =======================
  // Card Controls
  // =======================
  const flipCard = () => {
    showingFront = !showingFront;
    if (!showingFront) {
      const card = getVisibleCards()[currentCardIndex];
      const cat = data.categories[data.currentCategoryIndex];
      const realIndex = cat.cards.indexOf(card);
      cat.cards[realIndex].learned = true;
      saveData();
    }
    renderCard();
  };

  const nextCard = () => {
    const cards = getVisibleCards();
    if (!cards.length) return;
    currentCardIndex = (currentCardIndex + 1) % cards.length;
    showingFront = true;
    renderCard();
  };

  const prevCard = () => {
    const cards = getVisibleCards();
    if (!cards.length) return;
    currentCardIndex = (currentCardIndex - 1 + cards.length) % cards.length;
    showingFront = true;
    renderCard();
  };

  // =======================
  // Modal Forms
  // =======================
  const showForm = (isEdit = false) => {
    if (!modal) return;
    modal.classList.remove('hidden');
    const cat = data.categories[data.currentCategoryIndex];
    if (!cat) return;
    if (isEdit) {
      editingIndex = currentCardIndex;
      const card = getVisibleCards()[currentCardIndex];
      formTitle.textContent = 'Sửa thẻ';
      frontInput.value = card.front;
      backInput.value = card.back;
    } else {
      editingIndex = null;
      formTitle.textContent = 'Thêm thẻ';
      frontInput.value = '';
      backInput.value = '';
    }
    frontInput.focus();
  };

  const hideForm = () => modal?.classList.add('hidden');

  const saveForm = async () => {
    const front = frontInput.value.trim();
    const back = backInput.value.trim();
    if (!front) return alert('Mặt trước không được để trống');

    const cat = data.categories[data.currentCategoryIndex];
    if (!cat) return;

    if (editingIndex !== null) {
      const card = getVisibleCards()[editingIndex];
      const realIndex = cat.cards.indexOf(card);
      cat.cards[realIndex] = {
        front,
        back,
        learned: cat.cards[realIndex].learned || false,
      };
      currentCardIndex = editingIndex;
    } else {
      cat.cards.push({ front, back, learned: false });
      currentCardIndex = cat.cards.length - 1;
    }

    await saveData();
    hideForm();
    showingFront = true;
    renderCard();
  };

  // =======================
  // Category Modal
  // =======================
  const showCategoryModal = () => {
    if (!categoryModal) return;
    categoryModal.classList.remove('hidden');
    categoryNameInput.value = '';
    categoryNameInput.focus();
  };

  const hideCategoryModal = () => categoryModal?.classList.add('hidden');

  const saveCategory = async () => {
    const name = categoryNameInput.value.trim();
    if (!name) return;
    if (data.categories.some((c) => c.name === name))
      return alert('Tên nhóm đã tồn tại!');

    data.categories.push({ name, cards: [] });
    data.currentCategoryIndex = data.categories.length - 1;
    await saveData();
    hideCategoryModal();
    renderCategorySelect();
    currentCardIndex = 0;
    renderCard();
  };

  // =======================
  // Event Listeners
  // =======================
  flashcard?.addEventListener('click', flipCard);
  flashcard?.addEventListener('touchend', (e) => {
    e.preventDefault();
    flipCard();
  });

  nextBtn?.addEventListener('click', nextCard);
  prevBtn?.addEventListener('click', prevCard);
  addBtn?.addEventListener('click', () => showForm(false));
  editBtn?.addEventListener('click', () => showForm(true));
  deleteBtn?.addEventListener('click', async () => {
    const cards = getVisibleCards();
    if (!cards.length) return;
    const cat = data.categories[data.currentCategoryIndex];
    const card = cards[currentCardIndex];
    const realIndex = cat.cards.indexOf(card);
    cat.cards.splice(realIndex, 1);
    if (!cat.cards.length) {
      data.categories.splice(data.currentCategoryIndex, 1);
      data.currentCategoryIndex = Math.max(0, data.currentCategoryIndex - 1);
    }
    currentCardIndex = 0;
    showingFront = true;
    await saveData();
    renderCategorySelect();
    renderCard();
  });

  saveBtn?.addEventListener('click', saveForm);
  cancelBtn?.addEventListener('click', hideForm);
  categorySelect?.addEventListener('change', (e) => {
    data.currentCategoryIndex = parseInt(e.target.value);
    currentCardIndex = 0;
    showingFront = true;
    renderCard();
  });
  addCategoryBtn?.addEventListener('click', showCategoryModal);
  cancelCategoryBtn?.addEventListener('click', hideCategoryModal);
  saveCategoryBtn?.addEventListener('click', saveCategory);
  showUnlearnedOnly?.addEventListener('change', () => {
    currentCardIndex = 0;
    showingFront = true;
    renderCard();
  });
  themeToggleBtn?.addEventListener('click', () =>
    document.body.classList.toggle('dark-mode')
  );

  slider?.addEventListener('input', () => {
    currentCardIndex = parseInt(slider.value);
    showingFront = true;
    renderCard();
  });

  // =======================
  // Initial Load
  // =======================
  loadLocalData();
  await loadData();

  // Auto sync khi online
  setInterval(() => {
    if (navigator.onLine) loadData();
  }, 5000);
});
