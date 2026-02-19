/**
 * [Final Master] Ultimate Date Picker (No Omissions)
 * - 초기 selected 클래스 강제 적용 및 위치 보정
 * - 톡백: 좌우(박스 이동), 위아래(값 조절 - spinbutton)
 * - 성능: rAF 최적화 (크롬 버벅임 해결)
 * - UX: 키패드 방지 및 시트 진입 포커스
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
    autoDayAdjust: true, // 월별 일수 자동 조정
    enterToSelect: true, // 휠에서 Enter 완료 여부
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
      yearAriaLabel: "연도 선택",
      monthAriaLabel: "월 선택",
      dayAriaLabel: "일 선택",
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

    // [A11y] 박스(컬럼) 단위 탐색 및 위아래 값 조절 설정
    [ui.cols.year, ui.cols.month, ui.cols.day].forEach((col, i) => {
      if (col) {
        col.setAttribute("tabindex", "0");
        col.setAttribute("role", "spinbutton"); // 톡백 위아래 쓸기 활성화
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
  // 4. 시트 제어 (포커스 & 키패드 방지 & 선택 상태 초기화)
  // ============================================================
  async function openSheet(input, container) {
    state.lastFocusedElement = input;
    state.activeInput = input;

    const d = parseDate(input.value) || {
      y: new Date().getFullYear(),
      m: new Date().getMonth() + 1,
      d: new Date().getDate(),
    };

    // 휠 렌더링 (selected 클래스 및 위치 보정 포함)
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

    // [중요] 시트 진입 즉시 포커스
    setTimeout(() => {
      ui.sheet.focus();
    }, 100);
  }

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
      }, 150);
      state.lastFocusedElement = null;
    }
  }

  // ============================================================
  // 5. 휠 렌더링 (Selected 클래스 즉시 반영 로직)
  // ============================================================
  function renderWheel(col, min, max, current, label) {
    const ul = col.querySelector(".wheel-list");
    while (ul.firstChild) ul.removeChild(ul.firstChild);

    // 톡백 탐색 시 개별 li가 아닌 박스 단위로 넘어가도록 처리
    ul.setAttribute("aria-hidden", "true");

    const fragment = document.createDocumentFragment();
    let targetItem = null;

    for (let i = min; i <= max; i++) {
      const li = document.createElement("li");
      li.className = "wheel-item";
      li.textContent = i + label;
      li.setAttribute("data-val", i);

      // [보정] 렌더링 시점에 즉시 selected 클래스 부여
      if (i === current) {
        li.classList.add("selected");
        li.setAttribute("aria-selected", "true");
        targetItem = li;
      }

      li.addEventListener("click", () =>
        li.scrollIntoView({ block: "center", behavior: "smooth" }),
      );
      fragment.appendChild(li);
    }
    ul.appendChild(fragment);

    // 스크롤 이벤트 등록 (Passive 최적화)
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

    // [보정] 초기 위치를 즉시 잡고 3D 효과 강제 업데이트
    if (targetItem) {
      // 0ms 지연으로 렌더링 직후 위치 고정
      setTimeout(() => {
        col.scrollTop =
          targetItem.offsetTop -
          col.offsetHeight / 2 +
          targetItem.offsetHeight / 2;
        update3D(col); // 여기서 aria-valuetext와 selected 상태가 최종 확정됨
      }, 0);
    }
  }

  /**
   * [handleWheelKeyboard] 톡백 위아래 쓸기(값 증감) 및 좌우 쓸기(박스 이동)
   */
  function handleWheelKeyboard(e, col) {
    const h = 40;
    if (e.key === "ArrowUp") {
      e.preventDefault();
      col.scrollBy({ top: -h, behavior: "smooth" });
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      col.scrollBy({ top: h, behavior: "smooth" });
    } else if (e.key === "ArrowRight") {
      // 좌우 쓸기 제스처 대응
      if (col === ui.cols.year) ui.cols.month.focus();
      else if (col === ui.cols.month) ui.cols.day.focus();
    } else if (e.key === "ArrowLeft") {
      if (col === ui.cols.day) ui.cols.month.focus();
      else if (col === ui.cols.month) ui.cols.year.focus();
    } else if (e.key === "Enter") {
      confirmSelection();
    }
  }

  /**
   * [update3D] rAF 성능 최적화 및 spinbutton 상태 업데이트
   */
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
          // [톡백] 현재 박스의 값을 공지하기 위해valuetext 업데이트
          col.setAttribute("aria-valuetext", item.textContent);
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
      // [요청] "N월이 선택되었습니다" 형식의 독립 공지
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

  // ============================================================
  // 6. 유틸리티 (Parsing & Formatting)
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
    const str = `${y}년 ${String(m).padStart(2, "0")}월 ${String(d).padStart(2, "0")}일`;
    const dayOfWeek = CONFIG.locale.days[new Date(y, m - 1, d).getDay()];
    state.activeInput.value = `${str} ${dayOfWeek}`;
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
