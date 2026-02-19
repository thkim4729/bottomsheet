/**
 * [Library] Ultimate Date Picker (A11y & Keypad Optimized)
 * - 휠 정착 시 실시간 음성 안내 (aria-live)
 * - 인풋 복귀 시 키패드 팝업 방지 로직 포함
 */
document.addEventListener("DOMContentLoaded", initDatePicker);

function initDatePicker() {
  // ============================================================
  // 1. [핵심 설정] CONFIG
  // ============================================================
  const CONFIG = {
    minYear: new Date().getFullYear() - 50,
    maxYear: new Date().getFullYear() + 50,
    manualInput: true, // 직접 입력 허용 여부
    showDayOfWeek: true, // 요일 표시 여부
    blockWeekends: false, // 주말 차단 여부
    blockHolidays: false, // 공휴일 차단 여부
    autoDayAdjust: true, // 월별 일수 자동 조정
    enterToSelect: true, // Enter 키 완료 여부
    useMockData: true, // 가짜 데이터 사용 모드

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
      yearAriaLabel: "연도를 선택해주세요",
      monthAriaLabel: "월을 선택해주세요",
      dayAriaLabel: "일을 선택해주세요",
    },
  };

  // ============================================================
  // 2. [API 서비스 레이어]
  // ============================================================
  const ApiService = {
    cache: {},
    async fetchHolidays(year) {
      if (this.cache[year]) return this.cache[year];
      if (CONFIG.useMockData) {
        await new Promise((r) => setTimeout(r, 200));
        const mock = [
          "01-01",
          "03-01",
          "05-05",
          "06-06",
          "08-15",
          "10-03",
          "10-09",
          "12-25",
        ];
        this.cache[year] = mock;
        return mock;
      }
      return [];
    },
  };

  // ============================================================
  // 3. [시스템 상태 및 UI 참조]
  // ============================================================
  const state = {
    activeInput: null,
    scrollTimer: null,
    lastFocusedElement: null,
    isTicking: false,
    // [신규] 스크린리더에게 읽어줄 메시지를 담는 영역
    liveRegion: null,
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

        // 초기 수동 입력 설정
        input.readOnly = !CONFIG.manualInput;

        input.addEventListener("blur", () => validateInput(input));
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") input.blur();
        });
        input.addEventListener("input", () => clearError(container));

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

    // [A11y] 휠 안내 메시지 설정
    const labels = [
      CONFIG.locale.yearAriaLabel,
      CONFIG.locale.monthAriaLabel,
      CONFIG.locale.dayAriaLabel,
    ];
    [ui.cols.year, ui.cols.month, ui.cols.day].forEach((col, i) => {
      if (col) {
        col.setAttribute("tabindex", "0");
        col.setAttribute("role", "listbox");
        col.setAttribute("aria-label", labels[i]);
      }
    });

    // [신규] 스크린리더 공지용 aria-live 영역 생성 (화면엔 보이지 않음)
    state.liveRegion = document.createElement("div");
    state.liveRegion.className = "sr-only";
    state.liveRegion.setAttribute("aria-live", "polite");
    state.liveRegion.setAttribute("aria-atomic", "true");
    document.body.appendChild(state.liveRegion);

    document.querySelector(".btn-close").addEventListener("click", closeSheet);
    ui.overlay.addEventListener("click", closeSheet);
    ui.btnDone.addEventListener("click", confirmSelection);
  }

  function trapFocus(e) {
    if (e.key !== "Tab") return;
    const focusables = ui.sheet.querySelectorAll('button, [tabindex="0"]');
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  // ============================================================
  // 4. 비동기 시트 제어 및 키패드 방지
  // ============================================================
  async function openSheet(input, container) {
    state.lastFocusedElement = input;
    state.activeInput = input;
    clearError(container);

    const computedStyle = getComputedStyle(container);
    const themeColor = computedStyle.getPropertyValue("--picker-color").trim();
    if (themeColor && ui.sheet)
      ui.sheet.style.setProperty("--picker-color", themeColor);

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

    ui.sheet.setAttribute("tabindex", "-1");
    ui.overlay.classList.add("is-active");
    ui.sheet.classList.add("is-active");
    ui.sheet.addEventListener("keydown", trapFocus);
    setTimeout(() => ui.sheet.focus(), 50);
  }

  /**
   * [closeSheet] 키패드 방지 로직 포함
   */
  function closeSheet() {
    ui.overlay.classList.remove("is-active");
    ui.sheet.classList.remove("is-active");
    ui.sheet.removeAttribute("tabindex");
    ui.sheet.removeEventListener("keydown", trapFocus);

    if (state.lastFocusedElement) {
      const input = state.lastFocusedElement;

      /**
       * [키패드 방지 핵심]
       * 1. 인풋을 일시적으로 readonly로 바꿉니다.
       * 2. 포커스를 줍니다. (이때 브라우저는 편집 불가능한 창이라 판단해 키패드를 올리지 않습니다.)
       * 3. 아주 짧은 지연 후 원래의 편집 권한(CONFIG.manualInput)을 되돌려줍니다.
       */
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
    if (isDateBlocked(y, m, d)) {
      showError(activeInput.closest(".input-group"));
      closeSheet();
      return;
    }
    activeInput.value = formatDateString(y, m, d);
    closeSheet();
  }

  // ============================================================
  // 5. 비즈니스 로직
  // ============================================================
  function formatDateString(y, m, d) {
    let str = `${y}년 ${String(m).padStart(2, "0")}월 ${String(d).padStart(2, "0")}일`;
    if (CONFIG.showDayOfWeek)
      str += ` ${CONFIG.locale.days[new Date(y, m - 1, d).getDay()]}`;
    return str;
  }

  function isDateBlocked(y, m, d) {
    if (!y || !m || !d) return false;
    const date = new Date(y, m - 1, d);
    if (CONFIG.blockWeekends && (date.getDay() === 0 || date.getDay() === 6))
      return true;
    if (CONFIG.blockHolidays) {
      const list = ApiService.cache[y];
      const mmdd = `${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      if (list && list.includes(mmdd)) return true;
    }
    return false;
  }

  // ============================================================
  // 6. 휠 렌더링 및 톡백 공지 강화
  // ============================================================
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

      li.addEventListener("focus", () => {
        li.scrollIntoView({ block: "center", behavior: "smooth" });
      });

      li.addEventListener("click", () => {
        li.scrollIntoView({ block: "center", behavior: "smooth" });
      });

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

  function handleWheelKeyboard(e, col) {
    const h = 40;
    if (e.key === "ArrowUp") {
      e.preventDefault();
      col.scrollBy({ top: -h, behavior: "smooth" });
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      col.scrollBy({ top: h, behavior: "smooth" });
    } else if (e.key === "Enter" && CONFIG.enterToSelect) {
      e.preventDefault();
      confirmSelection();
    }
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

  /**
   * [onScrollEnd] 스크롤 정착 시 실행
   * @param {HTMLElement} col - 스크롤이 발생한 컬럼
   */
  async function onScrollEnd(col) {
    const y = getWheelValue(ui.cols.year),
      m = getWheelValue(ui.cols.month),
      d = getWheelValue(ui.cols.day);

    // [신규] 스크린리더 공지 로직
    // 현재 스크롤이 끝난 컬럼의 값을 찾아 음성으로 읽어줍니다.
    const currentValue = getWheelValue(col);
    if (currentValue && state.liveRegion) {
      let suffix = "";
      if (col === ui.cols.year) suffix = CONFIG.locale.yearSuffix;
      else if (col === ui.cols.month) suffix = CONFIG.locale.monthSuffix;
      else if (col === ui.cols.day) suffix = CONFIG.locale.daySuffix;

      // liveRegion의 텍스트를 변경하면 스크린리더가 이를 감지하여 읽습니다.
      state.liveRegion.textContent = `${currentValue}${suffix}가 선택되었습니다.`;
    }

    if (CONFIG.blockHolidays && y) await ApiService.fetchHolidays(y);
    if (CONFIG.autoDayAdjust && y && m) {
      const max = new Date(y, m, 0).getDate();
      if (max !== ui.cols.day.querySelectorAll("li").length) {
        renderWheel(
          ui.cols.day,
          1,
          max,
          d > max ? max : d,
          CONFIG.locale.daySuffix,
        );
      }
    }
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

  async function validateInput(input) {
    const d = parseDate(input.value);
    const container = input.closest(".input-group");
    if (d) {
      if (CONFIG.blockHolidays) await ApiService.fetchHolidays(d.y);
      if (!isDateBlocked(d.y, d.m, d.d)) {
        input.value = formatDateString(d.y, d.m, d.d);
        clearError(container);
        return;
      }
    }
    if (input.value.trim() !== "") showError(container);
  }

  function showError(c) {
    c?.querySelector(".error-text")?.classList.add("show");
    c?.querySelector(".picker-wrapper")?.classList.add("input-error");
  }

  function clearError(c) {
    c?.querySelector(".error-text")?.classList.remove("show");
    c?.querySelectorAll(".picker-wrapper").forEach((w) =>
      w.classList.remove("input-error"),
    );
  }

  setup();
}
