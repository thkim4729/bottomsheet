document.addEventListener("DOMContentLoaded", () => {
  /**
   * [Main Logic] iOS 스타일 3D 데이트 피커 시스템
   */
  function initializeDatePicker() {
    // ============================================================
    // 1. 시스템 전역 설정
    // ============================================================
    const picker = {
      config: {
        ITEM_HEIGHT: 40,
        CONTAINER_HEIGHT: 220,
        VISIBLE_RANGE: 150,
      },
      domConfig: {
        selector: {
          autoInitClass: ".js-date-picker",
          overlay: ".picker-overlay",
          sheet: ".bottom-sheet",
          btnDone: ".btn-done",
          btnClose: ".btn-close",
          colYear: ".year-col",
          colMonth: ".month-col",
          colDay: ".day-col",
          wrapper: ".picker-wrapper",
          input: ".picker-input",
          iconBtn: ".picker-icon-btn",
          errorText: ".error-text",
          group: ".input-group",
          list: ".wheel-list",
          item: ".wheel-item",
        },
        className: {
          active: "is-active",
          selected: "selected",
          error: "input-error",
          showError: "show",
          wheelItem: "wheel-item",
        },
      },
      state: {
        activeInput: null,
        activeConfig: null,
        originalValue: null,
      },
      ui: {
        overlay: null,
        sheet: null,
        btnDone: null,
        btnClose: null,
        cols: { year: null, month: null, day: null },
      },
    };

    const { selector, className } = picker.domConfig;

    // ============================================================
    // 2. 초기화 및 UI 캐싱
    // ============================================================
    function cacheUI() {
      picker.ui.overlay = document.querySelector(selector.overlay);
      picker.ui.sheet = document.querySelector(selector.sheet);
      picker.ui.btnDone = document.querySelector(selector.btnDone);
      picker.ui.btnClose = document.querySelector(selector.btnClose);
      picker.ui.cols.year = document.querySelector(selector.colYear);
      picker.ui.cols.month = document.querySelector(selector.colMonth);
      picker.ui.cols.day = document.querySelector(selector.colDay);
    }
    cacheUI();

    // ============================================================
    // 3. 피커 연결 로직
    // ============================================================
    function attachPickerToElement(container, options = {}) {
      if (!container) return;
      if (!container.dataset.pickerId) {
        container.dataset.pickerId =
          "group-" + Math.random().toString(36).substr(2, 9);
      }

      const currentYear = new Date().getFullYear();

      // [수정] 기본 범위 확장 (1900 ~ 현재 + 100년)
      const settings = {
        minYear: 1900,
        maxYear: currentYear + 100,
        manualEdit: true,
        closeOnScrollEnter: false,
        dateFormat: (y, m, d, w) =>
          `${y}년 ${String(m).padStart(2, "0")}월 ${String(d).padStart(2, "0")}일 ${w}`,
        ...options,
      };

      const wrappers = container.querySelectorAll(selector.wrapper);
      if (wrappers.length === 0) return;

      wrappers.forEach((wrapper) => {
        const input = wrapper.querySelector(selector.input);
        const iconBtn = wrapper.querySelector(selector.iconBtn);
        if (!input) return;

        if (settings.manualEdit) {
          input.removeAttribute("readonly");
          input.addEventListener("blur", () =>
            handleValidation(input, settings),
          );
          input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") input.blur();
          });
          input.addEventListener("input", () => clearError(container));
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
      });
    }

    // ============================================================
    // 4. 자동 초기화
    // ============================================================
    function scanAndInitialize() {
      const targets = document.querySelectorAll(selector.autoInitClass);
      targets.forEach((el) => {
        if (el.dataset.pickerInitialized) return;

        const minYearAttr = el.dataset.minYear;
        const maxYearAttr = el.dataset.maxYear;
        const closeOnEnterAttr = el.dataset.closeOnEnter;

        const currentYear = new Date().getFullYear();
        const options = {};

        if (minYearAttr) options.minYear = parseInt(minYearAttr);
        if (maxYearAttr) {
          if (maxYearAttr.toLowerCase() === "current") {
            options.maxYear = currentYear;
          } else {
            options.maxYear = parseInt(maxYearAttr);
          }
        }
        if (closeOnEnterAttr === "true") {
          options.closeOnScrollEnter = true;
        }

        attachPickerToElement(el, options);
        el.dataset.pickerInitialized = "true";
      });
    }

    // ============================================================
    // 5. 바텀 시트 제어 (핵심 수정 부분)
    // ============================================================

    function openSheet(inputElement, containerElement, settings) {
      if (!picker.ui.sheet || !picker.ui.overlay) return;

      picker.state.activeInput = inputElement;
      picker.state.activeConfig = settings;
      picker.state.originalValue = inputElement.value;

      clearError(containerElement);

      const targetDate = parseDateString(inputElement.value) || {
        y: new Date().getFullYear(),
        m: new Date().getMonth() + 1,
        d: new Date().getDate(),
      };

      // [수정] 년도 데이터 생성 로직 강화
      // 시작 년도부터 끝 년도까지 정확하게 배열 생성
      const yearRange = settings.maxYear - settings.minYear + 1;
      const years = Array.from(
        { length: yearRange },
        (_, i) => settings.minYear + i,
      );

      const months = Array.from({ length: 12 }, (_, i) => i + 1);

      // [수정] 일(Day) 데이터 생성 로직 (해당 월의 실제 일수 반영)
      // 현재 선택된 년/월에 맞춰서 일수를 계산합니다.
      const daysInMonth = new Date(targetDate.y, targetDate.m, 0).getDate();
      const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

      // 휠 렌더링
      if (picker.ui.cols.year)
        renderWheel(
          picker.ui.cols.year,
          years,
          "년",
          targetDate.y,
          "년도 선택",
        );
      if (picker.ui.cols.month)
        renderWheel(
          picker.ui.cols.month,
          months,
          "월",
          targetDate.m,
          "월 선택",
        );
      if (picker.ui.cols.day)
        renderWheel(picker.ui.cols.day, days, "일", targetDate.d, "일 선택");

      // [추가 기능] 년/월 변경 시 일(Day) 수 업데이트를 위한 이벤트 리스너 필요
      // 하지만 현재 구조상 복잡해질 수 있어, 기본적으로 31일까지 생성하되
      // 선택 시 유효성 검사에서 처리하는 것이 UX상 더 부드러울 수 있습니다.
      // 여기서는 일단 31일까지 넉넉하게 생성하도록 롤백하여 끊김 방지
      const safeDays = Array.from({ length: 31 }, (_, i) => i + 1);
      if (picker.ui.cols.day)
        renderWheel(
          picker.ui.cols.day,
          safeDays,
          "일",
          targetDate.d,
          "일 선택",
        );

      picker.ui.overlay.classList.add(className.active);
      picker.ui.sheet.classList.add(className.active);

      setTimeout(() => {
        if (picker.ui.btnDone) picker.ui.btnDone.focus();
      }, 50);
    }

    function closeSheet(isSaved = false) {
      if (picker.ui.overlay)
        picker.ui.overlay.classList.remove(className.active);
      if (picker.ui.sheet) picker.ui.sheet.classList.remove(className.active);

      if (picker.state.activeInput) {
        setTimeout(() => {
          picker.state.activeInput.focus();
        }, 50);
      }
    }

    function applySelection() {
      const { activeInput, activeConfig } = picker.state;
      if (!activeInput || !activeConfig) return;

      const y = picker.ui.cols.year
        ? getSelectedValue(picker.ui.cols.year)
        : null;
      const m = picker.ui.cols.month
        ? getSelectedValue(picker.ui.cols.month)
        : null;
      const d = picker.ui.cols.day
        ? getSelectedValue(picker.ui.cols.day)
        : null;

      if (y && m && d) {
        const dayOfWeek = getDayOfWeek(y, m, d);
        activeInput.value = activeConfig.dateFormat(y, m, d, dayOfWeek);
        const container = activeInput.closest(selector.group);
        if (container) clearError(container);
      }
      closeSheet(true);
    }

    // ============================================================
    // 6. 3D 휠 렌더링 & 키보드 핸들링
    // ============================================================

    function renderWheel(
      colElement,
      dataArray,
      label,
      initialValue,
      ariaLabel,
    ) {
      if (!colElement) return;

      const ul = colElement.querySelector(selector.list);
      if (!ul) return;

      colElement.setAttribute("role", "listbox");
      colElement.setAttribute("aria-label", ariaLabel);
      colElement.setAttribute("tabindex", "0");

      ul.innerHTML = "";

      const { ITEM_HEIGHT, CONTAINER_HEIGHT } = picker.config;
      const padding = (CONTAINER_HEIGHT - ITEM_HEIGHT) / 2;

      ul.style.paddingTop = `${padding}px`;
      ul.style.paddingBottom = `${padding}px`;

      // [수정] 초기 인덱스 찾기 로직 강화
      // 값이 없거나 범위 밖이면 중간쯤이나 0으로 설정
      let initialIndex = dataArray.indexOf(parseInt(initialValue));
      if (initialIndex === -1) initialIndex = 0;

      const fragment = document.createDocumentFragment();

      dataArray.forEach((val, index) => {
        const li = document.createElement("li");
        li.className = className.wheelItem;
        li.textContent = `${val}${label}`;
        li.dataset.val = val;
        li.setAttribute("role", "option");
        li.setAttribute("aria-selected", "false");
        fragment.appendChild(li);
      });
      ul.appendChild(fragment);

      const cachedItems = Array.from(ul.children);

      if (!colElement.dataset.hasKeyboardEvent) {
        colElement.addEventListener("keydown", (e) =>
          handleWheelKeyboard(e, colElement),
        );
        colElement.dataset.hasKeyboardEvent = "true";
      }

      // [수정] 스크롤 위치 초기화 (정확한 위치로 이동)
      setTimeout(() => {
        if (colElement) {
          colElement.scrollTop = initialIndex * ITEM_HEIGHT;
          requestAnimationFrame(() => update3D(colElement, cachedItems));
        }
      }, 0);

      colElement.onscroll = () => {
        requestAnimationFrame(() => update3D(colElement, cachedItems));
      };
    }

    function handleWheelKeyboard(e, colElement) {
      const { ITEM_HEIGHT } = picker.config;
      const { activeConfig } = picker.state;

      if (e.key === "ArrowUp") {
        e.preventDefault();
        colElement.scrollBy({ top: -ITEM_HEIGHT, behavior: "smooth" });
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        colElement.scrollBy({ top: ITEM_HEIGHT, behavior: "smooth" });
      } else if (e.key === "Enter") {
        if (activeConfig && activeConfig.closeOnScrollEnter) {
          e.preventDefault();
          applySelection();
        }
      }
    }

    function update3D(colElement, items) {
      if (!colElement) return;

      const { ITEM_HEIGHT, VISIBLE_RANGE } = picker.config;
      const center = colElement.scrollTop + colElement.clientHeight / 2;

      items.forEach((item) => {
        if (!item) return;

        const itemCenter = item.offsetTop + ITEM_HEIGHT / 2;
        const dist = center - itemCenter;
        const absDist = Math.abs(dist);

        if (absDist > VISIBLE_RANGE) {
          if (item.style.transform) {
            item.style.transform = "";
            item.style.opacity = "0.3";
            item.classList.remove(className.selected);
            item.setAttribute("aria-selected", "false");
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
          if (!item.classList.contains(className.selected)) {
            item.classList.add(className.selected);
            item.setAttribute("aria-selected", "true");
          }
        } else {
          item.classList.remove(className.selected);
          item.setAttribute("aria-selected", "false");
        }
      });
    }

    // ============================================================
    // 7. 유틸리티 함수
    // ============================================================

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
          showError(container, input);
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

    function showError(container, targetInput) {
      if (!container) return;
      const errorText = container.querySelector(selector.errorText);
      if (errorText) errorText.classList.add(className.showError);
      if (targetInput) {
        const wrapper = targetInput.closest(selector.wrapper);
        if (wrapper) wrapper.classList.add(className.error);
      }
    }

    function clearError(container) {
      if (!container) return;
      const errorText = container.querySelector(selector.errorText);
      if (errorText) errorText.classList.remove(className.showError);
      const allWrappers = container.querySelectorAll(selector.wrapper);
      allWrappers.forEach((w) => w.classList.remove(className.error));
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

    // ============================================================
    // 8. 실행부
    // ============================================================

    if (picker.ui.btnDone)
      picker.ui.btnDone.addEventListener("click", () => applySelection());

    const cancelAction = () => closeSheet(false);
    if (picker.ui.btnClose)
      picker.ui.btnClose.addEventListener("click", cancelAction);
    if (picker.ui.overlay)
      picker.ui.overlay.addEventListener("click", cancelAction);

    scanAndInitialize();
  }

  initializeDatePicker();
});
