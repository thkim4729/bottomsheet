/**
 * [Library] Ultimate Date Picker (Standard A11y & Focus Trap)
 * - 톡백: 표준 리스트 탐색 방식 (순차적으로 옆으로 쓸어넘기며 선택)
 * - 포커스: 바텀시트 오픈 시 내부로 초점 고정 (Focus Trap)
 * - 범위: 현재 연도 기준 5년 전 ~ 현재 연도
 */
document.addEventListener("DOMContentLoaded", initDatePicker);

function initDatePicker() {
  // ============================================================
  // 1. [핵심 설정] CONFIG
  // ============================================================
  const currentYear = new Date().getFullYear();
  const CONFIG = {
    minYear: currentYear - 5, // 5년 전
    maxYear: currentYear, // 현재 연도
    manualInput: true,
    showDayOfWeek: true,
    autoDayAdjust: true,
    enterToSelect: true,

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
      yearAriaLabel: "연도 선택 리스트",
      monthAriaLabel: "월 선택 리스트",
      dayAriaLabel: "일 선택 리스트",
    },
  };

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

    // 표준 리스트박스 역할 부여 (순차 탐색용)
    [ui.cols.year, ui.cols.month, ui.cols.day].forEach((col, i) => {
      if (col) {
        col.setAttribute("role", "listbox");
        const labels = [
          CONFIG.locale.yearAriaLabel,
          CONFIG.locale.monthAriaLabel,
          CONFIG.locale.dayAriaLabel,
        ];
        col.setAttribute("aria-label", labels[i]);
      }
    });

    document.querySelector(".btn-close").addEventListener("click", closeSheet);
    ui.overlay.addEventListener("click", closeSheet);
    ui.btnDone.addEventListener("click", confirmSelection);
  }

  // ============================================================
  // 4. 바텀 시트 제어 (포커스 트랩 핵심)
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

    // 시트가 열리면 내부로 포커스 고정
    ui.sheet.setAttribute("tabindex", "-1");
    ui.sheet.addEventListener("keydown", trapFocus);

    setTimeout(() => {
      ui.sheet.focus(); // 시트 진입 시 첫 포커스
    }, 100);
  }

  function closeSheet() {
    ui.overlay.classList.remove("is-active");
    ui.sheet.classList.remove("is-active");
    ui.sheet.removeEventListener("keydown", trapFocus);

    if (state.lastFocusedElement) {
      const input = state.lastFocusedElement;
      // 키패드 방지 트릭
      const originalReadOnly = input.readOnly;
      input.readOnly = true;
      input.focus();
      setTimeout(() => {
        input.readOnly = originalReadOnly;
      }, 150);
      state.lastFocusedElement = null;
    }
  }

  /**
   * [trapFocus] 바텀시트 외부로 포커스 이탈 방지
   */
  function trapFocus(e) {
    if (e.key !== "Tab") return;
    const focusables = ui.sheet.querySelectorAll(
      'button, .wheel-col, [tabindex="0"]',
    );
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      // Tab
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  // ============================================================
  // 5. 휠 렌더링 (순차 탐색 지원)
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
      li.setAttribute("tabindex", "0"); // 스와이프 시 항목마다 초점 이동 가능

      // 초기 선택 상태 표시
      if (i === current) {
        li.classList.add("selected");
        li.setAttribute("aria-selected", "true");
        targetItem = li;
      }

      // 항목 클릭 또는 톡백 초점 이동 시 중앙 정렬
      const moveToCenter = () =>
        li.scrollIntoView({ block: "center", behavior: "smooth" });
      li.addEventListener("click", moveToCenter);
      li.addEventListener("focus", moveToCenter);

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

    // 초기 위치 잡기
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

        // 1. 선택 상태 업데이트
        if (dist < 20) {
          item.classList.add("selected");
          item.setAttribute("aria-selected", "true");
        } else {
          item.classList.remove("selected");
          item.setAttribute("aria-selected", "false");
        }

        // 2. [수정] 3D 효과 및 투명도 계산 범위 확장
        // 가시 거리(150 -> 250)를 넓혀서 미리 요소들이 보이게 합니다.
        if (dist <= 250) {
          const angle = Math.max(Math.min((center - itemCenter) / 5, 50), -50);
          // translateZ(0)을 추가하여 GPU 레이어를 유지합니다.
          item.style.transform = `rotateX(${-angle}deg) translateZ(0)`;

          // 최소 투명도를 0.1 정도로 유지하여 갑자기 나타나는 느낌을 없앱니다.
          const opacity = Math.max(1 - Math.pow(dist / 250, 2), 0.1);
          item.style.opacity = opacity;
          item.style.visibility = "visible";
        } else {
          // 아주 먼 요소만 숨김 처리
          item.style.opacity = "0";
          item.style.visibility = "hidden";
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
      const dayCol = ui.cols.day;
      if (max !== dayCol.querySelectorAll("li").length) {
        renderWheel(dayCol, 1, max, d > max ? max : d, "일");
      }
    }
  }

  // 유틸리티 함수 (getWheelValue, parseDate, confirmSelection 등)
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
    const dateStr = `${y}년 ${String(m).padStart(2, "0")}월 ${String(d).padStart(2, "0")}일`;
    const dayIdx = new Date(y, m - 1, d).getDay();
    state.activeInput.value = `${dateStr} ${CONFIG.locale.days[dayIdx]}`;
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
      const str = `${d.y}년 ${String(d.m).padStart(2, "0")}월 ${String(d.d).padStart(2, "0")}일`;
      input.value = `${str} ${CONFIG.locale.days[new Date(d.y, d.m - 1, d.d).getDay()]}`;
    }
  }

  setup();
}
