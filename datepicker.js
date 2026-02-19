/**
 * [Library] Ultimate Date Picker (Capsule & Service Oriented)
 * 모든 기능은 'initDatePicker' 내부에 보호되어 있으며,
 * 데이터 통신 로직은 'ApiService' 객체로 별도 캡슐화되었습니다.
 */
document.addEventListener("DOMContentLoaded", initDatePicker);

function initDatePicker() {
  // ============================================================
  // 1. [핵심 설정] CONFIG - 컨트롤 타워
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

    /**
     * [useMockData] 백엔드 통신 모드 설정
     * - true: 실제 서버에 요청하지 않고, 코드 내부에 정의된 가짜 데이터를 사용합니다. (프론트 단독 테스트용)
     * - false: 실제 API 주소로 fetch 요청을 보냅니다. (백엔드 연결 시 사용)
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
  // 2. [API 서비스 레이어] 백엔드 통신 캡슐화
  // 데이터 요청과 관련된 모든 로직을 이 객체 안에 모았습니다.
  // ============================================================
  const ApiService = {
    // 중복 요청을 방지하기 위해 데이터를 메모리에 임시 저장합니다.
    cache: {},

    /**
     * [fetchHolidays] 특정 연도의 공휴일 데이터를 가져오는 핵심 함수
     * @param {number} year - 요청할 연도
     * @returns {Promise<string[]>} 공휴일 배열 (MM-DD 형식)
     */
    async fetchHolidays(year) {
      // 1. 이미 불러온 적이 있다면 캐시된 데이터를 즉시 반환 (성능 최적화)
      if (this.cache[year]) return this.cache[year];

      // 2. [모드 전환] 가짜 데이터 사용 시
      if (CONFIG.useMockData) {
        await new Promise((r) => setTimeout(r, 200)); // 실제 통신처럼 약간의 지연시간 생성
        const mockHolidays = [
          "01-01",
          "03-01",
          "05-05",
          "06-06",
          "08-15",
          "10-03",
          "10-09",
          "12-25",
        ];
        this.cache[year] = mockHolidays;
        return mockHolidays;
      }

      // 3. [모드 전환] 실제 백엔드 연동 시
      else {
        try {
          // 실제 API 주소를 여기에 입력하세요. (예: /api/holidays?year=2026)
          const response = await fetch(`/api/holidays?year=${year}`);
          if (!response.ok) throw new Error("네트워크 응답이 좋지 않습니다.");

          const data = await response.json();
          this.cache[year] = data; // 결과 저장
          return data;
        } catch (error) {
          console.error("공휴일 데이터를 가져오는데 실패했습니다:", error);
          return []; // 실패 시 빈 배열 반환하여 시스템 중단 방지
        }
      }
    },
  };

  // ============================================================
  // 3. [시스템 상태 및 UI 참조]
  // ============================================================
  const state = {
    activeInput: null,
    scrollTimer: null,
    lastFocusedElement: null,
  };

  const ui = {
    sheet: null,
    overlay: null,
    btnDone: null,
    cols: { year: null, month: null, day: null },
  };

  // [초기화 셋업]
  function setup() {
    cacheUI();
    document.querySelectorAll(".date_picker").forEach((container) => {
      container.querySelectorAll(".picker-wrapper").forEach((wrapper) => {
        const input = wrapper.querySelector(".picker-input");
        const iconBtn = wrapper.querySelector(".picker-icon-btn");
        if (!input) return;

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

    const btnClose = document.querySelector(".btn-close");
    if (btnClose) btnClose.addEventListener("click", closeSheet);
    if (ui.overlay) ui.overlay.addEventListener("click", closeSheet);
    if (ui.btnDone) ui.btnDone.addEventListener("click", confirmSelection);
  }

  // 포커스 트랩 (A11y)
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

    // [ApiService 호출] 시트 열기 전 데이터 미리 확보
    if (CONFIG.blockHolidays) {
      await ApiService.fetchHolidays(d.y);
    }

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
    if (CONFIG.showDayOfWeek) {
      const dayIdx = new Date(y, m - 1, d).getDay();
      str += ` ${CONFIG.locale.days[dayIdx]}`;
    }
    return str;
  }

  function isDateBlocked(y, m, d) {
    if (!y || !m || !d) return false;
    const date = new Date(y, m - 1, d);
    if (CONFIG.blockWeekends && (date.getDay() === 0 || date.getDay() === 6))
      return true;

    // ApiService의 캐시를 확인합니다.
    if (CONFIG.blockHolidays) {
      const list = ApiService.cache[y];
      if (
        list &&
        list.includes(
          `${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
        )
      )
        return true;
    }
    return false;
  }

  // [휠 렌더링 - innerHTML 사용 금지]
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
      li.addEventListener("click", () =>
        li.scrollIntoView({ block: "center", behavior: "smooth" }),
      );
      fragment.appendChild(li);
      if (i === current) targetItem = li;
    }
    ul.appendChild(fragment);

    if (!col.onscroll) {
      col.onscroll = () => {
        update3D(col);
        clearTimeout(state.scrollTimer);
        state.scrollTimer = setTimeout(onScrollEnd, 150);
      };
    }

    if (!col.dataset.hasKeyboard) {
      col.addEventListener("keydown", (e) => handleWheelKeyboard(e, col));
      col.dataset.hasKeyboard = "true";
    }

    if (targetItem) {
      setTimeout(() => {
        targetItem.scrollIntoView({ block: "center" });
        update3D(col);
      }, 0);
    }
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
      if (dist <= 150) {
        const angle = Math.max(Math.min((center - itemCenter) / 5, 50), -50);
        item.style.transform = `rotateX(${-angle}deg)`;
        item.style.opacity = Math.max(1 - Math.pow(dist / 150, 2), 0.3);
      }
    });
  }

  async function onScrollEnd() {
    const y = getWheelValue(ui.cols.year),
      m = getWheelValue(ui.cols.month),
      d = getWheelValue(ui.cols.day);

    // [ApiService 활용] 연도 이동 시 새로운 데이터 확보
    if (CONFIG.blockHolidays && y) {
      await ApiService.fetchHolidays(y);
    }

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
      // 수동 입력 시에도 API 데이터를 먼저 확보한 뒤 체크합니다.
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
