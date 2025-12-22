// Flashcard App JS (chỉ dùng localStorage, bỏ data.json và import file)
// =======================
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
  const deleteCategoryBtn = document.getElementById('deleteCategoryBtn');
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
  // Lưu local nhưng KHÔNG đặt flag modified (dùng khi đồng bộ từ remote)
  const saveLocalDataNoMark = () => {
    try {
      localStorage.setItem('flashcardData', JSON.stringify(data));
      console.log('✅ Saved local flashcardData (no modified flag)');
    } catch (err) {
      console.error('Lỗi lưu localStorage (no mark):', err);
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
  // Load từ localStorage (không dùng data.json nữa)
  // =======================
  const loadData = async () => {
    // Chỉ tải từ localStorage
    loadLocalData();
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
    const cards = getVisibleCards();
    if (!cards.length) return;

    showingFront = !showingFront;
    if (!showingFront) {
      const card = cards[currentCardIndex];
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





  exportBtn?.addEventListener('click', exportData);

  // =======================
  // Event Listeners cho flashcard (iOS-safe)
  // =======================
  if (flashcard) {
    let startX = 0;
    let startY = 0;
    let touchMoved = false;
    let touchActive = false;
    let lastTouchWasSwipe = false;
    const MOVE_TOLERANCE = 10; // px

    // Bắt đầu chạm
    flashcard.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length > 1) return; // bỏ multi-touch
        const t = e.touches[0];
        startX = t.clientX;
        startY = t.clientY;
        touchMoved = false;
        touchActive = true;
      },
      { passive: true }
    );

    // Kiểm tra có kéo/di chuyển không
    flashcard.addEventListener(
      'touchmove',
      (e) => {
        if (!touchActive) return;
        const t = e.touches[0];
        if (
          Math.abs(t.clientX - startX) > MOVE_TOLERANCE ||
          Math.abs(t.clientY - startY) > MOVE_TOLERANCE
        ) {
          touchMoved = true;
        }
      },
      { passive: true }
    );

    // Kết thúc chạm
    flashcard.addEventListener(
      'touchend',
      (e) => {
        if (!touchActive) return;
        // chặn zoom / click mặc định cho gesture trên thẻ
        e.preventDefault();

        if (!touchMoved) {
          // TAP: chạm không kéo -> lật thẻ
          flipCard();
          lastTouchWasSwipe = false;
        } else {
          // SWIPE/KÉO: không lật, chỉ ghi nhận là swipe
          lastTouchWasSwipe = true;
        }

        touchActive = false;
      },
      { passive: false }
    );

    flashcard.addEventListener('touchcancel', () => {
      touchActive = false;
      touchMoved = false;
    });

    // Chặn menu context trên iOS
    flashcard.addEventListener('contextmenu', (e) => e.preventDefault());

    // Xử lý click synthetic mà iOS bắn sau touch
    flashcard.addEventListener('click', (e) => {
      if (lastTouchWasSwipe) {
        // nếu vừa swipe xong, bỏ qua click giả
        e.preventDefault();
        e.stopImmediatePropagation();
        lastTouchWasSwipe = false;
        return;
      }
      // click thực (chuột / tap từ thiết bị khác): lật thẻ
      flipCard();
    });
  }

  // =======================
  // Event Listeners khác
  // =======================
  nextBtn?.addEventListener('click', nextCard);
  prevBtn?.addEventListener('click', prevCard);
  addBtn?.addEventListener('click', () => showForm(false));
  editBtn?.addEventListener('click', () => showForm(true));
  deleteBtn?.addEventListener('click', async () => {
    const cards = getVisibleCards();
    if (!cards.length) return;
    const ok = confirm('Bạn có chắc muốn xóa thẻ này?');
    if (!ok) return;
    const cat = data.categories[data.currentCategoryIndex];
    const card = cards[currentCardIndex];
    const realIndex = cat.cards.indexOf(card);
    if (realIndex >= 0) cat.cards.splice(realIndex, 1);
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

  // Xóa cả nhóm (category)
  deleteCategoryBtn?.addEventListener('click', async () => {
    if (!data.categories || !data.categories.length) return;
    const cat = data.categories[data.currentCategoryIndex];
    const name = cat && cat.name ? cat.name : 'Nhóm';
    const ok = confirm(
      `Bạn có chắc muốn xóa cả nhóm "${name}" và tất cả thẻ trong nhóm này?`
    );
    if (!ok) return;
    data.categories.splice(data.currentCategoryIndex, 1);
    data.currentCategoryIndex = Math.max(0, data.currentCategoryIndex - 1);
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
        // ignore touches trên form controls / contenteditable
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
