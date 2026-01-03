// =======================
// Flashcard App JS (hoàn chỉnh + offline từ data.json + localStorage)
// =======================

// NOTE: Bỏ server — chỉ dùng data.json (static) và localStorage
let relatedCycle = {
  key: null,
  list: [],
  index: 0,
};

let touchStartX = 0;
let touchStartY = 0;
let isSwiping = false;

let currentCard = null;
let data = { categories: [], currentCategoryIndex: 0 };
let currentCardIndex = 0;
let showingFront = true;
let editingIndex = null;

function highlightJapanese(html) {
  if (!html) return html;

  const rtStore = [];
  const linkStore = [];

  // 1. Tạm thay <rt>...</rt>
  html = html.replace(/<rt>.*?<\/rt>/g, (match) => {
    rtStore.push(match);
    return `__RT_${rtStore.length - 1}__`;
  });

  // 2. Tạm thay related-link
  html = html.replace(
    /<span class="related-link"[^>]*>.*?<\/span>/g,
    (match) => {
      linkStore.push(match);
      return `__LINK_${linkStore.length - 1}__`;
    }
  );

  // 3. Highlight tiếng Nhật
  html = html.replace(
    /([\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9faf]+)/g,
    '<span class="jp">$1</span>'
  );

  // 4. Khôi phục related-link
  html = html.replace(/__LINK_(\d+)__/g, (_, i) => linkStore[i]);

  // 5. Khôi phục <rt>
  html = html.replace(/__RT_(\d+)__/g, (_, i) => rtStore[i]);

  return html;
}

const ensureDataShape = () => {
  if (!data || typeof data !== 'object')
    data = { categories: [], currentCategoryIndex: 0 };
  if (!Array.isArray(data.categories)) data.categories = [];
  if (typeof data.currentCategoryIndex !== 'number')
    data.currentCategoryIndex = 0;
};

