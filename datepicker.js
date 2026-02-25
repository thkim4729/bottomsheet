document.addEventListener("DOMContentLoaded", initDatePicker);

function initDatePicker() {
  /* ============================================================
     [1] 환경 설정 및 상태 관리 (Configuration & State)
     ============================================================ */
  const currentYear = new Date().getFullYear();

  // 피커 전체의 동작과 다국어 텍스트, 휠의 기본 범위를 정의하는 설정 객체
  const CONFIG = {
    manualInput: true, // 사용자가 직접 키보드로 입력 허용 여부
    autoDayAdjust: true, // 연/월 변경 시 일(day) 수 28/30/31 자동 조정
    CLASSES: {
      active: "is-active", // 시트가 열렸을 때 부여할 클래스
      selected: "selected", // 휠에서 선택된 항목에 부여할 클래스
    },
    locale: {
      sun: "일",
      mon: "월",
      tue: "화",
      wed: "수",
      thu: "목",
      fri: "금",
      sat: "토",
      am: "오전",
      pm: "오후",
      daySuffix: "요일",
    },
    WHEEL_DEFS: {
      year: { min: currentYear - 5, max: currentYear + 5, suffix: "년", label: "연도" },
      month: { min: 1, max: 12, suffix: "월", label: "월" },
      day: { min: 1, max: 31, suffix: "일", label: "일" },
      ampm: { min: 0, max: 1, suffix: "", label: "오전/오후" },
      hour: { min: 0, max: 23, suffix: "시", label: "시간" },
      minute: { min: 0, max: 59, suffix: "분", label: "분" },
    },
  };
  CONFIG.WHEEL_DEFS.ampm.items = [CONFIG.locale.am, CONFIG.locale.pm];

  // 현재 열려있는 피커의 상태를 관리하는 객체
  const state = {
    activeInput: null, // 현재 연결된 input 요소
    activeColumns: [], // 현재 렌더링된 휠 컬럼 목록 (예: ['year', 'month', 'day'])
    activeFormat: "", // 결과값 출력 양식 (예: 'YYYY-MM-DD')
    scrollTimer: null, // 스크롤 종료 감지용 타이머
    lastFocusedElement: null, // 시트가 열리기 전 포커스가 있던 요소 (닫힐 때 복귀용)
    announcementTimer: null, // 스크린 리더 음성 안내 지연 타이머
    interactionType: "touch", // 터치/마우스 조작인지 톡백(focus) 조작인지 구분
  };

  // UI 요소들을 캐싱해두는 객체
  const ui = {
    sheet: null,
    overlay: null,
    btnDone: null,
    btnClose: null,
    pickerArea: null,
    liveRegion: null,
    colMap: {}, // 동적으로 생성된 컬럼 요소를 id 기준으로 저장 (예: { year: HTMLDivElement })
  };

  /* ============================================================
     [2] 초기화 및 이벤트 바인딩 (Initialization & Events)
     ============================================================ */

  // 피커 시스템을 가동하는 메인 함수
  function setup() {
    cacheUI();
    setupA11y();
    bindInputEvents();
    bindSheetEvents();
  }

  // HTML에 존재하는 고정 UI 요소들을 찾아서 ui 객체에 연결
  function cacheUI() {
    ui.overlay = document.querySelector(".picker-overlay");
    ui.sheet = document.querySelector(".bottom-sheet");
    ui.btnDone = document.querySelector(".btn-done");
    ui.btnClose = document.querySelector(".btn-close");
    ui.pickerArea = document.querySelector(".picker-area");
  }

  // 스크린 리더(톡백) 안내를 위한 투명한 Live Region 영역 생성
  function setupA11y() {
    const liveRegion = document.createElement("div");
    liveRegion.className = "sr-only";
    liveRegion.setAttribute("aria-live", "polite");
    liveRegion.setAttribute("aria-atomic", "true");
    document.body.appendChild(liveRegion);
    ui.liveRegion = liveRegion;
  }

  // 화면에 있는 모든 date_picker 인풋에 클릭 이벤트 연결
  function bindInputEvents() {
    document.querySelectorAll(".date_picker").forEach((container) => {
      container.querySelectorAll(".picker-wrapper").forEach((wrapper) => {
        const input = wrapper.querySelector(".picker-input");
        const iconBtn = wrapper.querySelector(".picker-icon-btn");
        if (!input) return;

        input.readOnly = !CONFIG.manualInput;
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") input.blur();
        });

        const trigger = iconBtn || wrapper;
        trigger.addEventListener("click", (e) => {
          e.stopPropagation();
          const columnsStr = wrapper.dataset.columns || "year,month,day";
          const formatStr = wrapper.dataset.format || "YYYY-MM-DD";
          openSheet(
            input,
            columnsStr.split(",").map((c) => c.trim()),
            formatStr,
          );
        });
      });
    });
  }

  // 바텀시트 내부 버튼 및 인터랙션 타입 감지 이벤트 연결
  function bindSheetEvents() {
    ui.btnClose.addEventListener("click", closeSheet);
    ui.overlay.addEventListener("click", closeSheet);
    ui.btnDone.addEventListener("click", confirmSelection);

    // 사용자의 조작이 일반 터치인지 스크린 리더 초점 이동인지 감지
    ui.pickerArea.addEventListener("touchstart", () => (state.interactionType = "touch"), { passive: true });
    ui.pickerArea.addEventListener("mousedown", () => (state.interactionType = "touch"));
    ui.pickerArea.addEventListener("wheel", () => (state.interactionType = "touch"));

    ui.pickerArea.addEventListener("focusin", (e) => {
      if (e.target.classList.contains("wheel-item")) {
        state.interactionType = "focus";
      }
    });
  }

  /* ============================================================
     [3] 바텀시트 제어 (Sheet Control)
     ============================================================ */

  // 바텀시트를 열고 동적 휠을 렌더링하는 함수
  function openSheet(input, activeColumns, formatStr) {
    state.lastFocusedElement = input;
    state.activeInput = input;
    state.activeColumns = activeColumns;
    state.activeFormat = formatStr;

    // 오전/오후 휠이 포함되어 있으면 시간 휠을 1~12시간제로 변경
    if (activeColumns.includes("ampm")) {
      CONFIG.WHEEL_DEFS.hour.min = 1;
      CONFIG.WHEEL_DEFS.hour.max = 12;
    } else {
      CONFIG.WHEEL_DEFS.hour.min = 0;
      CONFIG.WHEEL_DEFS.hour.max = 23;
    }

    buildWheels(input.value);

    ui.sheet.classList.add(CONFIG.CLASSES.active);
    ui.overlay.classList.add(CONFIG.CLASSES.active);
    ui.sheet.setAttribute("tabindex", "-1");
    ui.sheet.addEventListener("keydown", trapFocus);

    setTimeout(() => ui.sheet.focus(), 150);
  }

  // 바텀시트를 닫고 원래 인풋으로 포커스를 돌려주는 함수
  function closeSheet() {
    ui.overlay.classList.remove(CONFIG.CLASSES.active);
    ui.sheet.classList.remove(CONFIG.CLASSES.active);
    ui.sheet.removeEventListener("keydown", trapFocus);

    if (state.lastFocusedElement) {
      const input = state.lastFocusedElement;
      const originalReadOnly = input.readOnly;

      // 모바일 기기 키보드 팝업 방지 트릭
      input.readOnly = true;
      input.focus();
      setTimeout(() => {
        input.readOnly = originalReadOnly;
      }, 150);

      state.lastFocusedElement = null;
    }
  }

  // 완료 버튼 클릭 시 확정된 값을 바탕으로 결과 문자열을 인풋에 반영
  function confirmSelection() {
    const vals = {};
    state.activeColumns.forEach((colId) => {
      vals[colId] = parseInt(ui.colMap[colId].dataset.selectedValue, 10);
    });

    state.activeInput.value = formatResult(vals, state.activeFormat);
    closeSheet();
  }

  /* ============================================================
     [4] DOM 생성 및 렌더링 (DOM Construction & Rendering)
     ============================================================ */

  // 데이터 속성에 맞춰 바텀시트 내부의 컬럼들을 조립하는 함수
  function buildWheels(inputValue) {
    ui.pickerArea.replaceChildren(); // innerHTML 대체

    const highlightBar = document.createElement("div");
    highlightBar.className = "highlight-bar";
    ui.pickerArea.appendChild(highlightBar);

    ui.colMap = {};
    const initialValues = parseInitialValues(inputValue);

    state.activeColumns.forEach((colId) => {
      const def = CONFIG.WHEEL_DEFS[colId];
      if (!def) return;

      const colDiv = createWheelColumn(colId, def);
      ui.pickerArea.appendChild(colDiv);
      ui.colMap[colId] = colDiv;

      renderWheelItems(colDiv, def.min, def.max, initialValues[colId], def.suffix, colId);
    });
  }

  // 개별 휠 기둥(div.wheel-col)과 목록 틀(ul.wheel-list) 생성
  function createWheelColumn(colId, def) {
    const colDiv = document.createElement("div");
    colDiv.className = `wheel-col ${colId}-col`;

    const ul = document.createElement("ul");
    ul.className = "wheel-list";
    ul.setAttribute("role", "listbox");
    ul.setAttribute("aria-label", def.label);

    colDiv.appendChild(ul);
    return colDiv;
  }

  // 휠 내부에 들어갈 아이템(li)들을 만들고 이벤트를 부여하는 핵심 함수
  function renderWheelItems(colDiv, min, max, current, suffix, id) {
    const ul = colDiv.querySelector(".wheel-list");
    ul.replaceChildren(); // innerHTML 대체

    // 확정된 값을 데이터셋에 저장
    colDiv.dataset.selectedValue = current;

    const fragment = document.createDocumentFragment();
    let targetItem = null;

    for (let i = min; i <= max; i++) {
      const li = document.createElement("li");
      li.className = "wheel-item";
      li.dataset.val = i;
      li.setAttribute("role", "option");
      li.setAttribute("tabindex", "0");

      const textDiv = document.createElement("div");
      textDiv.className = "wheel-text";

      // 텍스트 포맷 (오전/오후 분기 및 분 단위 0 채우기)
      let displayNum;
      if (id === "ampm") displayNum = CONFIG.WHEEL_DEFS.ampm.items[i];
      else if (id === "minute") displayNum = String(i).padStart(2, "0");
      else displayNum = i;

      textDiv.textContent = displayNum + suffix;
      li.appendChild(textDiv);

      if (i === current) targetItem = li;

      // 상호작용(클릭, 엔터) 시에만 값을 '선택' 확정하고 중앙 이동
      li.addEventListener("click", () => {
        state.interactionType = "touch";
        colDiv.dataset.selectedValue = li.dataset.val;
        updateSelectedClass(colDiv);
        scrollToPerfectCenter(colDiv, li, true);
      });

      li.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          state.interactionType = "touch";
          colDiv.dataset.selectedValue = li.dataset.val;
          updateSelectedClass(colDiv);
          scrollToPerfectCenter(colDiv, li, true);
        }
      });

      fragment.appendChild(li);
    }

    ul.appendChild(fragment);
    updateSelectedClass(colDiv);
    attachScrollEvent(colDiv);

    // 초기 렌더링 시 중앙 요소에 부드럽지 않게 즉시 위치 맞춤
    if (targetItem) {
      setTimeout(() => {
        scrollToPerfectCenter(colDiv, targetItem, false);
        update3D(colDiv);
      }, 0);
    }
  }

  /* ============================================================
     [5] 스크롤 및 3D 애니메이션 (Scroll & 3D Animation)
     ============================================================ */

  // 컬럼에 스크롤 이벤트를 연결 (디바운싱 기법 적용)
  function attachScrollEvent(colDiv) {
    if (colDiv.dataset.hasScroll) return;
    colDiv.addEventListener(
      "scroll",
      () => {
        update3D(colDiv);
        clearTimeout(state.scrollTimer);
        state.scrollTimer = setTimeout(() => handleScrollEnd(colDiv), 150);
      },
      { passive: true },
    );
    colDiv.dataset.hasScroll = "true";
  }

  // 스크롤 시 화면 중앙을 기준으로 자식 요소(wheel-text)에 3D 회전 효과 부여
  function update3D(col) {
    if (col.dataset.isTicking === "true") return;
    col.dataset.isTicking = "true";

    requestAnimationFrame(() => {
      const items = col.querySelectorAll(".wheel-item");
      if (items.length === 0) {
        col.dataset.isTicking = "false";
        return;
      }

      const itemHeight = items[0].offsetHeight || 40;
      const pickerHeight = col.offsetHeight || 220;
      const paddingTop = (pickerHeight - itemHeight) / 2;
      const center = col.scrollTop + pickerHeight / 2;

      items.forEach((item, index) => {
        const itemCenter = paddingTop + index * itemHeight + itemHeight / 2;
        const dist = Math.abs(center - itemCenter);
        applyItemStyle(item, center, itemCenter, dist);
      });

      col.dataset.isTicking = "false";
    });
  }

  // 각 아이템의 각도와 투명도 조절
  function applyItemStyle(item, center, itemCenter, dist) {
    const textEl = item.querySelector(".wheel-text");
    if (!textEl) return;

    if (dist <= 250) {
      const angle = Math.max(Math.min((center - itemCenter) / 5, 50), -50);
      textEl.style.transform = `rotateX(${-angle}deg) translateZ(0)`;
      textEl.style.opacity = Math.max(1 - Math.pow(dist / 250, 2), 0.1);
    } else {
      if (textEl.style.opacity !== "0") textEl.style.opacity = "0";
    }
  }

  // 특정 요소를 브라우저 오차 없이 완벽한 수학적 중앙 위치로 스크롤
  function scrollToPerfectCenter(colDiv, li, smooth = true) {
    const itemHeight = li.offsetHeight || 40;
    const index = Array.from(li.parentNode.children).indexOf(li);
    colDiv.scrollTo({
      top: index * itemHeight,
      behavior: smooth ? "smooth" : "auto",
    });
  }

  // dataset.selectedValue 값과 일치하는 요소에만 굵은 글씨용 selected 클래스 부여
  function updateSelectedClass(colDiv) {
    const val = colDiv.dataset.selectedValue;
    colDiv.querySelectorAll(".wheel-item").forEach((li) => {
      if (li.dataset.val === String(val)) {
        li.classList.add(CONFIG.CLASSES.selected);
        li.setAttribute("aria-selected", "true");
      } else {
        li.classList.remove(CONFIG.CLASSES.selected);
        li.setAttribute("aria-selected", "false");
      }
    });
  }

  // 스크롤이 완전히 멈췄을 때 톡백/일반 터치 구분하여 선택값 업데이트
  function handleScrollEnd(activeCol) {
    if (state.interactionType === "touch") {
      const centerVal = getWheelValue(activeCol);
      if (centerVal !== null) {
        activeCol.dataset.selectedValue = centerVal;
        updateSelectedClass(activeCol);

        // 음성 안내 송출
        const activeId = Object.keys(ui.colMap).find((key) => ui.colMap[key] === activeCol);
        const def = CONFIG.WHEEL_DEFS[activeId];
        if (def) {
          const textValue = activeId === "ampm" ? def.items[centerVal] : centerVal;
          speak(`${textValue}${def.suffix} 선택됨`);
        }
      }
    }
    adjustDaysInMonth(activeCol);
  }

  /* ============================================================
     [6] 데이터 처리 및 날짜 계산 (Data Processing & Date Math)
     ============================================================ */

  // 입력창의 텍스트를 읽어와 초기값을 세팅하는 파서
  function parseInitialValues(inputValue) {
    const nums = inputValue.match(/\d+/g) || [];
    const isPMText = inputValue.includes(CONFIG.locale.pm) || inputValue.toLowerCase().includes("pm");
    const now = new Date();
    const values = {};
    let numIndex = 0;

    state.activeColumns.forEach((colId) => {
      if (colId === "ampm") {
        values[colId] = isPMText ? 1 : 0;
      } else if (nums[numIndex]) {
        values[colId] = parseInt(nums[numIndex], 10);
        numIndex++;
      } else {
        switch (colId) {
          case "year":
            values[colId] = now.getFullYear();
            break;
          case "month":
            values[colId] = now.getMonth() + 1;
            break;
          case "day":
            values[colId] = now.getDate();
            break;
          case "hour":
            let h = now.getHours();
            if (state.activeColumns.includes("ampm")) h = h % 12 || 12;
            values[colId] = h;
            break;
          case "minute":
            values[colId] = Math.floor(now.getMinutes() / 10) * 10;
            break;
          default:
            values[colId] = CONFIG.WHEEL_DEFS[colId].min;
        }
      }
    });
    return values;
  }

  // 특정 휠 기둥의 정중앙에 위치한 값을 계산해 반환
  function getWheelValue(col) {
    if (!col) return null;
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
    return closest ? parseInt(closest.dataset.val, 10) : null;
  }

  // 연/월이 바뀔 때 해당 월의 최대 일수(28/30/31)를 계산해 '일' 휠을 갱신
  function adjustDaysInMonth(activeCol) {
    if (!CONFIG.autoDayAdjust) return;

    const { year, month, day } = ui.colMap;
    if (!year || !month || !day || activeCol === day) return;

    const yVal = parseInt(year.dataset.selectedValue, 10);
    const mVal = parseInt(month.dataset.selectedValue, 10);
    const dVal = parseInt(day.dataset.selectedValue, 10);

    if (yVal && mVal) {
      const maxDay = new Date(yVal, mVal, 0).getDate();
      const currentItemsCount = day.querySelectorAll("li").length;

      if (maxDay !== currentItemsCount) {
        const newDay = dVal > maxDay ? maxDay : dVal;
        renderWheelItems(day, 1, maxDay, newDay, CONFIG.WHEEL_DEFS.day.suffix, "day");
      }
    }
  }

  // 확정된 휠 값들을 모아 HTML의 data-format 양식(예: YYYY-MM-DD)에 맞게 치환
  function formatResult(vals, formatStr) {
    const now = new Date();
    const y = vals.year !== undefined ? vals.year : now.getFullYear();
    const m = vals.month !== undefined ? vals.month : now.getMonth() + 1;
    const d = vals.day !== undefined ? vals.day : now.getDate();
    const min = vals.minute !== undefined ? vals.minute : 0;

    // 오전/오후 12시간제를 24시간제로 변환하여 Date 객체 처리 준비
    let h24 = now.getHours();
    if (vals.hour !== undefined) {
      if (vals.ampm !== undefined) {
        if (vals.ampm === 1) {
          h24 = vals.hour === 12 ? 12 : vals.hour + 12; // 오후
        } else {
          h24 = vals.hour === 12 ? 0 : vals.hour; // 오전
        }
      } else {
        h24 = vals.hour;
      }
    }

    const dateObj = new Date(y, m - 1, d);
    const isPM = h24 >= 12;
    const h12 = h24 % 12 || 12;

    const dayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const currentDayKey = dayKeys[dateObj.getDay()];
    const shortDayName = CONFIG.locale[currentDayKey];

    // 변환할 문자열 맵핑 표
    const map = {
      YYYY: y,
      YY: String(y).slice(-2),
      MM: String(m).padStart(2, "0"),
      M: m,
      DD: String(d).padStart(2, "0"),
      D: d,
      dddd: shortDayName + CONFIG.locale.daySuffix,
      ddd: shortDayName,
      HH: String(h24).padStart(2, "0"),
      H: h24,
      hh: String(h12).padStart(2, "0"),
      h: h12,
      mm: String(min).padStart(2, "0"),
      m: min,
      A: isPM ? CONFIG.locale.pm : CONFIG.locale.am,
      a: isPM ? "pm" : "am",
    };

    // 정규식 치환 오류를 막기 위해 긴 문자열(YYYY)부터 치환되도록 정렬
    const tokens = Object.keys(map).sort((a, b) => b.length - a.length);
    const regex = new RegExp(tokens.join("|"), "g");

    return formatStr.replace(regex, (match) => map[match]);
  }

  /* ============================================================
     [7] 접근성 및 포커스 제어 (Accessibility & Focus Management)
     ============================================================ */

  // 스크린 리더용 실시간 음성 송출 (Live Region 활용)
  function speak(msg) {
    if (state.announcementTimer) clearTimeout(state.announcementTimer);
    if (ui.liveRegion) {
      ui.liveRegion.textContent = "";
      state.announcementTimer = setTimeout(() => {
        ui.liveRegion.textContent = msg;
      }, 50);
    }
  }

  // 바텀시트가 열려있을 때 탭(Tab) 키 이동을 시트 내부로 제한하는 포커스 트랩
  function trapFocus(e) {
    if (e.key !== "Tab") return;
    const focusables = ui.sheet.querySelectorAll('button, [tabindex="0"]');
    if (focusables.length === 0) return;

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

  // 스크립트 실행 트리거
  setup();
}
