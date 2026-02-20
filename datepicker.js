/**
 * [Final Master - TalkBack Item Focus Version]
 * 1. 톡백 탐색: 모든 wheel-item을 개별적으로 탐색하고 선택 가능 (role="option")
 * 2. 연도 범위: 현재 연도 기준 5년 전 ~ 현재 연도까지
 * 3. 톡백 공지: 휠 정착 시 "N월이 선택되었습니다" 강제 공지
 * 4. 초기 상태: 시트 오픈 시 즉시 .selected 적용 및 위치 보정
 * 5. UX 최적화: 클릭 이동 및 인풋 복귀 시 모바일 키패드 팝업 차단
 */
document.addEventListener("DOMContentLoaded", initDatePicker);

function initDatePicker() {
  // ============================================================
  // 1. [핵심 설정] CONFIG
  // ============================================================
  const currentYear = new Date().getFullYear();
  const CONFIG = {
    minYear: currentYear - 5, // 5년 전부터
    maxYear: currentYear, // 현재까지
    manualInput: true,
    showDayOfWeek: true,
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

    // [A11y] 개별 항목 탐색을 위해 컬럼을 listbox로 설정
    [ui.cols.year, ui.cols.month, ui.cols.day].forEach((col, i) => {
      if (col) {
        col.setAttribute("tabindex", "0");
        col.setAttribute("role", "listbox");
        const labels = [
          CONFIG.locale.yearAriaLabel,
          CONFIG.locale.monthAriaLabel,
          CONFIG.locale.dayAriaLabel,
        ];
        col.setAttribute("aria-label", labels[i]);
      }
    });

    // [A11y] 스크린리더 공지 영역
    state.liveRegion = document.createElement("div");
    state.liveRegion.className = "sr-only";
    state.liveRegion.setAttribute("aria-live", "assertive");
    state.liveRegion.setAttribute("aria-atomic", "true");
    document.body.appendChild(state.liveRegion);

    document.querySelector(".btn-close").addEventListener("click", closeSheet);
    ui.overlay.addEventListener("click", closeSheet);
    ui.btnDone.addEventListener("click", confirmSelection);
  }

  function speak(msg) {
    if (state.announcementTimer) clearTimeout(state.announcementTimer);
    if (state.liveRegion) {
      state.liveRegion.textContent = "";
      state.announcementTimer = setTimeout(() => {
        state.liveRegion.textContent = msg;
      }, 50);
    }
  }

  // ============================================================
  // 4. 시트 제어 (포커스 트랩 & 키패드 방지)
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

    ui.sheet.setAttribute("tabindex", "-1");
    ui.sheet.classList.add("is-active");
    ui.overlay.classList.add("is-active");
    ui.sheet.addEventListener("keydown", trapFocus);

    setTimeout(() => {
      ui.sheet.focus();
    }, 100);
  }

  function closeSheet() {
    ui.overlay.classList.remove("is-active");
    ui.sheet.classList.remove("is-active");
    ui.sheet.removeAttribute("tabindex");
    ui.sheet.removeEventListener("keydown", trapFocus);

    if (state.lastFocusedElement) {
      const input = state.lastFocusedElement;
      const originalReadOnly = input.readOnly;
      input.readOnly = true;
      input.focus();
      setTimeout(() => {
        input.readOnly = originalReadOnly;
      }, 150);
      state.lastFocusedElement = null;
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
  // 5. 휠 렌더링 (개별 항목 탐색 최적화)
  // ============================================================
  function renderWheel(col, min, max, current, label) {
    const ul = col.querySelector(".wheel-list");
    while (ul.firstChild) ul.removeChild(ul.firstChild);

    // 톡백 탐색을 위해 aria-hidden 해제
    ul.removeAttribute("aria-hidden");

    const fragment = document.createDocumentFragment();
    let targetItem = null;

    for (let i = min; i <= max; i++) {
      const li = document.createElement("li");
      li.className = "wheel-item";
      li.textContent = i + label;
      li.setAttribute("data-val", i);
      li.setAttribute("role", "option");

      /**
       * [톡백 최적화]
       * 모든 항목에 tabindex="-1"을 주어 개별 탐색이 가능하게 합니다.
       * 톡백 초점이 오면 해당 항목을 중앙으로 스크롤합니다.
       */
      li.setAttribute("tabindex", "-1");
      li.addEventListener("focus", () => {
        li.scrollIntoView({ block: "center", behavior: "smooth" });
      });

      if (i === current) {
        li.classList.add("selected");
        li.setAttribute("aria-selected", "true");
        targetItem = li;
      }

      // 클릭 시 해당 위치로 이동
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

    if (!col.dataset.hasKeyboard) {
      col.addEventListener("keydown", (e) => handleWheelKeyboard(e, col));
      col.dataset.hasKeyboard = "true";
    }

    if (targetItem) {
      setTimeout(() => {
        col.scrollTop =
          targetItem.offsetTop -
          col.offsetHeight / 2 +
          targetItem.offsetHeight / 2;
        update3D(col);
      }, 0);
    }
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
      const dayCol = ui.cols.day;
      if (max !== dayCol.querySelectorAll("li").length) {
        dayCol.dataset.preventAnnouncement = "true";
        renderWheel(dayCol, 1, max, d > max ? max : d, "일");
        setTimeout(() => {
          dayCol.dataset.preventAnnouncement = "false";
        }, 300);
      }
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
          item.style.opacity = "0";
          item.style.transform = "";
        }
      });
      state.isTicking = false;
    });
  }

  function handleWheelKeyboard(e, col) {
    const h = 40;
    if (e.key === "ArrowUp") {
      e.preventDefault();
      col.scrollBy({ top: -h, behavior: "smooth" });
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      col.scrollBy({ top: h, behavior: "smooth" });
    } else if (e.key === "ArrowRight") {
      if (col === ui.cols.year) ui.cols.month.focus();
      else if (col === ui.cols.month) ui.cols.day.focus();
    } else if (e.key === "ArrowLeft") {
      if (col === ui.cols.day) ui.cols.month.focus();
      else if (col === ui.cols.month) ui.cols.year.focus();
    } else if (e.key === "Enter") {
      confirmSelection();
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
    const dateStr = `${y}년 ${String(m).padStart(2, "0")}월 ${String(d).padStart(2, "0")}일`;
    const dayOfWeek = CONFIG.locale.days[new Date(y, m - 1, d).getDay()];
    state.activeInput.value = `${dateStr} ${dayOfWeek}`;
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
      const dayOfWeek =
        CONFIG.locale.days[new Date(d.y, d.m - 1, d.d).getDay()];
      input.value = `${str} ${dayOfWeek}`;
    }
  }

  setup();
}
