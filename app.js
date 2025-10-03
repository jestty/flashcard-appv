// =======================
// Flashcard App JS (hoàn chỉnh + offline từ data.json + localStorage)
// =======================

// NOTE: Bỏ server — chỉ dùng data.json (static) và localStorage
let data = { categories: [], currentCategoryIndex: 0 };
let currentCardIndex = 0;
let showingFront = true;
let editingIndex = null;

const ensureDataShape = () => {
  if (!data || typeof data !== 'object')
    data = { categories: [], currentCategoryIndex: 0 };
  if (!Array.isArray(data.categories)) data.categories = [];
  if (typeof data.currentCategoryIndex !== 'number')
    data.currentCategoryIndex = 0;
};

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
  const exportBtn = document.getElementById('exportBtn');
  const importBtn = document.getElementById('importBtn');
  const importInput = document.getElementById('importInput');

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
  const saveLocalData = () => {
    try {
      localStorage.setItem('flashcardData', JSON.stringify(data));
      // Đánh dấu là đã chỉnh sửa local — tránh bị overwrite bởi data.json khi online
      localStorage.setItem('flashcardDataModified', '1');
      console.log('✅ Saved local flashcardData (modified flag set)');
    } catch (err) {
      console.error('Lỗi lưu localStorage:', err);
    }
  };
  const loadLocalData = () => {
    try {
      const stored = localStorage.getItem('flashcardData');
      if (stored) {
        data = JSON.parse(stored);
      }
    } catch (err) {
      console.warn('Không thể parse localStorage, sẽ khởi tạo mới:', err);
      data = { categories: [], currentCategoryIndex: 0 };
    }
    ensureDataShape();
  };

  // =======================
  // Load từ data.json (fallback: localStorage / mặc định)
  // =======================
  const loadData = async () => {
    // Hiển thị nhanh từ local nếu có
    loadLocalData();

    // Nếu local đã được chỉnh sửa bởi người dùng, không tự overwrite từ data.json
    const localModified = localStorage.getItem('flashcardDataModified') === '1';
    if (localModified) {
      console.log(
        '⚠️ Local changes detected — will NOT overwrite from data.json'
      );
      renderCategorySelect();
      renderCard();
      return;
    }

    try {
      const res = await fetch('./data.json', { cache: 'no-store' });
      if (!res.ok) throw new Error(`data.json HTTP ${res.status}`);
      const fileData = await res.json();

      // (giữ nguyên logic thích ứng với nhiều cấu trúc data.json)
      if (Array.isArray(fileData)) {
        if (
          fileData.length &&
          fileData[0] &&
          Array.isArray(fileData[0].cards)
        ) {
          data = { categories: fileData, currentCategoryIndex: 0 };
          console.log('✅ data.json: detected array of categories');
        } else if (
          fileData.length &&
          fileData[0] &&
          (fileData[0].front || fileData[0].back)
        ) {
          data = {
            categories: [{ name: 'Mặc định', cards: fileData }],
            currentCategoryIndex: 0,
          };
          console.log('✅ data.json: detected array of cards');
        } else {
          console.warn(
            'data.json: mảng nhưng không nhận dạng được, giữ localStorage'
          );
        }
      } else if (fileData && typeof fileData === 'object') {
        if (Array.isArray(fileData.categories)) {
          data = fileData;
          console.log('✅ data.json: loaded object with categories');
        } else if (Array.isArray(fileData.cards)) {
          data = {
            categories: [
              { name: fileData.name || 'Mặc định', cards: fileData.cards },
            ],
            currentCategoryIndex: 0,
          };
          console.log(
            '✅ data.json: object with cards -> wrapped into categories'
          );
        } else {
          console.warn(
            'data.json object nhưng không có categories/cards, giữ localStorage'
          );
        }
      } else {
        console.warn('data.json không có cấu trúc mong đợi, giữ localStorage');
      }

      ensureDataShape();
      // Lưu vào local để làm nguồn chính cho lần mở sau
      saveLocalData();
    } catch (e) {
      console.warn(
        '⚠️ Không thể tải data.json, dùng localStorage/mặc định —',
        e.message
      );
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

  // =======================
  // Save chỉ local (không có server)
  // =======================
  const saveData = async () => {
    saveLocalData();
    // nếu muốn sau này sync lên server thì thêm logic ở đây
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
      if (sliderContainer) sliderContainer.style.display = 'none';
      return;
    }
    if (currentCardIndex >= cards.length) currentCardIndex = 0;

    const card = cards[currentCardIndex];
    flashcard.innerHTML = convertFurigana(
      showingFront ? card.front : card.back
    );
    counter.textContent = `${currentCardIndex + 1} / ${cards.length}`;

    if (slider) {
      slider.max = Math.max(0, cards.length - 1);
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
      const realIndex = cat?.cards?.indexOf(card);
      if (realIndex >= 0) {
        cat.cards[realIndex].learned = true;
        saveData();
      }
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
    const cat = data.categories[data.currentCategoryIndex];
    if (!cat) {
      alert('Vui lòng tạo một nhóm trước khi thêm thẻ.');
      return;
    }
    modal.classList.remove('hidden');
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
  // Export / Import
  // =======================
  // Export current data as data.json (download)
  const exportData = () => {
    try {
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'data.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      console.log('✅ Exported data.json');
    } catch (e) {
      console.error('Export failed', e);
      alert('Không thể xuất file.');
    }
  };

  // Import data.json from file input
  const importDataFromFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        // basic validation: accept object with categories OR array forms handled by existing logic
        if (!parsed) throw new Error('Empty JSON');
        // assign and normalize using existing ensureDataShape logic
        data = parsed;
        ensureDataShape();
        saveLocalData();
        renderCategorySelect();
        currentCardIndex = 0;
        showingFront = true;
        renderCard();
        alert('Đã import data.json thành công (đã lưu local).');
      } catch (err) {
        console.error('Import lỗi', err);
        alert('File JSON không hợp lệ.');
      }
    };
    reader.readAsText(file);
  };

  exportBtn?.addEventListener('click', exportData);
  importBtn?.addEventListener('click', () => importInput?.click());
  importInput?.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) importDataFromFile(f);
    e.target.value = ''; // reset input
  });

  // =======================
  // Event Listeners
  // =======================
  flashcard?.addEventListener('click', flipCard);
  flashcard?.addEventListener('touchend', (e) => {
    e.preventDefault();
    flipCard();
  });

  // --- Prevent long-press flicker / native context menu on iOS PWA ---
  if (flashcard) {
    let lpTimer = null;
    const LP_DELAY = 500; // ms, long-press threshold

    // prevent the long-press context menu (only for flashcard)
    flashcard.addEventListener(
      'contextmenu',
      (ev) => {
        ev.preventDefault();
      },
      { passive: false }
    );

    flashcard.addEventListener(
      'touchstart',
      (ev) => {
        if (ev.touches && ev.touches.length > 1) return; // ignore multi-touch
        lpTimer = setTimeout(() => {
          // On long press, prevent default to avoid iOS special UI/selection
          // Use preventDefault on the last touch event when it fires (we can't call it here safely)
          // Add a temporary flag class to reduce visual flicker
          flashcard.classList.add('no-touch-flicker');
        }, LP_DELAY);
      },
      { passive: true }
    );

    const clearLP = () => {
      if (lpTimer) {
        clearTimeout(lpTimer);
        lpTimer = null;
      }
      flashcard.classList.remove('no-touch-flicker');
    };

    flashcard.addEventListener(
      'touchend',
      (ev) => {
        clearLP();
      },
      { passive: true }
    );
    flashcard.addEventListener('touchmove', clearLP, { passive: true });
    flashcard.addEventListener('touchcancel', clearLP, { passive: true });
  }

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

  // Prevent double-tap-to-zoom on iOS while keeping form controls usable
  (function preventDoubleTapZoom() {
    let lastTouch = 0;
    document.addEventListener(
      'touchend',
      (e) => {
        // ignore touches on form controls / contenteditable
        const tag = (e.target && e.target.tagName) || '';
        const isControl =
          /^(INPUT|TEXTAREA|SELECT|BUTTON)$/i.test(tag) ||
          e.target.isContentEditable;
        if (isControl) {
          lastTouch = Date.now();
          return;
        }
        const now = Date.now();
        if (now - lastTouch <= 300) {
          // second tap within 300ms -> prevent zoom
          e.preventDefault();
        }
        lastTouch = now;
      },
      { passive: false }
    );
  })();

  // =======================
  // Initial Load
  // =======================
  loadLocalData();
  await loadData();

  // Auto sync khi online: giờ không có server, nên chỉ reload data.json khi online
  setInterval(() => {
    if (navigator.onLine) loadData();
  }, 15000);
});
