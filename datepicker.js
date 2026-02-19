/**
 * [Library] Ultimate Date Picker (Box Jump & A11y Optimized)
 * - 휠 박스 간 점프 버튼 제공 (톡백 사용자용)
 * - 방향키(좌/우)를 통한 컬럼 간 이동 지원
 */
document.addEventListener("DOMContentLoaded", initDatePicker);

function initDatePicker() {
  const CONFIG = {
    minYear: new Date().getFullYear() - 50,
    maxYear: new Date().getFullYear() + 50,
    manualInput: true,
    showDayOfWeek: true,
    blockWeekends: false,
    blockHolidays: false,
    autoDayAdjust: true,
    enterToSelect: true,
    useMockData: true,
    locale: {
      yearSuffix: "년",
      monthSuffix: "월",
      daySuffix: "일",
      days: [
        "일요일",
        "월요일",
        "화요일",
        "수요일",
        "목요일",
        "금요일",
        "토요일",
      ],
      yearAriaLabel: "연도 선택",
      monthAriaLabel: "월 선택",
      dayAriaLabel: "일 선택",
      // [신규] 탐색용 문구
      jumpToMonth: "월 선택으로 건너뛰기",
      jumpToDay: "일 선택으로 건너뛰기",
      jumpToYear: "연도 선택으로 건너뛰기",
    },
  };

  const ApiService = {
    cache: {},
    async fetchHolidays(year) {
      if (this.cache[year]) return this.cache[year];
      if (CONFIG.useMockData) {
        await new Promise((r) => setTimeout(r, 200));
        this.cache[year] = [
          "01-01",
          "03-01",
          "05-05",
          "06-06",
          "08-15",
          "10-03",
          "10-09",
          "12-25",
        ];
        return this.cache[year];
      }
      return [];
    },
  };

  const state = {
    activeInput: null,
    scrollTimer: null,
    lastFocusedElement: null,
    isTicking: false,
    liveRegion: null,
    announcementTimer: null,
  };

  const ui = {
    sheet: null,
    overlay: null,
    btnDone: null,
    cols: { year: null, month: null, day: null },
  };

  function setup() {
    cacheUI();
    document.querySelectorAll(".date_picker").forEach((container) => {
      container.querySelectorAll(".picker-wrapper").forEach((wrapper) => {
        const input = wrapper.querySelector(".picker-input");
        const iconBtn = wrapper.querySelector(".picker-icon-btn");
        if (!input) return;
        input.readOnly = !CONFIG.manualInput;
        input.addEventListener("blur", () => validateInput(input));
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") input.blur();
        });
        const trigger = iconBtn || wrapper;
        trigger.addEventListener("click", (e) => {
          e.stopPropagation();
          openSheet(input, container);
        });
      });
    });
  }

  function cacheUI() {
    if (ui.sheet) return;
    ui.overlay = document.querySelector(".picker-overlay");
    ui.sheet = document.querySelector(".bottom-sheet");
    ui.btnDone = document.querySelector(".btn-done");
    ui.cols.year = document.querySelector(".year-col");
    ui.cols.month = document.querySelector(".month-col");
    ui.cols.day = document.querySelector(".day-col");

    // [A11y] 휠 컬럼에 그룹 역할 부여
    [ui.cols.year, ui.cols.month, ui.cols.day].forEach((col, i) => {
      if (col) {
        col.setAttribute("tabindex", "0");
        col.setAttribute("role", "group"); // 박스 단위 인식을 위해 group으로 설정
        const labels = [
          CONFIG.locale.yearAriaLabel,
          CONFIG.locale.monthAriaLabel,
          CONFIG.locale.dayAriaLabel,
        ];
        col.setAttribute("aria-label", labels[i]);
      }
    });

    state.liveRegion = document.createElement("div");
    state.liveRegion.className = "sr-only";
    state.liveRegion.setAttribute("aria-live", "polite");
    document.body.appendChild(state.liveRegion);

    document.querySelector(".btn-close").addEventListener("click", closeSheet);
    ui.overlay.addEventListener("click", closeSheet);
    ui.btnDone.addEventListener("click", confirmSelection);
  }

  function speak(msg) {
    if (state.announcementTimer) clearTimeout(state.announcementTimer);
    state.announcementTimer = setTimeout(() => {
      if (state.liveRegion) {
        state.liveRegion.textContent = "";
        state.liveRegion.textContent = msg;
      }
    }, 50);
  }

  // ============================================================
  // [신규] 컬럼 간 이동을 돕는 탐색 버튼 생성 함수
  // ============================================================
  function addJumpButton(col, targetCol, label) {
    if (!targetCol) return;
    const btn = document.createElement("button");
    btn.className = "sr-only focusable-sr-only"; // 톡백 포커스 시에만 작동
    btn.textContent = label;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      targetCol.focus(); // 다음 박스로 강제 이동
    });
    col.prepend(btn); // 휠 리스트 가장 상단에 배치
  }

  async function openSheet(input, container) {
    state.lastFocusedElement = input;
    state.activeInput = input;

    const d = parseDate(input.value) || {
      y: new Date().getFullYear(),
      m: new Date().getMonth() + 1,
      d: new Date().getDate(),
    };
    if (CONFIG.blockHolidays) await ApiService.fetchHolidays(d.y);

    renderWheel(
      ui.cols.year,
      CONFIG.minYear,
      CONFIG.maxYear,
      d.y,
      CONFIG.locale.yearSuffix,
    );
    renderWheel(ui.cols.month, 1, 12, d.m, CONFIG.locale.monthSuffix);
    renderWheel(
      ui.cols.day,
      1,
      new Date(d.y, d.m, 0).getDate(),
      d.d,
      CONFIG.locale.daySuffix,
    );

    // [A11y] 점프 버튼 동적 추가 (연도 -> 월, 월 -> 일 이동)
    addJumpButton(ui.cols.year, ui.cols.month, CONFIG.locale.jumpToMonth);
    addJumpButton(ui.cols.month, ui.cols.day, CONFIG.locale.jumpToDay);
    addJumpButton(ui.cols.day, ui.cols.year, CONFIG.locale.jumpToYear);

    ui.sheet.classList.add("is-active");
    ui.overlay.classList.add("is-active");
    setTimeout(() => ui.sheet.focus(), 50);
  }

  function renderWheel(col, min, max, current, label) {
    const ul = col.querySelector(".wheel-list");
    while (ul.firstChild) ul.removeChild(ul.firstChild);

    const fragment = document.createDocumentFragment();
    const colId = col.className.split(" ")[1];

    for (let i = min; i <= max; i++) {
      const li = document.createElement("li");
      const itemId = `picker-${colId}-${i}`;
      li.id = itemId;
      li.className = "wheel-item";
      li.textContent = i + label;
      li.setAttribute("data-val", i);
      li.setAttribute("role", "option");
      li.setAttribute("tabindex", "-1");

      li.addEventListener("focus", () =>
        li.scrollIntoView({ block: "center", behavior: "smooth" }),
      );
      li.addEventListener("click", () =>
        li.scrollIntoView({ block: "center", behavior: "smooth" }),
      );

      if (i === current) {
        li.classList.add("selected");
        li.setAttribute("aria-selected", "true");
        col.setAttribute("aria-activedescendant", itemId);
      }
      fragment.appendChild(li);
    }
    ul.appendChild(fragment);

    if (!col.dataset.hasScroll) {
      col.addEventListener(
        "scroll",
        () => {
          update3D(col);
          clearTimeout(state.scrollTimer);
          state.scrollTimer = setTimeout(() => onScrollEnd(col), 150);
        },
        { passive: true },
      );
      col.dataset.hasScroll = "true";
    }

    if (!col.dataset.hasKeyboard) {
      col.addEventListener("keydown", (e) => handleWheelKeyboard(e, col));
      col.dataset.hasKeyboard = "true";
    }

    setTimeout(() => {
      const target = ul.querySelector(".selected");
      if (target) {
        target.scrollIntoView({ block: "center", behavior: "auto" });
        update3D(col);
      }
    }, 50);
  }

  // [수정] 좌우 방향키로 컬럼 간 이동 기능 추가
  function handleWheelKeyboard(e, col) {
    const h = 40;
    if (e.key === "ArrowUp") {
      e.preventDefault();
      col.scrollBy({ top: -h, behavior: "smooth" });
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      col.scrollBy({ top: h, behavior: "smooth" });
    }
    // [신규] 좌우 키로 박스(연-월-일) 간 포커스 이동
    else if (e.key === "ArrowRight") {
      if (col === ui.cols.year) ui.cols.month.focus();
      else if (col === ui.cols.month) ui.cols.day.focus();
    } else if (e.key === "ArrowLeft") {
      if (col === ui.cols.day) ui.cols.month.focus();
      else if (col === ui.cols.month) ui.cols.year.focus();
    } else if (e.key === "Enter" && CONFIG.enterToSelect) {
      e.preventDefault();
      confirmSelection();
    }
  }

  // ... (update3D, onScrollEnd, getWheelValue, closeSheet 등 나머지 유틸리티 동일) ...
  function closeSheet() {
    ui.overlay.classList.remove("is-active");
    ui.sheet.classList.remove("is-active");
    if (state.lastFocusedElement) {
      const input = state.lastFocusedElement;
      const originalReadOnly = input.readOnly;
      input.readOnly = true;
      input.focus();
      setTimeout(() => {
        input.readOnly = originalReadOnly;
      }, 100);
      state.lastFocusedElement = null;
    }
  }

  function confirmSelection() {
    const { activeInput } = state;
    if (!activeInput) return;
    const y = getWheelValue(ui.cols.year),
      m = getWheelValue(ui.cols.month),
      d = getWheelValue(ui.cols.day);
    activeInput.value = formatDateString(y, m, d);
    closeSheet();
  }

  function getWheelValue(col) {
    const center = col.scrollTop + col.offsetHeight / 2;
    let closest = null,
      minDist = Infinity;
    col.querySelectorAll(".wheel-item").forEach((item) => {
      const dist = Math.abs(center - (item.offsetTop + item.offsetHeight / 2));
      if (dist < minDist) {
        minDist = dist;
        closest = item;
      }
    });
    return closest ? parseInt(closest.getAttribute("data-val")) : null;
  }

  function formatDateString(y, m, d) {
    let str = `${y}년 ${String(m).padStart(2, "0")}월 ${String(d).padStart(2, "0")}일`;
    if (CONFIG.showDayOfWeek)
      str += ` ${CONFIG.locale.days[new Date(y, m - 1, d).getDay()]}`;
    return str;
  }

  function parseDate(str) {
    const nums = str.replace(/[^0-9]/g, "");
    if (nums.length >= 8)
      return {
        y: +nums.substr(0, 4),
        m: +nums.substr(4, 2),
        d: +nums.substr(6, 2),
      };
    return null;
  }

  function update3D(col) {
    if (state.isTicking) return;
    state.isTicking = true;
    requestAnimationFrame(() => {
      const items = col.querySelectorAll(".wheel-item");
      const center = col.scrollTop + col.offsetHeight / 2;
      items.forEach((item) => {
        const itemCenter = item.offsetTop + item.offsetHeight / 2;
        const dist = Math.abs(center - itemCenter);
        if (dist < 20) {
          item.classList.add("selected");
          item.setAttribute("aria-selected", "true");
          col.setAttribute("aria-activedescendant", item.id);
        } else {
          item.classList.remove("selected");
          item.setAttribute("aria-selected", "false");
        }
        if (dist <= 150) {
          const angle = Math.max(Math.min((center - itemCenter) / 5, 50), -50);
          item.style.transform = `rotateX(${-angle}deg) translateZ(0)`;
          item.style.opacity = Math.max(1 - Math.pow(dist / 150, 2), 0.3);
        } else {
          item.style.opacity = "0.3";
          item.style.transform = "";
        }
      });
      state.isTicking = false;
    });
  }

  async function onScrollEnd(activeCol) {
    if (activeCol.dataset.preventAnnouncement === "true") return;
    const y = getWheelValue(ui.cols.year),
      m = getWheelValue(ui.cols.month),
      d = getWheelValue(ui.cols.day);
    const currentValue = getWheelValue(activeCol);
    if (currentValue) {
      let suffix =
        activeCol === ui.cols.year
          ? "년"
          : activeCol === ui.cols.month
            ? "월"
            : "일";
      speak(`${currentValue}${suffix}이 선택되었습니다.`);
    }
    if (CONFIG.autoDayAdjust && y && m && activeCol !== ui.cols.day) {
      const max = new Date(y, m, 0).getDate();
      const currentDayItems = ui.cols.day.querySelectorAll("li").length;
      if (max !== currentDayItems) {
        ui.cols.day.dataset.preventAnnouncement = "true";
        renderWheel(ui.cols.day, 1, max, d > max ? max : d, "일");
        setTimeout(() => {
          ui.cols.day.dataset.preventAnnouncement = "false";
        }, 300);
      }
    }
  }

  setup();
}
