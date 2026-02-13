document.addEventListener("DOMContentLoaded", () => {
  /**
   * [Main Logic] iOS 스타일 3D 데이트 피커 시스템
   * * 기능:
   * 1. 3D 휠 스크롤 (가속도 및 관성 효과는 CSS scroll-snap으로 구현)
   * 2. 웹 접근성 준수 (ARIA, 키보드 지원, 포커스 관리)
   * 3. 자동 초기화 (HTML 속성 기반)
   * 4. 다중 인풋 지원 (하나의 그룹 내 시작일~종료일)
   */
  function initializeDatePicker() {
    // ============================================================
    // 1. 시스템 전역 설정 (Configuration & State)
    // ============================================================
    const picker = {
      // [상수 설정] 디자인 및 성능 관련 수치
      config: {
        ITEM_HEIGHT: 40, // 휠 아이템 하나의 높이 (px) -> CSS .wheel-item height와 일치 필수
        CONTAINER_HEIGHT: 220, // 휠 전체 컨테이너 높이 (px) -> CSS .picker-area height와 일치 필수
        VISIBLE_RANGE: 150, // 렌더링 최적화 범위 (이 범위 밖의 아이템은 3D 연산 제외)
      },

      // [DOM 설정] 클래스명 및 선택자 관리 (유지보수 용이성)
      domConfig: {
        selector: {
          autoInitClass: ".js-date-picker", // 자동 초기화 대상 클래스

          // 공유 UI (바텀 시트)
          overlay: ".picker-overlay",
          sheet: ".bottom-sheet",
          btnDone: ".btn-done",
          btnClose: ".btn-close",

          // 휠 컬럼
          colYear: ".year-col",
          colMonth: ".month-col",
          colDay: ".day-col",
          list: ".wheel-list",

          // 입력 그룹 (Input Group)
          group: ".input-group", // 컨테이너
          wrapper: ".picker-wrapper", // 인풋 감싸는 박스
          input: ".picker-input", // 실제 인풋
          iconBtn: ".picker-icon-btn", // 달력 아이콘 버튼
          errorText: ".error-text", // 에러 메시지
        },
        className: {
          active: "is-active", // 활성화 상태
          selected: "selected", // 휠 중앙 선택됨
          error: "input-error", // 에러 발생 (빨간 테두리)
          showError: "show", // 에러 메시지 표시
          wheelItem: "wheel-item", // 생성되는 휠 아이템 클래스
        },
      },

      // [상태 관리] 현재 실행 중인 피커의 정보
      state: {
        activeInput: null, // 현재 열린 Input 요소
        activeConfig: null, // 현재 적용된 설정 옵션
        originalValue: null, // (취소 대비용) 열렸을 때의 초기 값
      },

      // [UI 캐시] 자주 사용하는 DOM 요소를 메모리에 저장
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
    // 2. 초기화 및 UI 캐싱 (Initialization)
    // ============================================================
    function cacheUI() {
      // 바텀 시트 관련 전역 요소들을 찾아 변수에 저장합니다.
      // 매번 querySelector를 호출하는 비용을 줄이기 위함입니다.
      picker.ui.overlay = document.querySelector(selector.overlay);
      picker.ui.sheet = document.querySelector(selector.sheet);
      picker.ui.btnDone = document.querySelector(selector.btnDone);
      picker.ui.btnClose = document.querySelector(selector.btnClose);

      picker.ui.cols.year = document.querySelector(selector.colYear);
      picker.ui.cols.month = document.querySelector(selector.colMonth);
      picker.ui.cols.day = document.querySelector(selector.colDay);
    }

    // 실행: UI 요소 찾기
    cacheUI();

    // ============================================================
    // 3. 피커 연결 로직 (Core Attachment)
    // ============================================================

    /**
     * 특정 컨테이너(.input-group) 내의 인풋들에 피커 기능을 연결합니다.
     * @param {HTMLElement} container - 대상 컨테이너 DOM
     * @param {Object} options - 사용자 설정 (minYear, maxYear 등)
     */
    function attachPickerToElement(container, options = {}) {
      if (!container) return;

      // 내부 식별용 ID 부여 (디버깅 및 중복 방지용)
      if (!container.dataset.pickerId) {
        container.dataset.pickerId =
          "group-" + Math.random().toString(36).substr(2, 9);
      }

      const currentYear = new Date().getFullYear();

      // [설정 병합] 기본값 + 사용자 옵션
      const settings = {
        minYear: currentYear - 50,
        maxYear: currentYear + 50,
        manualEdit: true, // 직접 타이핑 허용
        closeOnScrollEnter: false, // 휠에서 엔터키 입력 시 선택 적용 여부
        // 날짜 포맷 함수 (필요 시 수정 가능)
        dateFormat: (y, m, d, w) =>
          `${y}년 ${String(m).padStart(2, "0")}월 ${String(d).padStart(2, "0")}일 ${w}`,
        ...options,
      };

      // 컨테이너 내의 모든 래퍼(인풋+버튼 쌍)를 찾습니다.
      // (시작일~종료일 처럼 인풋이 여러 개일 수 있음)
      const wrappers = container.querySelectorAll(selector.wrapper);

      if (wrappers.length === 0) return;

      wrappers.forEach((wrapper) => {
        const input = wrapper.querySelector(selector.input);
        const iconBtn = wrapper.querySelector(selector.iconBtn);

        if (!input) return; // 인풋이 없으면 건너뜀

        if (settings.manualEdit) {
          // [수동 입력 모드]
          input.removeAttribute("readonly");

          // Blur: 포커스 잃을 때 유효성 검사
          input.addEventListener("blur", () =>
            handleValidation(input, settings),
          );
          // Keydown: 엔터키 누르면 Blur 처리 (유효성 검사 트리거)
          input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") input.blur();
          });
          // Input: 타이핑 중에는 에러 메시지 숨김 (UX)
          input.addEventListener("input", () => clearError(container));

          // 버튼 클릭 시에만 바텀 시트 오픈
          if (iconBtn) {
            iconBtn.addEventListener("click", (e) => {
              e.stopPropagation();
              openSheet(input, container, settings);
            });
          }
        } else {
          // [읽기 전용 모드]
          input.setAttribute("readonly", true);
          // 래퍼 영역 클릭 시 바텀 시트 오픈
          wrapper.addEventListener("click", () => {
            openSheet(input, container, settings);
          });
        }
      });
    }

    // ============================================================
    // 4. 자동 초기화 (Auto Init)
    // ============================================================
    /**
     * HTML에 .js-date-picker 클래스가 있는 요소를 찾아 자동으로 기능을 붙입니다.
     * data-* 속성을 읽어 옵션으로 변환합니다.
     */
    function scanAndInitialize() {
      const targets = document.querySelectorAll(selector.autoInitClass);

      targets.forEach((el) => {
        // 이미 초기화된 요소는 패스 (중복 실행 방지)
        if (el.dataset.pickerInitialized) return;

        // HTML data 속성 읽기
        const minYearAttr = el.dataset.minYear;
        const maxYearAttr = el.dataset.maxYear;
        const closeOnEnterAttr = el.dataset.closeOnEnter;

        const currentYear = new Date().getFullYear();
        const options = {};

        // 속성값 파싱
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

        // 기능 부착 실행
        attachPickerToElement(el, options);

        // 초기화 완료 플래그 설정
        el.dataset.pickerInitialized = "true";
      });
    }

    // ============================================================
    // 5. 바텀 시트 제어 (Sheet Control)
    // ============================================================

    function openSheet(inputElement, containerElement, settings) {
      // UI 요소가 없으면 중단 (안전 장치)
      if (!picker.ui.sheet || !picker.ui.overlay) return;

      // 현재 작업 중인 인풋과 설정 상태 저장
      picker.state.activeInput = inputElement;
      picker.state.activeConfig = settings;
      picker.state.originalValue = inputElement.value; // 취소 대비용 값 저장

      // 에러 메시지 초기화 (시트 열 때는 깨끗하게)
      clearError(containerElement);

      // 입력된 날짜 파싱 (값이 없으면 오늘 날짜 기준)
      const targetDate = parseDateString(inputElement.value) || {
        y: new Date().getFullYear(),
        m: new Date().getMonth() + 1,
        d: new Date().getDate(),
      };

      // 휠 데이터 배열 생성 (Array.from 사용)
      const years = Array.from(
        { length: settings.maxYear - settings.minYear + 1 },
        (_, i) => settings.minYear + i,
      );
      const months = Array.from({ length: 12 }, (_, i) => i + 1);
      const days = Array.from({ length: 31 }, (_, i) => i + 1);

      // 3개의 휠 렌더링 (접근성 라벨 포함)
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

      // CSS 클래스로 시트 표시 애니메이션 시작
      picker.ui.overlay.classList.add(className.active);
      picker.ui.sheet.classList.add(className.active);

      // [접근성] 시트가 열리면 '완료' 버튼으로 포커스 이동 (스크린 리더 알림)
      setTimeout(() => {
        if (picker.ui.btnDone) picker.ui.btnDone.focus();
      }, 50);
    }

    /**
     * 시트 닫기
     * @param {boolean} isSaved - 완료(true)인지 취소(false)인지 구분
     */
    function closeSheet(isSaved = false) {
      if (picker.ui.overlay)
        picker.ui.overlay.classList.remove(className.active);
      if (picker.ui.sheet) picker.ui.sheet.classList.remove(className.active);

      // 취소 시 로직 (필요하다면 여기에 원복 로직 추가)
      if (!isSaved) {
        // 예: picker.state.activeInput.value = picker.state.originalValue;
      }

      // [접근성] 닫히면 원래 있던 Input으로 포커스 복귀
      if (picker.state.activeInput) {
        setTimeout(() => {
          picker.state.activeInput.focus();
        }, 50);
      }
    }

    // 선택 완료 처리
    function applySelection() {
      const { activeInput, activeConfig } = picker.state;
      if (!activeInput || !activeConfig) return;

      // 각 휠에서 선택된 값 가져오기
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
        // 포맷팅 후 Input에 값 주입
        activeInput.value = activeConfig.dateFormat(y, m, d, dayOfWeek);

        // 컨테이너 내의 에러 메시지 제거
        const container = activeInput.closest(selector.group);
        if (container) clearError(container);
      }

      // 저장 상태로 닫기
      closeSheet(true);
    }

    // ============================================================
    // 6. 3D 휠 렌더링 및 로직 (Rendering Core)
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

      // [접근성] ARIA 속성 부여
      ul.setAttribute("role", "listbox");
      ul.setAttribute("aria-label", ariaLabel);
      ul.setAttribute("tabindex", "0"); // 키보드 포커스 가능

      ul.innerHTML = ""; // 기존 아이템 초기화

      const { ITEM_HEIGHT, CONTAINER_HEIGHT } = picker.config;
      const padding = (CONTAINER_HEIGHT - ITEM_HEIGHT) / 2;

      // 중앙 정렬을 위한 상하단 패딩
      ul.style.paddingTop = `${padding}px`;
      ul.style.paddingBottom = `${padding}px`;

      let initialIndex = 0;

      // DocumentFragment를 사용하여 DOM 조작 최소화 (성능 최적화)
      const fragment = document.createDocumentFragment();

      dataArray.forEach((val, index) => {
        const li = document.createElement("li");
        li.className = className.wheelItem;
        li.textContent = `${val}${label}`;
        li.dataset.val = val;

        // [접근성] 옵션 역할 부여
        li.setAttribute("role", "option");
        li.setAttribute("aria-selected", "false");

        fragment.appendChild(li);

        if (val == initialValue) initialIndex = index;
      });
      ul.appendChild(fragment);

      // 렌더링 된 아이템들을 배열로 캐싱 (스크롤 이벤트에서 재사용)
      const cachedItems = Array.from(ul.children);

      // [이벤트] 키보드 핸들러 (중복 방지 체크)
      if (!ul.dataset.hasKeyboardEvent) {
        ul.addEventListener("keydown", (e) =>
          handleWheelKeyboard(e, colElement),
        );
        ul.dataset.hasKeyboardEvent = "true";
      }

      // 초기 위치로 스크롤 이동 (비동기 실행으로 렌더링 보장)
      setTimeout(() => {
        if (colElement) {
          colElement.scrollTop = initialIndex * ITEM_HEIGHT;
          // 최초 1회 3D 효과 적용
          requestAnimationFrame(() => update3D(colElement, cachedItems));
        }
      }, 0);

      // 스크롤 이벤트: 3D 효과 업데이트
      colElement.onscroll = () => {
        requestAnimationFrame(() => update3D(colElement, cachedItems));
      };
    }

    /**
     * 키보드 방향키 조작 핸들러
     */
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
        // 옵션이 켜져있을 때만 엔터키로 선택 적용
        if (activeConfig && activeConfig.closeOnScrollEnter) {
          e.preventDefault();
          applySelection();
        }
      }
    }

    /**
     * 스크롤 위치에 따른 3D 변환 계산 (핵심 시각 효과)
     */
    function update3D(colElement, items) {
      if (!colElement) return;

      const { ITEM_HEIGHT, VISIBLE_RANGE } = picker.config;
      const center = colElement.scrollTop + colElement.clientHeight / 2;

      items.forEach((item) => {
        if (!item) return;

        const itemCenter = item.offsetTop + ITEM_HEIGHT / 2;
        const dist = center - itemCenter; // 화면 중앙과의 거리
        const absDist = Math.abs(dist);

        // [최적화] 화면에 안 보이는 아이템은 연산 건너뛰기
        if (absDist > VISIBLE_RANGE) {
          if (item.style.transform) {
            item.style.transform = "";
            item.style.opacity = "0.3";
            item.classList.remove(className.selected);
            item.setAttribute("aria-selected", "false");
          }
          return;
        }

        // 3D 수학 연산 (각도, 투명도, 깊이)
        const angle = Math.max(Math.min(dist / 5, 60), -60);
        const opacity = Math.max(1 - Math.pow(absDist / 150, 2), 0.1);
        const offset = -Math.pow(absDist / 10, 1.5);

        item.style.setProperty("--angle", -angle);
        item.style.setProperty("--opacity", opacity);
        item.style.setProperty("--offset", offset);

        // 중앙 아이템 선택 상태 업데이트
        if (absDist < ITEM_HEIGHT / 2 + 1) {
          if (!item.classList.contains(className.selected)) {
            item.classList.add(className.selected);
            item.setAttribute("aria-selected", "true"); // 접근성: 선택됨 알림
          }
        } else {
          item.classList.remove(className.selected);
          item.setAttribute("aria-selected", "false");
        }
      });
    }

    // ============================================================
    // 7. 유틸리티 함수 (Validation & Parsing)
    // ============================================================

    function handleValidation(input, settings) {
      if (!input) return;

      const val = input.value.trim();
      const container = input.closest(selector.group);

      // 빈 값이면 에러 아님 (선택 안 함으로 간주)
      if (!val) {
        if (container) clearError(container);
        return;
      }

      const dateObj = parseDateString(val);
      let isValid = false;

      if (dateObj) {
        // 날짜 유효성 및 범위 체크
        if (isValidDate(dateObj.y, dateObj.m, dateObj.d)) {
          if (dateObj.y >= settings.minYear && dateObj.y <= settings.maxYear) {
            isValid = true;
          }
        }
      }

      if (container) {
        if (isValid) {
          // 유효하면 포맷팅 적용 후 에러 제거
          const w = getDayOfWeek(dateObj.y, dateObj.m, dateObj.d);
          input.value = settings.dateFormat(dateObj.y, dateObj.m, dateObj.d, w);
          clearError(container);
        } else {
          // 유효하지 않으면 에러 표시
          showError(container, input);
        }
      }
    }

    // 다양한 날짜 문자열 파싱 (YYYYMMDD, YYMMDD, 구분자 등)
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

    // 에러 표시 (특정 인풋 강조 + 메시지)
    function showError(container, targetInput) {
      if (!container) return;

      const errorText = container.querySelector(selector.errorText);
      if (errorText) errorText.classList.add(className.showError);

      if (targetInput) {
        const wrapper = targetInput.closest(selector.wrapper);
        if (wrapper) wrapper.classList.add(className.error);
      }
    }

    // 에러 제거 (전체)
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
    // 8. 실행부 (Execution & Events)
    // ============================================================

    // 완료 버튼 (저장)
    if (picker.ui.btnDone)
      picker.ui.btnDone.addEventListener("click", () => applySelection());

    // 닫기/취소 동작
    const cancelAction = () => closeSheet(false);

    if (picker.ui.btnClose)
      picker.ui.btnClose.addEventListener("click", cancelAction);
    if (picker.ui.overlay)
      picker.ui.overlay.addEventListener("click", cancelAction);

    // [자동 초기화 실행]
    scanAndInitialize();
  }

  // 문서 로드 완료 시 초기화 함수 실행
  initializeDatePicker();
});