// new: remove duplicate cards within each category (compare by front text)
const removeDuplicateCards = () => {
  let totalRemoved = 0;
  data.categories.forEach((cat) => {
    if (!Array.isArray(cat.cards) || cat.cards.length <= 1) return;
    const seen = new Set();
    const deduped = [];
    for (const card of cat.cards) {
      const key =
        card && card.front ? String(card.front).trim().toLowerCase() : '';
      if (!key) {
        // keep empty-front cards (optional) — treat as unique by index
        deduped.push(card);
        continue;
      }
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(card);
      } else {
        totalRemoved++;
      }
    }
    cat.cards = deduped;
  });
  if (totalRemoved > 0) {
    console.log(
      `✅ Removed ${totalRemoved} duplicate card(s) across categories (by front)`
    );
  }
  return totalRemoved;
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
      console.log('✅ Saved local flashcardData');
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

    // Try server API first (when chạy trên Node server)
    let fileData = null;
    try {
      const res = await fetch('/api/data', { cache: 'no-store' });
      if (!res.ok) throw new Error(`API /api/data HTTP ${res.status}`);
      fileData = await res.json();
      console.log('✅ Loaded data from /api/data (server)');
    } catch (apiErr) {
      console.warn(
        '⚠️ /api/data không khả dụng, thử ./data.json —',
        apiErr.message
      );
      // fallback: load static data.json
      try {
        const res2 = await fetch('./data.json', { cache: 'no-store' });
        if (!res2.ok) throw new Error(`data.json HTTP ${res2.status}`);
        fileData = await res2.json();
        console.log('✅ Loaded data from ./data.json');
      } catch (e) {
        console.warn(
          '⚠️ Không thể tải data.json, dùng localStorage/mặc định —',
          e.message
        );
        // nếu local chưa có nhóm thì tạo mặc định
        if (!data.categories || data.categories.length === 0) {
          data = {
            categories: [{ name: 'Mặc định', cards: [] }],
            currentCategoryIndex: 0,
          };
          saveLocalData();
        }
      }
    }

    // nếu có fileData thì chuẩn hoá giống logic trước
    // nếu có fileData thì chuẩn hoá giống logic trước
    try {
      if (fileData !== null) {
        // --- Parse fileData -> candidateData (không gán thẳng vào data nữa) ---
        let candidateData = null;

        if (
          Array.isArray(fileData) &&
          fileData.length &&
          fileData[0] &&
          Array.isArray(fileData[0].categories)
        ) {
          candidateData = fileData[0];
          console.log('✅ candidate: array single object -> element 0');
        } else if (Array.isArray(fileData)) {
          if (
            fileData.length &&
            fileData[0] &&
            Array.isArray(fileData[0].cards)
          ) {
            candidateData = { categories: fileData, currentCategoryIndex: 0 };
            console.log('✅ candidate: array of categories');
          } else if (
            fileData.length &&
            fileData[0] &&
            (fileData[0].front || fileData[0].back)
          ) {
            candidateData = {
              categories: [{ name: 'Mặc định', cards: fileData }],
              currentCategoryIndex: 0,
            };
            console.log('✅ candidate: array of cards -> wrapped');
          }
        } else if (fileData && typeof fileData === 'object') {
          if (Array.isArray(fileData.categories)) {
            candidateData = fileData;
            console.log('✅ candidate: object with categories');
          } else if (Array.isArray(fileData.cards)) {
            candidateData = {
              categories: [
                { name: fileData.name || 'Mặc định', cards: fileData.cards },
              ],
              currentCategoryIndex: 0,
            };
            console.log('✅ candidate: object with cards -> wrapped');
          }
        }

        // Chuẩn hoá candidate (nếu có)
        if (candidateData) {
          // đảm bảo shape
          const oldData = data; // data hiện tại (đang lấy từ localStorage)
          data = candidateData;
          ensureDataShape();

          // --- QUY TẮC QUAN TRỌNG: chỉ overwrite nếu local đang trống ---
          const localHasCards =
            oldData?.categories?.some((c) => (c.cards?.length || 0) > 0) ||
            false;

          const candidateHasCards =
            data?.categories?.some((c) => (c.cards?.length || 0) > 0) || false;

          if (localHasCards) {
            // local đang có dữ liệu -> KHÔNG overwrite
            data = oldData;
            console.log(
              '🛡️ Giữ LOCAL (đang có thẻ), không overwrite bằng server/file'
            );
          } else if (candidateHasCards) {
            // local trống -> dùng server/file để seed
            console.log('⬇️ Local trống -> dùng dữ liệu từ server/file');
            const removed = removeDuplicateCards();
            saveLocalData();
            if (removed > 0) console.log(`🧹 Removed duplicates: ${removed}`);
          } else {
            // cả hai đều trống -> giữ local
            data = oldData;
            console.log('🛡️ Cả local và server/file đều trống -> giữ local');
          }
        } else {
          console.warn(
            'data: không nhận dạng được cấu trúc fileData, giữ localStorage'
          );
        }
      }
    } catch (normalizeErr) {
      console.warn('Lỗi khi chuẩn hoá dữ liệu:', normalizeErr);
    }

    renderCategorySelect();
    renderCard();
  };

  // =======================
  // Save chỉ local + cố gắng sync lên server
  // =======================
  const saveData = async () => {
    // luôn lưu local trước
    saveLocalData();

    // Thử gửi lên server (nếu có)
    try {
      const res = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        console.log('✅ Synced data to server /api/data');
      } else {
        console.warn('⚠️ Server lưu thất bại:', res.status);
      }
    } catch (err) {
      console.warn(
        '⚠️ Không thể sync lên server (vẫn ok nếu chạy static):',
        err.message
      );
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
  // Mới: Chuyển các [[word]] thành liên kết nội bộ
  function convertRelatedLinks(text) {
    return text.replace(/\[\[(.*?)\]\]/g, (_, word) => {
      const cleanKey = word.replace(/<[^>]*>/g, '');
      return `<span class="related-link" data-key="${cleanKey}">${word}</span>`;
    });
  }

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
    currentCard = card; // ⭐ BẮT BUỘC PHẢI CÓ

    const rawText = showingFront ? card.front : card.back;

    const withLinks = convertRelatedLinks(rawText);
    const withFurigana = convertFurigana(withLinks);
    const finalHTML = highlightJapanese(withFurigana);

    flashcard.innerHTML = finalHTML;

    counter.textContent = `${currentCardIndex + 1} / ${cards.length}`;

    if (slider) {
      slider.max = Math.max(0, cards.length - 1);
      slider.value = currentCardIndex;
      sliderContainer.style.display = 'block';
    }
  };

  // Mới: Chuẩn hoá text để so sánh (bỏ furigana, khoảng trắng)
  function normalizeText(text) {
    if (!text) return '';

    return text
      .replace(/\[\[|\]\]/g, '') // 🔥 bỏ [[ ]]
      .replace(/\([\u3040-\u309F]+\)/g, '') // bỏ (ひんしつ)
      .replace(/[\u3040-\u309F]+/g, '') // bỏ hiragana
      .replace(/\s+/g, '') // bỏ khoảng trắng
      .trim();
  }

  // Mới: Bỏ HTML tags
  function stripHtml(text) {
    if (!text) return '';
    return text.replace(/<[^>]*>/g, '');
  }

  // Mới: Hàm nhảy đến thẻ liên quan
  function jumpToRelatedCard(keyword) {
    const stripped = stripHtml(keyword);
    const key = normalizeText(stripped);

    // 🔁 keyword mới → build lại vòng
    if (relatedCycle.key !== key) {
      relatedCycle.key = key;
      relatedCycle.list = [];
      relatedCycle.index = 0;

      data.categories.forEach((cat, catIndex) => {
        cat.cards?.forEach((c, cardIndex) => {
          if (
            normalizeText(c.front).includes(key) ||
            normalizeText(c.back).includes(key)
          ) {
            relatedCycle.list.push({
              catIndex,
              cardIndex,
            });
          }
        });
      });

      if (!relatedCycle.list.length) {
        alert(`Không tìm thấy thẻ liên quan với "${keyword}"`);
        return;
      }
    }
    // 🔥 bỏ qua thẻ hiện tại nếu trùng
    if (relatedCycle.list.length > 1) {
      const currentCat = data.currentCategoryIndex;
      const currentIdx = currentCardIndex;

      if (
        relatedCycle.list[0].catIndex === currentCat &&
        relatedCycle.list[0].cardIndex === currentIdx
      ) {
        relatedCycle.index = 1;
      }
    }

    // 🔁 lấy item tiếp theo (vòng tròn)
    const item = relatedCycle.list[relatedCycle.index];
    relatedCycle.index = (relatedCycle.index + 1) % relatedCycle.list.length;

    // ✅ chuyển category
    data.currentCategoryIndex = item.catIndex;
    renderCategorySelect();

    // ✅ tắt filter
    if (showUnlearnedOnly) showUnlearnedOnly.checked = false;

    // ✅ set index trực tiếp (KHÔNG indexOf)
    currentCardIndex = item.cardIndex;
    currentCard = data.categories[item.catIndex].cards[item.cardIndex];

    showingFront = true;
    renderCard();
  }

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
  const flipCard = (e) => {
    // 🔥 nếu click vào link liên quan → KHÔNG flip
    if (e?.target?.closest('.related-link')) return;

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

    const normFront = front.toLowerCase();

    if (editingIndex !== null) {
      const card = getVisibleCards()[editingIndex];
      const realIndex = cat.cards.indexOf(card);

      // kiểm tra trùng (ngoại trừ chính thẻ đang sửa)
      const duplicateIndex = cat.cards.findIndex(
        (c, idx) =>
          idx !== realIndex &&
          c &&
          c.front &&
          c.front.trim().toLowerCase() === normFront
      );
      if (duplicateIndex >= 0) {
        const proceed = confirm(
          'Cảnh báo: Đã tồn tại thẻ có cùng tiêu đề trong nhóm này. Bạn có muốn tiếp tục ghi đè?'
        );
        if (!proceed) return;
      }

      cat.cards[realIndex] = {
        front,
        back,
        learned: cat.cards[realIndex].learned || false,
      };
      currentCardIndex = editingIndex;
    } else {
      // kiểm tra trùng khi thêm mới
      const duplicateIndex = cat.cards.findIndex(
        (c) => c && c.front && c.front.trim().toLowerCase() === normFront
      );
      if (duplicateIndex >= 0) {
        const proceed = confirm(
          'Cảnh báo: Đã tồn tại thẻ có cùng tiêu đề trong nhóm này. Bạn có muốn thêm bản sao?'
        );
        if (!proceed) return;
      }

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

        // remove duplicates after importing
        const removed = removeDuplicateCards();
        saveLocalData();
        renderCategorySelect();
        currentCardIndex = 0;
        showingFront = true;
        renderCard();
        if (removed > 0) {
          alert(
            `Đã import thành công. Đã tự động xóa ${removed} thẻ trùng lặp.`
          );
        } else {
          alert('Đã import data.json thành công (đã lưu local).');
        }
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
  flashcard?.addEventListener('click', (e) => {
    if ('ontouchstart' in window) return; // iOS / Android
    if (e.target.closest('.related-link')) return;
    flipCard(e);
  });

  flashcard?.addEventListener('touchend', (e) => {
    if (e.target.closest('.related-link')) return;
    // ❌ Vuốt → không flip
    if (isSwiping) return;

    e.preventDefault();
    flipCard(e);
  });
  flashcard.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    isSwiping = false;
  });

  flashcard.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    const dx = Math.abs(t.clientX - touchStartX);
    const dy = Math.abs(t.clientY - touchStartY);

    if (dx > 10 || dy > 10) {
      isSwiping = true;
    }
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
  // Mới: Xử lý click vào thẻ liên quan
  flashcard.addEventListener('click', (e) => {
    const target = e.target.closest('.related-link');
    if (!target) return;

    e.preventDefault();
    e.stopImmediatePropagation();

    console.log('CLICK LINK:', target.dataset.key);
    jumpToRelatedCard(target.dataset.key);
  });

  // =======================
  // Initial Load
  // =======================
  loadLocalData();
  await loadData();

  // Auto sync khi online: giờ không có server, nên chỉ reload data.json khi online
});
