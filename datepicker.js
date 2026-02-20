/**
 * [Final Master - Accessibility & Logic Combined]
 * - 톡백 개선: 목록 진입 시 "연도 선택 목록", "월 선택 목록" 등 목적 공지
 * - 요일 변수화: sun, mon... 개별 변수 매핑 사용
 * - 선택 로직: 스와이프 시 초점만 이동, 더블 탭(클릭) 시 선택 및 중앙 이동
 */
document.addEventListener("DOMContentLoaded", initDatePicker);

function initDatePicker() {
  const currentYear = new Date().getFullYear();

  // ============================================================
  // 1. [핵심 설정] CONFIG
  // ============================================================
  const CONFIG = {
    minYear: currentYear - 5,
    maxYear: currentYear,
    manualInput: true,
    showDayOfWeek: true,
    autoDayAdjust: true,

    locale: {
      yearSuffix: "년",
      monthSuffix: "월",
      daySuffix: "일",
      // 요일 변수화
      sun: "일요일",
      mon: "월요일",
      tue: "화요일",
      wed: "수요일",
      thu: "목요일",
      fri: "금요일",
      sat: "토요일",

      // [개선] 목록 상자에 대한 구체적인 설명
      yearAriaLabel: "연도 선택 목록상자",
      monthAriaLabel: "월 선택 목록상자",
      dayAriaLabel: "일 선택 목록상자",
    },
  };

  function getDayName(date) {
    const dayIndex = date.getDay();
    const { sun, mon, tue, wed, thu, fri, sat } = CONFIG.locale;
    const dayMap = [sun, mon, tue, wed, thu, fri, sat];
    return dayMap[dayIndex];
  }

  const state = {
    activeInput: null,
    scrollTimer: null,
    lastFocusedElement: null,
    isTicking: false,
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

    // [중요 수정] 각 컬럼의 ul에 구체적인 aria-label을 부여합니다.
    const colLabels = [
      CONFIG.locale.yearAriaLabel,
      CONFIG.locale.monthAriaLabel,
      CONFIG.locale.dayAriaLabel,
    ];
    [ui.cols.year, ui.cols.month, ui.cols.day].forEach((col, idx) => {
      if (col) {
        col.setAttribute("role", "none");
        const ul = col.querySelector(".wheel-list");
        if (ul) {
          ul.setAttribute("role", "listbox");
          ul.setAttribute("aria-label", colLabels[idx]); // 톡백이 "연도 선택 목록상자"라고 읽음
        }
      }
    });

    document.querySelector(".btn-close").addEventListener("click", closeSheet);
    ui.overlay.addEventListener("click", closeSheet);
    ui.btnDone.addEventListener("click", confirmSelection);
  }

  // ============================================================
  // 바텀 시트 제어 (Focus Trap)
  // ============================================================
  async function openSheet(input, container) {
    state.lastFocusedElement = input;
    state.activeInput = input;

    const d = parseDate(input.value) || {
      y: currentYear,
      m: new Date().getMonth() + 1,
      d: new Date().getDate(),
    };

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

    ui.sheet.classList.add("is-active");
    ui.overlay.classList.add("is-active");
    ui.sheet.setAttribute("tabindex", "-1");
    ui.sheet.addEventListener("keydown", trapFocus);

    setTimeout(() => {
      ui.sheet.focus();
    }, 150);
  }

  function closeSheet() {
    ui.overlay.classList.remove("is-active");
    ui.sheet.classList.remove("is-active");
    ui.sheet.removeEventListener("keydown", trapFocus);
    if (state.lastFocusedElement) {
      const input = state.lastFocusedElement;
      input.readOnly = true;
      input.focus();
      setTimeout(() => {
        input.readOnly = !CONFIG.manualInput;
      }, 150);
    }
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
  // 휠 렌더링 (더블 탭 선택 로직)
  // ============================================================
  function renderWheel(col, min, max, current, label) {
    const ul = col.querySelector(".wheel-list");
    while (ul.firstChild) ul.removeChild(ul.firstChild);

    const fragment = document.createDocumentFragment();
    let targetItem = null;

    for (let i = min; i <= max; i++) {
      const li = document.createElement("li");
      li.className = "wheel-item";
      li.textContent = i + label;
      li.setAttribute("data-val", i);
      li.setAttribute("role", "option");
      li.setAttribute("tabindex", "0");

      if (i === current) {
        li.classList.add("selected");
        li.setAttribute("aria-selected", "true");
        targetItem = li;
      }

      // 더블 탭(클릭) 시에만 선택 및 중앙 이동
      li.addEventListener("click", () => {
        li.scrollIntoView({ block: "center", behavior: "smooth" });
      });

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

    if (targetItem) {
      setTimeout(() => {
        targetItem.scrollIntoView({ block: "center", behavior: "auto" });
        update3D(col);
      }, 0);
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
        } else {
          item.classList.remove("selected");
          item.setAttribute("aria-selected", "false");
        }
        if (dist <= 250) {
          const angle = Math.max(Math.min((center - itemCenter) / 5, 50), -50);
          item.style.transform = `rotateX(${-angle}deg) translateZ(0)`;
          item.style.opacity = Math.max(1 - Math.pow(dist / 250, 2), 0.1);
        } else {
          item.style.opacity = "0";
        }
      });
      state.isTicking = false;
    });
  }

  async function onScrollEnd(activeCol) {
    const y = getWheelValue(ui.cols.year),
      m = getWheelValue(ui.cols.month),
      d = getWheelValue(ui.cols.day);
    if (CONFIG.autoDayAdjust && y && m && activeCol !== ui.cols.day) {
      const max = new Date(y, m, 0).getDate();
      if (max !== ui.cols.day.querySelectorAll("li").length) {
        renderWheel(ui.cols.day, 1, max, d > max ? max : d, "일");
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

  function confirmSelection() {
    const y = getWheelValue(ui.cols.year),
      m = getWheelValue(ui.cols.month),
      d = getWheelValue(ui.cols.day);
    if (!y || !m || !d) return;
    const dateObj = new Date(y, m - 1, d);
    const dateStr = `${y}년 ${String(m).padStart(2, "0")}월 ${String(d).padStart(2, "0")}일`;
    state.activeInput.value = `${dateStr} ${getDayName(dateObj)}`;
    closeSheet();
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

  function validateInput(input) {
    const d = parseDate(input.value);
    if (d) {
      const dateObj = new Date(d.y, d.m - 1, d.d);
      const str = `${d.y}년 ${String(d.m).padStart(2, "0")}월 ${String(d.d).padStart(2, "0")}일`;
      input.value = `${str} ${getDayName(dateObj)}`;
    }
  }

  setup();
}
