/**
 * [Main Logic] 데이트 피커 시스템 로직 정의
 * * DOM 요소 존재 여부를 체크하여 오류를 방지하는 방어적 코드가 적용되었습니다.
 */
function initializeDatePicker() {
  // ==========================================
  // 1. 시스템 전역 설정 (Centralized Config)
  // ==========================================
  const picker = {
    // [설정 1] 수치 상수
    config: {
      ITEM_HEIGHT: 40, // 아이템 높이 (CSS와 일치 필수)
      CONTAINER_HEIGHT: 220, // 컨테이너 높이 (CSS와 일치 필수)
      VISIBLE_RANGE: 150, // 렌더링 최적화 범위
    },

    // [설정 2] 클래스명 및 선택자 관리
    domConfig: {
      selector: {
        overlay: ".picker-overlay",
        sheet: ".bottom-sheet",
        btnDone: ".btn-done",
        btnClose: ".btn-close",

        // 휠 컬럼
        colYear: ".year-col",
        colMonth: ".month-col",
        colDay: ".day-col",

        // 입력 그룹
        wrapper: ".picker-wrapper",
        input: ".picker-input",
        iconBtn: ".picker-icon-btn",
        errorText: ".error-text",
        group: ".input-group",

        // 휠 내부
        list: ".wheel-list",
        item: ".wheel-item",
      },

      // 상태 클래스
      className: {
        active: "is-active",
        selected: "selected",
        error: "input-error",
        showError: "show",
        wheelItem: "wheel-item",
      },
    },

    // [상태]
    state: {
      activeInput: null,
      activeConfig: null,
    },

    // [UI 캐싱]
    ui: {
      overlay: null,
      sheet: null,
      btnDone: null,
      btnClose: null,
      cols: { year: null, month: null, day: null },
    },
  };

  const { selector, className } = picker.domConfig;

  // ==========================================
  // 2. 초기 UI 요소 캐싱 (안전 장치 포함)
  // ==========================================
  function cacheUI() {
    // 요소가 하나라도 없으면 null로 저장되며, 이후 로직에서 체크합니다.
    picker.ui.overlay = document.querySelector(selector.overlay);
    picker.ui.sheet = document.querySelector(selector.sheet);
    picker.ui.btnDone = document.querySelector(selector.btnDone);
    picker.ui.btnClose = document.querySelector(selector.btnClose);

    picker.ui.cols.year = document.querySelector(selector.colYear);
    picker.ui.cols.month = document.querySelector(selector.colMonth);
    picker.ui.cols.day = document.querySelector(selector.colDay);
  }
  cacheUI();

  // ==========================================
  // 3. 피커 연결 함수 (Safe Attachment)
  // ==========================================

  function attachPicker(targetSelector, options = {}) {
    // 1. 컨테이너 존재 여부 확인 (없으면 조용히 종료)
    const container = document.querySelector(targetSelector);
    if (!container) return;

    const currentYear = new Date().getFullYear();
    const settings = {
      minYear: currentYear - 50,
      maxYear: currentYear + 50,
      manualEdit: true,
      dateFormat: (y, m, d, w) =>
        `${y}년 ${String(m).padStart(2, "0")}월 ${String(d).padStart(2, "0")}일 ${w}`,
      ...options,
    };

    // 2. 내부 필수 요소 확인
    const wrapper = container.querySelector(selector.wrapper);
    const input = container.querySelector(selector.input);
    const iconBtn = container.querySelector(selector.iconBtn);

    // 필수 요소 중 하나라도 없으면 기능 부착 중단 (에러 방지)
    if (!wrapper || !input) {
      console.warn(
        `Picker setup failed: Missing elements in ${targetSelector}`,
      );
      return;
    }

    if (settings.manualEdit) {
      input.removeAttribute("readonly");
      input.addEventListener("blur", () => handleValidation(input, settings));
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") input.blur();
      });
      input.addEventListener("input", () => clearError(container));

      // 아이콘 버튼이 있을 때만 이벤트 연결
      if (iconBtn) {
        iconBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          openSheet(input, container, settings);
        });
      }
    } else {
      input.setAttribute("readonly", true);
      wrapper.addEventListener("click", () => {
        openSheet(input, container, settings);
      });
    }
  }

  // ==========================================
  // 4. 바텀 시트 제어 (Safe Open/Close)
  // ==========================================

  function openSheet(inputElement, containerElement, settings) {
    // 핵심 UI 요소(시트, 오버레이)가 없으면 실행 불가
    if (!picker.ui.sheet || !picker.ui.overlay) {
      console.error(
        "Picker UI elements (sheet or overlay) are missing in DOM.",
      );
      return;
    }

    picker.state.activeInput = inputElement;
    picker.state.activeConfig = settings;

    clearError(containerElement);

    const targetDate = parseDateString(inputElement.value) || {
      y: new Date().getFullYear(),
      m: new Date().getMonth() + 1,
      d: new Date().getDate(),
    };

    const years = Array.from(
      { length: settings.maxYear - settings.minYear + 1 },
      (_, i) => settings.minYear + i,
    );
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const days = Array.from({ length: 31 }, (_, i) => i + 1);

    // 컬럼 요소가 존재하는지 확인 후 렌더링
    if (picker.ui.cols.year)
      renderWheel(picker.ui.cols.year, years, "년", targetDate.y);
    if (picker.ui.cols.month)
      renderWheel(picker.ui.cols.month, months, "월", targetDate.m);
    if (picker.ui.cols.day)
      renderWheel(picker.ui.cols.day, days, "일", targetDate.d);

    picker.ui.overlay.classList.add(className.active);
    picker.ui.sheet.classList.add(className.active);
  }

  function closeSheet() {
    if (picker.ui.overlay) picker.ui.overlay.classList.remove(className.active);
    if (picker.ui.sheet) picker.ui.sheet.classList.remove(className.active);
  }

  function applySelection() {
    const { activeInput, activeConfig } = picker.state;
    if (!activeInput || !activeConfig) return;

    // 컬럼이 없을 경우를 대비해 안전하게 값 가져오기
    const y = picker.ui.cols.year
      ? getSelectedValue(picker.ui.cols.year)
      : null;
    const m = picker.ui.cols.month
      ? getSelectedValue(picker.ui.cols.month)
      : null;
    const d = picker.ui.cols.day ? getSelectedValue(picker.ui.cols.day) : null;

    if (y && m && d) {
      const dayOfWeek = getDayOfWeek(y, m, d);
      activeInput.value = activeConfig.dateFormat(y, m, d, dayOfWeek);

      const container = activeInput.closest(selector.group);
      if (container) clearError(container);
    }
    closeSheet();
  }

  // ==========================================
  // 5. 3D 휠 렌더링 (Core Logic)
  // ==========================================

  function renderWheel(colElement, dataArray, label, initialValue) {
    if (!colElement) return; // 요소 없으면 중단

    const ul = colElement.querySelector(selector.list);
    if (!ul) return; // 리스트 컨테이너 없으면 중단

    ul.innerHTML = "";

    const { ITEM_HEIGHT, CONTAINER_HEIGHT } = picker.config;
    const padding = (CONTAINER_HEIGHT - ITEM_HEIGHT) / 2;

    ul.style.paddingTop = `${padding}px`;
    ul.style.paddingBottom = `${padding}px`;

    let initialIndex = 0;
    const fragment = document.createDocumentFragment();

    dataArray.forEach((val, index) => {
      const li = document.createElement("li");
      li.className = className.wheelItem;
      li.textContent = `${val}${label}`;
      li.dataset.val = val;
      fragment.appendChild(li);

      if (val == initialValue) initialIndex = index;
    });
    ul.appendChild(fragment);

    const cachedItems = Array.from(ul.children);

    setTimeout(() => {
      if (colElement) {
        // 비동기 실행 시점에 요소가 사라졌을 수도 있으므로 체크
        colElement.scrollTop = initialIndex * ITEM_HEIGHT;
        requestAnimationFrame(() => update3D(colElement, cachedItems));
      }
    }, 0);

    colElement.onscroll = () => {
      requestAnimationFrame(() => update3D(colElement, cachedItems));
    };
  }

  function update3D(colElement, items) {
    if (!colElement) return; // 안전 장치

    const { ITEM_HEIGHT, VISIBLE_RANGE } = picker.config;
    const center = colElement.scrollTop + colElement.clientHeight / 2;

    items.forEach((item) => {
      if (!item) return; // 아이템이 null일 경우 건너뜀

      const itemCenter = item.offsetTop + ITEM_HEIGHT / 2;
      const dist = center - itemCenter;
      const absDist = Math.abs(dist);

      if (absDist > VISIBLE_RANGE) {
        if (item.style.transform) {
          item.style.transform = "";
          item.style.opacity = "0.3";
          item.classList.remove(className.selected);
        }
        return;
      }

      const angle = Math.max(Math.min(dist / 5, 60), -60);
      const opacity = Math.max(1 - Math.pow(absDist / 150, 2), 0.1);
      const offset = -Math.pow(absDist / 10, 1.5);

      item.style.setProperty("--angle", -angle);
      item.style.setProperty("--opacity", opacity);
      item.style.setProperty("--offset", offset);

      if (absDist < ITEM_HEIGHT / 2 + 1) {
        item.classList.add(className.selected);
      } else {
        item.classList.remove(className.selected);
      }
    });
  }

  // ==========================================
  // 6. 유틸리티 (Validation & Error)
  // ==========================================

  function handleValidation(input, settings) {
    if (!input) return;

    const val = input.value.trim();
    const container = input.closest(selector.group);

    if (!val) {
      if (container) clearError(container);
      return;
    }

    const dateObj = parseDateString(val);
    let isValid = false;

    if (dateObj) {
      if (isValidDate(dateObj.y, dateObj.m, dateObj.d)) {
        if (dateObj.y >= settings.minYear && dateObj.y <= settings.maxYear) {
          isValid = true;
        }
      }
    }

    if (container) {
      if (isValid) {
        const w = getDayOfWeek(dateObj.y, dateObj.m, dateObj.d);
        input.value = settings.dateFormat(dateObj.y, dateObj.m, dateObj.d, w);
        clearError(container);
      } else {
        showError(container);
      }
    }
  }

  function parseDateString(str) {
    if (!str) return null;
    const nums = str.replace(/[^0-9]/g, "");
    let y, m, d;

    if (nums.length === 8) {
      y = parseInt(nums.substring(0, 4));
      m = parseInt(nums.substring(4, 6));
      d = parseInt(nums.substring(6, 8));
    } else if (nums.length === 6) {
      y = 2000 + parseInt(nums.substring(0, 2));
      m = parseInt(nums.substring(2, 4));
      d = parseInt(nums.substring(4, 6));
    } else if (str.includes("-") || str.includes(".") || str.includes("/")) {
      const parts = str.split(/[-./]/);
      if (parts.length === 3) {
        y = parseInt(parts[0]);
        m = parseInt(parts[1]);
        d = parseInt(parts[2]);
        if (y < 100) y += 2000;
      }
    } else {
      return null;
    }
    return { y, m, d };
  }

  function isValidDate(y, m, d) {
    if (!y || !m || !d) return false;
    const date = new Date(y, m - 1, d);
    return (
      date.getFullYear() === y &&
      date.getMonth() + 1 === m &&
      date.getDate() === d
    );
  }

  function showError(container) {
    if (!container) return;
    const wrapper = container.querySelector(selector.wrapper);
    const errorText = container.querySelector(selector.errorText);
    if (wrapper) wrapper.classList.add(className.error);
    if (errorText) errorText.classList.add(className.showError);
  }

  function clearError(container) {
    if (!container) return;
    const wrapper = container.querySelector(selector.wrapper);
    const errorText = container.querySelector(selector.errorText);
    if (wrapper) wrapper.classList.remove(className.error);
    if (errorText) errorText.classList.remove(className.showError);
  }

  function getSelectedValue(colElement) {
    if (!colElement) return null;
    const selected = colElement.querySelector("." + className.selected);
    return selected ? parseInt(selected.dataset.val) : null;
  }

  function getDayOfWeek(y, m, d) {
    const week = ["일", "월", "화", "수", "목", "금", "토"];
    const date = new Date(y, m - 1, d);
    return week[date.getDay()] + "요일";
  }

  // ==========================================
  // 7. 실행부 (안전한 이벤트 연결)
  // ==========================================

  // 완료/닫기 버튼이 존재할 때만 이벤트 연결
  if (picker.ui.btnDone) {
    picker.ui.btnDone.addEventListener("click", () => applySelection());
  }

  const closeAction = () => closeSheet();

  if (picker.ui.btnClose) {
    picker.ui.btnClose.addEventListener("click", closeAction);
  }

  if (picker.ui.overlay) {
    picker.ui.overlay.addEventListener("click", closeAction);
  }

  // [초기화 실행]
  // 요소가 없어도 attachPicker 내부에서 체크하므로 안전합니다.

  attachPicker("#picker-start-date", {
    manualEdit: true,
  });

  attachPicker("#picker-birth-date", {
    manualEdit: true,
    minYear: 1900,
    maxYear: new Date().getFullYear(),
  });
}

// 문서 로드 완료 시 초기화 함수 실행
document.addEventListener("DOMContentLoaded", () => {
  initializeDatePicker();
});
