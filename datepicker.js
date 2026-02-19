/**
 * [Final Master] Ultimate Date Picker (A11y, Performance & UX)
 * 1. 성능: rAF와 Passive 리스너로 크롬 저버전 애니메이션 버벅임 해결
 * 2. 접근성: role="spinbutton" 적용으로 톡백 위아래 쓸기(값 조절) 지원
 * 3. 탐색: 좌우 쓸기로 연/월/일 박스 간 즉시 점프 지원
 * 4. UX: 인풋 복귀 시 모바일 키패드 팝업 원천 차단
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
    autoDayAdjust: true, // 월별 일수 자동 조정 (2월 28일 등)
    enterToSelect: true, // 휠에서 Enter 키 입력 시 완료
    useMockData: true, // 백엔드 미연결 시 가짜 데이터 사용

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

  // ============================================================
  // 2. [API 서비스 레이어] 백엔드 통신 캡슐화
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
    liveRegion: null,
    announcementTimer: null,
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

    // [A11y 핵심] 컬럼을 '조절 가능한 버튼(spinbutton)'으로 설정
    [ui.cols.year, ui.cols.month, ui.cols.day].forEach((col, i) => {
      if (col) {
        col.setAttribute("tabindex", "0");
        col.setAttribute("role", "spinbutton");
        const labels = [
          CONFIG.locale.yearAriaLabel,
          CONFIG.locale.monthAriaLabel,
          CONFIG.locale.dayAriaLabel,
        ];
        col.setAttribute("aria-label", labels[i]);
      }
    });

    // 스크린리더 안내용 liveRegion (sr-only 클래스 필요)
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
  // 4. 바텀 시트 제어 (Focus & Keypad Optimized)
  // ============================================================
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

    ui.sheet.setAttribute("tabindex", "-1");
    ui.sheet.classList.add("is-active");
    ui.overlay.classList.add("is-active");
    ui.sheet.addEventListener("keydown", trapFocus);

    // 시트 진입 시 포커싱
    setTimeout(() => {
      ui.sheet.focus();
    }, 100);
  }

  function closeSheet() {
    ui.overlay.classList.remove("is-active");
    ui.sheet.classList.remove("is-active");
    ui.sheet.removeAttribute("tabindex");

    if (state.lastFocusedElement) {
      const input = state.lastFocusedElement;
      // [키패드 방지] Readonly 트릭 적용
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
  // 5. 휠 렌더링 및 음성 독립 가이드
  // ============================================================
  function renderWheel(col, min, max, current, label) {
    const ul = col.querySelector(".wheel-list");
    while (ul.firstChild) ul.removeChild(ul.firstChild);

    const fragment = document.createDocumentFragment();
    const colId = col.className.split(" ")[1];

    for (let i = min; i <= max; i++) {
      const li = document.createElement("li");
      li.id = `picker-${colId}-${i}`;
      li.className = "wheel-item";
      li.textContent = i + label;
      li.setAttribute("data-val", i);
      li.setAttribute("role", "option");
      li.setAttribute("tabindex", "-1"); // 개별 탐색 지원

      li.addEventListener("focus", () =>
        li.scrollIntoView({ block: "center", behavior: "smooth" }),
      );
      li.addEventListener("click", () =>
        li.scrollIntoView({ block: "center", behavior: "smooth" }),
      );

      if (i === current) {
        li.classList.add("selected");
        li.setAttribute("aria-selected", "true");
        col.setAttribute("aria-activedescendant", li.id);
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

    // 초기 정착
    setTimeout(() => {
      const target = [...ul.children].find(
        (li) => parseInt(li.dataset.val) === current,
      );
      if (target) {
        target.scrollIntoView({ block: "center", behavior: "auto" });
        update3D(col);
      }
    }, 50);
  }

  /**
   * [onScrollEnd] 독립적 공지 보장
   */
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
      // [A11y] 사용자가 직접 조작한 박스 정보만 안내
      speak(`${currentValue}${suffix}이 선택되었습니다.`);
    }

    // 일수 자동 조정 (조용히 처리)
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

  /**
   * [update3D & A11y Visibility]
   * 화면 내 5개 요소만 톡백 인식하게 하여 스와이프 피로도 감소
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

        // 톡백 가시성 제한 (중앙 근처 5개만 노출)
        if (dist <= 100) {
          item.removeAttribute("aria-hidden");
          if (dist < 20) {
            item.classList.add("selected");
            item.setAttribute("aria-selected", "true");
            col.setAttribute("aria-activedescendant", item.id);
            col.setAttribute("aria-valuetext", item.textContent); // 스핀버튼 현재 값 업데이트
          } else {
            item.classList.remove("selected");
          }
        } else {
          item.setAttribute("aria-hidden", "true");
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

  // [톡백 제스처 연결] 위아래 쓸기(값 증감), 좌우 쓸기(박스 이동)
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
    } else if (e.key === "Enter" && CONFIG.enterToSelect) {
      e.preventDefault();
      confirmSelection();
    }
  }

  // ============================================================
  // 6. 유틸리티
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
    const { activeInput } = state;
    const y = getWheelValue(ui.cols.year),
      m = getWheelValue(ui.cols.month),
      d = getWheelValue(ui.cols.day);
    activeInput.value = formatDateString(y, m, d);
    closeSheet();
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

  function validateInput(input) {
    const d = parseDate(input.value);
    if (d) input.value = formatDateString(d.y, d.m, d.d);
  }

  function clearError(c) {
    c?.querySelector(".error-text")?.classList.remove("show");
    c?.querySelectorAll(".picker-wrapper").forEach((w) =>
      w.classList.remove("input-error"),
    );
  }

  setup();
}
