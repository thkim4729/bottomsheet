/**
 * [Library] Ultimate Date Picker (A11y & Performance Optimized)
 * 모든 기능은 'initDatePicker' 내부에 캡슐화되어 외부 스크립트와 충돌하지 않습니다.
 */
document.addEventListener("DOMContentLoaded", initDatePicker);

function initDatePicker() {
  // ============================================================
  // 1. [핵심 설정] CONFIG - 기능을 켜고 끄는 컨트롤 타워
  // ============================================================
  const CONFIG = {
    minYear: new Date().getFullYear() - 50, // 최소 연도
    maxYear: new Date().getFullYear() + 50, // 최대 연도

    /**
     * [manualInput] 직접 타이핑 편집 허용 여부
     * - true: 사용자가 인풋창을 클릭해 날짜를 직접 수정할 수 있습니다.
     * - false: 인풋이 readonly가 되어 오직 바텀시트로만 선택 가능합니다.
     */
    manualInput: true,

    /**
     * [showDayOfWeek] 요일 출력 여부
     * - true: "2026년 02월 19일 목요일" 형식으로 출력됩니다.
     * - false: 요일 없이 날짜까지만 출력됩니다.
     */
    showDayOfWeek: true,

    /**
     * [blockWeekends] 주말 선택 차단 여부
     * - true: 토/일요일 선택 시 에러 메시지를 띄우고 입력을 막습니다.
     */
    blockWeekends: false,

    /**
     * [blockHolidays] 공휴일 선택 차단 여부
     * - true: ApiService에서 가져온 빨간날 선택 시 에러가 발생합니다.
     */
    blockHolidays: false,

    /**
     * [autoDayAdjust] 월별 일수 자동 최적화
     * - true: 2월(28일)이나 4월(30일) 선택 시 '일' 휠의 개수를 자동으로 맞춥니다.
     */
    autoDayAdjust: true,

    /**
     * [enterToSelect] 엔터 키 완료 기능
     * - true: 휠에 포커스가 있을 때 Enter를 누르면 '완료' 처리가 됩니다.
     */
    enterToSelect: true,

    /**
     * [useMockData] 데이터 통신 모드
     * - true: 서버 없이 코드 내 가짜 데이터를 사용합니다. (테스트용)
     * - false: 실제 API 주소로 요청을 보냅니다.
     */
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
      yearAriaLabel: "연도를 선택해주세요",
      monthAriaLabel: "월을 선택해주세요",
      dayAriaLabel: "일을 선택해주세요",
    },
  };

  // ============================================================
  // 2. [API 서비스 레이어] 데이터 통신 캡슐화
  // ============================================================
  const ApiService = {
    cache: {}, // 연도별 데이터 중복 요청 방지용 저장소

    /**
     * 특정 연도의 공휴일 데이터를 가져오는 비동기 함수
     */
    async fetchHolidays(year) {
      if (this.cache[year]) return this.cache[year];

      if (CONFIG.useMockData) {
        await new Promise((r) => setTimeout(r, 200)); // 통신 지연 흉내
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
      } else {
        try {
          const response = await fetch(`/api/holidays?year=${year}`);
          const data = await response.json();
          this.cache[year] = data;
          return data;
        } catch (e) {
          console.error("공휴일 로드 실패", e);
          return [];
        }
      }
    },
  };

  // ============================================================
  // 3. [시스템 상태 및 UI 참조]
  // ============================================================
  const state = {
    activeInput: null, // 현재 선택 중인 input
    scrollTimer: null, // 스크롤 멈춤 감지 타이머
    lastFocusedElement: null, // 시트 닫힌 후 돌아갈 위치
    isTicking: false, // rAF 중복 실행 방지 플래그 (성능 최적화)
  };

  const ui = {
    sheet: null,
    overlay: null,
    btnDone: null,
    cols: { year: null, month: null, day: null },
  };

  /**
   * [setup] 초기화: 페이지 내 모든 .date_picker를 찾아 기능을 연결합니다.
   */
  function setup() {
    cacheUI();
    document.querySelectorAll(".date_picker").forEach((container) => {
      container.querySelectorAll(".picker-wrapper").forEach((wrapper) => {
        const input = wrapper.querySelector(".picker-input");
        const iconBtn = wrapper.querySelector(".picker-icon-btn");
        if (!input) return;

        // 직접 입력 가능 여부 제어
        if (CONFIG.manualInput) input.removeAttribute("readonly");
        else input.setAttribute("readonly", "true");

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

  /**
   * [cacheUI] UI 요소를 변수에 담고 접근성 기초 설정을 합니다.
   */
  function cacheUI() {
    if (ui.sheet) return;
    ui.overlay = document.querySelector(".picker-overlay");
    ui.sheet = document.querySelector(".bottom-sheet");
    ui.btnDone = document.querySelector(".btn-done");
    ui.cols.year = document.querySelector(".year-col");
    ui.cols.month = document.querySelector(".month-col");
    ui.cols.day = document.querySelector(".day-col");

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

    document.querySelector(".btn-close").addEventListener("click", closeSheet);
    ui.overlay.addEventListener("click", closeSheet);
    ui.btnDone.addEventListener("click", confirmSelection);
  }

  // [trapFocus] 탭 키 이동을 바텀시트 내부로 제한 (접근성)
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
  // 4. 비동기 시트 제어
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

    // 공휴일 데이터 비동기 확보 (await)
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

  function closeSheet() {
    ui.overlay.classList.remove("is-active");
    ui.sheet.classList.remove("is-active");
    ui.sheet.removeAttribute("tabindex");
    ui.sheet.removeEventListener("keydown", trapFocus);
    if (state.lastFocusedElement) state.lastFocusedElement.focus();
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
  // 5. 비즈니스 로직 및 유틸리티
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
  // 6. 휠 렌더링 및 성능/접근성 최적화
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
      li.setAttribute("tabindex", "-1"); // [A11y] 톡백 스와이프 탐색용

      // [A11y] 톡백 초점 이동 시 자동 스크롤
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

    /**
     * [성능 최적화] Passive 스크롤 리스너
     * 브라우저가 스크롤 애니메이션을 멈추지 않고 부드럽게 처리하도록 합니다.
     */
    if (!col.dataset.hasScroll) {
      col.addEventListener(
        "scroll",
        () => {
          update3D(col);
          clearTimeout(state.scrollTimer);
          state.scrollTimer = setTimeout(onScrollEnd, 150);
        },
        { passive: true },
      );
      col.dataset.hasScroll = "true";
    }

    if (!col.dataset.hasKeyboard) {
      col.addEventListener("keydown", (e) => handleWheelKeyboard(e, col));
      col.dataset.hasKeyboard = "true";
    }

    // 초기 위치 보정
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

  /**
   * [성능 최적화] requestAnimationFrame (rAF) 적용
   * 화면 갱신 주기에 맞춰 3D 계산을 수행하여 크롬 110 등에서의 버벅임을 해결합니다.
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
          col.setAttribute("aria-activedescendant", item.id);
        } else {
          item.classList.remove("selected");
          item.setAttribute("aria-selected", "false");
        }

        if (dist <= 150) {
          const angle = Math.max(Math.min((center - itemCenter) / 5, 50), -50);
          // translateZ(0)로 GPU 하드웨어 가속 강제
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

  async function onScrollEnd() {
    const y = getWheelValue(ui.cols.year),
      m = getWheelValue(ui.cols.month),
      d = getWheelValue(ui.cols.day);
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

  // 기타 유틸리티 함수들
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
