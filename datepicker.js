/**
 * [Final Integrated Master] Ultimate Date Picker
 * - 요일 관리: 배열 대신 개별 변수(sun, mon...)로 관리
 * - 톡백 조작: 더블 탭(클릭) 시에만 선택 및 중앙 이동
 * - 포커스 제어: 바텀시트 내부 포커스 트랩 작동
 * - 성능 최적화: rAF + GPU 가속으로 고속 스크롤 대응
 */
document.addEventListener("DOMContentLoaded", initDatePicker);

function initDatePicker() {
  const currentYear = new Date().getFullYear();

  // ============================================================
  // 1. [핵심 설정] CONFIG - 요일 변수화 적용
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
      // 요일을 개별 변수로 저장
      sun: "일요일",
      mon: "월요일",
      tue: "화요일",
      wed: "수요일",
      thu: "목요일",
      fri: "금요일",
      sat: "토요일",

      yearAriaLabel: "연도 선택 리스트",
      monthAriaLabel: "월 선택 리스트",
      dayAriaLabel: "일 선택 리스트",
    },
  };

  /**
   * getDay()의 인덱스(0~6)를 CONFIG의 개별 요일 변수와 매핑합니다.
   */
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

    [ui.cols.year, ui.cols.month, ui.cols.day].forEach((col) => {
      if (col) {
        col.setAttribute("role", "none");
        const ul = col.querySelector(".wheel-list");
        if (ul) ul.setAttribute("role", "listbox");
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
      const originalReadOnly = input.readOnly;
      input.readOnly = true;
      input.focus();
      setTimeout(() => {
        input.readOnly = originalReadOnly;
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
  // 휠 렌더링 & 고속 스크롤 대응
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

      // 톡백 탐색 시 초점만 가고, 더블 탭(클릭) 시에만 중앙 이동
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

        // 고속 스크롤 시 '팝업' 방지를 위해 가시 범위(250px) 확장 및 최소 투명도 보정
        if (dist <= 250) {
          const angle = Math.max(Math.min((center - itemCenter) / 5, 50), -50);
          item.style.transform = `rotateX(${-angle}deg) translateZ(0)`;
          item.style.opacity = Math.max(1 - Math.pow(dist / 250, 2), 0.1);
          item.style.pointerEvents = "auto";
        } else {
          item.style.opacity = "0";
          item.style.pointerEvents = "none";
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

  // ============================================================
  // 6. 유틸리티 (요일 변수 매핑 적용)
  // ============================================================
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

    // 개별 변수 매핑 함수 사용
    const dayName = getDayName(dateObj);

    state.activeInput.value = `${dateStr} ${dayName}`;
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
      const dayName = getDayName(dateObj);
      input.value = `${str} ${dayName}`;
    }
  }

  setup();
}
