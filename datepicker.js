document.addEventListener("DOMContentLoaded", initDatePicker);

function initDatePicker() {
  const currentYear = new Date().getFullYear();

  // 1. [설정] 휠 정의 (배열에서 객체 맵핑 형태로 변경하여 쉽게 찾아 쓰도록 함)
  const CONFIG = {
    manualInput: true,
    autoDayAdjust: true,
    locale: { sun: "일", mon: "월", tue: "화", wed: "수", thu: "목", fri: "금", sat: "토" },
    WHEEL_DEFS: {
      year: { min: currentYear - 5, max: currentYear + 5, suffix: "년", label: "연도 선택" },
      month: { min: 1, max: 12, suffix: "월", label: "월 선택" },
      day: { min: 1, max: 31, suffix: "일", label: "일 선택" },
      hour: { min: 0, max: 23, suffix: "시", label: "시간 선택" },
      minute: { min: 0, max: 59, suffix: "분", label: "분 선택" },
    },
  };

  const state = {
    activeInput: null,
    activeColumns: [], // 현재 열린 바텀시트에서 사용하는 컬럼 목록 저장
    scrollTimer: null,
    lastFocusedElement: null,
    liveRegion: null,
    announcementTimer: null,
  };

  const ui = {
    sheet: null,
    overlay: null,
    btnDone: null,
    pickerArea: null,
    colMap: {},
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
          // wrapper의 data-columns 속성을 읽어서 전달
          const columnsStr = wrapper.dataset.columns || "year,month,day";
          openSheet(
            input,
            columnsStr.split(",").map((c) => c.trim()),
          );
        });
      });
    });
  }

  function cacheUI() {
    if (ui.sheet) return;
    ui.overlay = document.querySelector(".picker-overlay");
    ui.sheet = document.querySelector(".bottom-sheet");
    ui.btnDone = document.querySelector(".btn-done");
    ui.pickerArea = document.querySelector(".picker-area");

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

  // 4. [수정됨] 바텀 시트를 열 때 동적으로 DOM 구성
  function openSheet(input, activeColumns) {
    state.lastFocusedElement = input;
    state.activeInput = input;
    state.activeColumns = activeColumns;

    // 기존 휠 영역 초기화 (하이라이트 바만 남김)
    ui.pickerArea.innerHTML = '<div class="highlight-bar"></div>';
    ui.colMap = {};

    const nums = input.value.match(/\d+/g) || [];
    let numIndex = 0;

    // 요청된 컬럼에 대해서만 HTML 요소를 생성하고 렌더링
    activeColumns.forEach((colId) => {
      const def = CONFIG.WHEEL_DEFS[colId];
      if (!def) return;

      // HTML 요소 동적 생성
      const colDiv = document.createElement("div");
      colDiv.className = `wheel-col ${colId}-col`;
      colDiv.setAttribute("role", "none");

      const ul = document.createElement("ul");
      ul.className = "wheel-list";
      ul.setAttribute("role", "listbox");
      ul.setAttribute("aria-label", def.label);

      colDiv.appendChild(ul);
      ui.pickerArea.appendChild(colDiv);
      ui.colMap[colId] = colDiv;

      // 초기값 설정 로직 (인풋에 값이 있으면 순서대로 매핑, 없으면 현재 시간 기준)
      const now = new Date();
      let initVal = def.min;
      if (nums[numIndex]) {
        initVal = parseInt(nums[numIndex]);
        numIndex++;
      } else {
        if (colId === "year") initVal = now.getFullYear();
        if (colId === "month") initVal = now.getMonth() + 1;
        if (colId === "day") initVal = now.getDate();
        if (colId === "hour") initVal = now.getHours();
        if (colId === "minute") initVal = Math.floor(now.getMinutes() / 10) * 10; // 10분 단위 예시
      }

      renderWheel(colDiv, def.min, def.max, initVal, def.suffix, colId);
    });

    ui.sheet.classList.add("is-active");
    ui.overlay.classList.add("is-active");
    ui.sheet.setAttribute("tabindex", "-1");
    ui.sheet.addEventListener("keydown", trapFocus);

    setTimeout(() => {
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
      state.lastFocusedElement = null;
    }
  }

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

  function renderWheel(col, min, max, current, suffix, id) {
    const ul = col.querySelector(".wheel-list");
    while (ul.firstChild) ul.removeChild(ul.firstChild);

    const fragment = document.createDocumentFragment();
    let targetItem = null;

    for (let i = min; i <= max; i++) {
      const li = document.createElement("li");
      li.className = "wheel-item";

      const displayNum = id !== "year" ? String(i).padStart(2, "0") : i;
      li.textContent = displayNum + suffix;

      li.setAttribute("data-val", i);
      li.setAttribute("role", "option");

      if (i === current) {
        li.classList.add("selected");
        li.setAttribute("aria-selected", "true");
        li.setAttribute("tabindex", "0");
        targetItem = li;
      } else {
        li.setAttribute("tabindex", "-1");
      }

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

    if (targetItem) {
      setTimeout(() => {
        targetItem.scrollIntoView({ block: "center", behavior: "auto" });
        update3D(col);
      }, 0);
    }
  }

  function update3D(col) {
    if (col.dataset.isTicking === "true") return;
    col.dataset.isTicking = "true";

    requestAnimationFrame(() => {
      const items = col.querySelectorAll(".wheel-item");
      const center = col.scrollTop + col.offsetHeight / 2;

      items.forEach((item) => {
        const itemCenter = item.offsetTop + item.offsetHeight / 2;
        const dist = Math.abs(center - itemCenter);

        if (dist < 20) {
          item.classList.add("selected");
          item.setAttribute("aria-selected", "true");
          item.setAttribute("tabindex", "0");
        } else {
          item.classList.remove("selected");
          item.setAttribute("aria-selected", "false");
          item.setAttribute("tabindex", "-1");
        }

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
      col.dataset.isTicking = "false";
    });
  }

  async function onScrollEnd(activeCol) {
    const vals = {};
    state.activeColumns.forEach((colId) => {
      if (ui.colMap[colId]) vals[colId] = getWheelValue(ui.colMap[colId]);
    });

    const activeValue = getWheelValue(activeCol);
    if (activeValue) {
      // 어느 휠이 선택되었는지 찾아서 안내
      const activeId = Object.keys(ui.colMap).find((key) => ui.colMap[key] === activeCol);
      const def = CONFIG.WHEEL_DEFS[activeId];
      if (def) speak(`${activeValue}${def.suffix}이 선택되었습니다.`);
    }

    // 연/월이 모두 활성화되어 있고, 일 단위가 존재할 때만 최대 일수 계산
    if (CONFIG.autoDayAdjust && vals.year && vals.month && ui.colMap.day && activeCol !== ui.colMap.day) {
      const maxDay = new Date(vals.year, vals.month, 0).getDate();
      const dayCol = ui.colMap.day;
      if (dayCol && maxDay !== dayCol.querySelectorAll("li").length) {
        renderWheel(dayCol, 1, maxDay, vals.day > maxDay ? maxDay : vals.day, "일", "day");
      }
    }
  }

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
    return closest ? parseInt(closest.getAttribute("data-val")) : null;
  }

  // 5. [수정됨] 활성화된 컬럼 조합에 맞춰 동적으로 결과 텍스트 생성
  function confirmSelection() {
    let formattedStr = "";
    const vals = {};

    // 활성화된 휠들의 값을 추출하여 문자열로 조합
    state.activeColumns.forEach((colId) => {
      const val = getWheelValue(ui.colMap[colId]);
      vals[colId] = val;
      const def = CONFIG.WHEEL_DEFS[colId];

      if (val !== null) {
        const displayVal = colId === "year" ? val : String(val).padStart(2, "0");
        formattedStr += `${displayVal}${def.suffix} `;
      }
    });

    // 연/월/일이 모두 있다면 요일 정보 추가
    if (vals.year && vals.month && vals.day) {
      const dateObj = new Date(vals.year, vals.month - 1, vals.day);
      const { sun, mon, tue, wed, thu, fri, sat } = CONFIG.locale;
      const dayMap = [sun, mon, tue, wed, thu, fri, sat];
      formattedStr += `(${dayMap[dateObj.getDay()]}) `;
    }

    state.activeInput.value = formattedStr.trim();
    closeSheet();
  }

  function validateInput(input) {
    // 동적인 포맷을 처리하기 복잡하므로, 일단 비워두거나 단순 포맷팅으로 유지
    // 필요에 따라 이 부분의 정규식 처리를 보강할 수 있습니다.
  }

  setup();
}
