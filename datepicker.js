/**
 * [The Cleanest Version] Focus Fix & Sequential Navigation
 * - 불필요한 초점 노드 제거 (보이지 않는 무언가 해결)
 * - 바텀시트 내부 포커스 트랩 (이탈 방지)
 * - 5년 전 ~ 현재 연도 범위 설정
 * - 크롬 성능 최적화 (Fast Scroll 대응)
 */
document.addEventListener("DOMContentLoaded", initDatePicker);

function initDatePicker() {
  const currentYear = new Date().getFullYear();
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
      days: [
        "일요일",
        "월요일",
        "화요일",
        "수요일",
        "목요일",
        "금요일",
        "토요일",
      ],
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

    // [중요] 컨테이너에는 role만 부여하고 tabindex나 label은 제거하여
    // 톡백이 컨테이너 자체를 초점으로 잡는 현상을 방지합니다.
    [ui.cols.year, ui.cols.month, ui.cols.day].forEach((col) => {
      if (col) {
        col.setAttribute("role", "none");
        const ul = col.querySelector(".wheel-list");
        if (ul) {
          ul.setAttribute("role", "listbox");
          // ul에 label을 주면 톡백이 "리스트"라고 읽고 바로 첫 항목으로 넘어갑니다.
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

    // [Focus Trap] 바텀시트 외부 포커스 차단
    ui.sheet.setAttribute("tabindex", "-1");
    ui.sheet.addEventListener("keydown", trapFocus);

    setTimeout(() => {
      // 첫 번째 선택된 요소(selected)에 바로 초점을 줄 수도 있지만,
      // 시트 전체를 먼저 인식하도록 시트 자체에 포커스를 줍니다.
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
    // 시트 내부의 모든 포커스 가능한 요소 수집
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
  // 휠 렌더링 & 고속 스크롤 가시성 보정
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
      li.setAttribute("tabindex", "0"); // 톡백 순차 탐색용

      if (i === current) {
        li.classList.add("selected");
        li.setAttribute("aria-selected", "true");
        targetItem = li;
      }

      // 초점이 가거나 클릭하면 중앙으로 이동
      const centerMe = () =>
        li.scrollIntoView({ block: "center", behavior: "smooth" });
      li.addEventListener("click", centerMe);
      li.addEventListener("focus", centerMe);

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

        // [A11y] 상태 업데이트
        if (dist < 20) {
          item.classList.add("selected");
          item.setAttribute("aria-selected", "true");
        } else {
          item.classList.remove("selected");
          item.setAttribute("aria-selected", "false");
        }

        // [고속 스크롤 가시성 보정]
        // 계산 범위를 250px로 넓히고 최소 투명도를 0.1 주어 미리 렌더링되게 합니다.
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
