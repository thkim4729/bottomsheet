document.addEventListener("DOMContentLoaded", initDatePicker);

function initDatePicker() {
  const currentYear = new Date().getFullYear();

  const CONFIG = {
    manualInput: true,
    autoDayAdjust: true,
    locale: ["일", "월", "화", "수", "목", "금", "토"],
    WHEEL_DEFS: {
      year: { min: currentYear - 50, max: currentYear + 10, suffix: "년", label: "연도" },
      month: { min: 1, max: 12, suffix: "월", label: "월" },
      day: { min: 1, max: 31, suffix: "일", label: "일" },
      hour: { min: 0, max: 23, suffix: "시", label: "시간" },
      minute: { min: 0, max: 59, suffix: "분", label: "분" },
    },
  };

  const state = {
    activeInput: null,
    activeColumns: [],
    activeFormat: "",
    scrollTimer: null,
    lastFocusedElement: null,
  };

  const ui = {
    sheet: null,
    overlay: null,
    btnDone: null,
    btnClose: null,
    pickerArea: null,
    colMap: {},
  };

  function setup() {
    cacheUI();
    bindInputEvents();
    bindSheetEvents();
  }

  function cacheUI() {
    ui.overlay = document.querySelector(".picker-overlay");
    ui.sheet = document.querySelector(".bottom-sheet");
    ui.btnDone = document.querySelector(".btn-done");
    ui.btnClose = document.querySelector(".btn-close");
    ui.pickerArea = document.querySelector(".picker-area");
  }

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

  function bindSheetEvents() {
    ui.btnClose.addEventListener("click", closeSheet);
    ui.overlay.addEventListener("click", closeSheet);
    ui.btnDone.addEventListener("click", confirmSelection);
  }

  function openSheet(input, activeColumns, formatStr) {
    state.lastFocusedElement = input;
    state.activeInput = input;
    state.activeColumns = activeColumns;
    state.activeFormat = formatStr;

    buildWheels(input.value);

    ui.sheet.classList.add("is-active");
    ui.overlay.classList.add("is-active");
    ui.sheet.setAttribute("tabindex", "-1");
    ui.sheet.addEventListener("keydown", trapFocus);

    setTimeout(() => ui.sheet.focus(), 150);
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

  function buildWheels(inputValue) {
    ui.pickerArea.innerHTML = '<div class="highlight-bar"></div>';
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

  // ⭐ [A11y 최적화] 컬럼을 '스핀버튼'으로 만들어 모바일 스와이프 조작 지원
  function createWheelColumn(colId, def) {
    const colDiv = document.createElement("div");
    colDiv.className = `wheel-col ${colId}-col`;

    // 스크린 리더용 속성 부여
    colDiv.setAttribute("role", "spinbutton");
    colDiv.setAttribute("aria-label", def.label);
    colDiv.setAttribute("aria-valuemin", def.min);
    colDiv.setAttribute("aria-valuemax", def.max);
    colDiv.setAttribute("tabindex", "0"); // 탭(또는 스와이프)으로 포커스 가능하도록 설정

    // 스크린 리더가 스와이프할 때 발생하는 방향키 이벤트 대응
    colDiv.addEventListener("keydown", (e) => {
      const itemHeight = 40; // var(--item-height)
      if (e.key === "ArrowUp") {
        e.preventDefault();
        colDiv.scrollBy({ top: itemHeight, behavior: "smooth" }); // 값 증가 (아래로 스크롤)
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        colDiv.scrollBy({ top: -itemHeight, behavior: "smooth" }); // 값 감소 (위로 스크롤)
      }
    });

    const ul = document.createElement("ul");
    ul.className = "wheel-list";
    // 스크린 리더 사용자가 개별 항목(li)을 100번씩 쓸어넘기지 않도록 숨김 처리
    ul.setAttribute("aria-hidden", "true");

    colDiv.appendChild(ul);
    return colDiv;
  }

  function renderWheelItems(colDiv, min, max, current, suffix, id) {
    const ul = colDiv.querySelector(".wheel-list");
    ul.innerHTML = "";

    const fragment = document.createDocumentFragment();
    let targetItem = null;

    for (let i = min; i <= max; i++) {
      const li = document.createElement("li");
      li.className = "wheel-item";

      const displayNum = id !== "year" ? String(i).padStart(2, "0") : i;
      li.textContent = displayNum + suffix;
      li.dataset.val = i;

      if (i === current) {
        li.classList.add("selected");
        targetItem = li;

        // 초기 렌더링 시 현재 값을 스핀버튼에 알림
        colDiv.setAttribute("aria-valuenow", i);
        colDiv.setAttribute("aria-valuetext", li.textContent);
      }

      li.addEventListener("click", () => {
        li.scrollIntoView({ block: "center", behavior: "smooth" });
      });

      fragment.appendChild(li);
    }

    ul.appendChild(fragment);
    attachScrollEvent(colDiv);

    if (targetItem) {
      setTimeout(() => {
        targetItem.scrollIntoView({ block: "center", behavior: "auto" });
        update3D(colDiv);
      }, 0);
    }
  }

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

  // ⭐ [A11y 최적화] 개별 아이템의 tabindex/aria-selected는 제거됨 (스핀버튼이 역할 대행)
  function applyItemStyle(item, center, itemCenter, dist) {
    if (dist < 20) {
      if (!item.classList.contains("selected")) {
        item.classList.add("selected");
      }
    } else {
      if (item.classList.contains("selected")) {
        item.classList.remove("selected");
      }
    }

    if (dist <= 250) {
      const angle = Math.max(Math.min((center - itemCenter) / 5, 50), -50);
      item.style.transform = `rotateX(${-angle}deg) translateZ(0)`;
      item.style.opacity = Math.max(1 - Math.pow(dist / 250, 2), 0.1);
    } else {
      if (item.style.opacity !== "0") {
        item.style.opacity = "0";
      }
    }
  }

  function handleScrollEnd(activeCol) {
    const activeValue = getWheelValue(activeCol);
    if (activeValue !== null) {
      const activeId = Object.keys(ui.colMap).find((key) => ui.colMap[key] === activeCol);
      const def = CONFIG.WHEEL_DEFS[activeId];
      if (def) {
        // ⭐ [A11y 최적화] 스크롤이 끝날 때마다 스핀버튼의 속성을 갱신하면
        // 모바일 스크린 리더가 변경된 값(예: "2026년")을 자동으로 읽어줍니다.
        const displayNum = activeId !== "year" ? String(activeValue).padStart(2, "0") : activeValue;
        activeCol.setAttribute("aria-valuenow", activeValue);
        activeCol.setAttribute("aria-valuetext", `${displayNum}${def.suffix}`);
      }
    }

    adjustDaysInMonth(activeCol);
  }

  function adjustDaysInMonth(activeCol) {
    if (!CONFIG.autoDayAdjust) return;

    const { year, month, day } = ui.colMap;
    if (!year || !month || !day || activeCol === day) return;

    const yVal = getWheelValue(year);
    const mVal = getWheelValue(month);
    const dVal = getWheelValue(day);

    if (yVal && mVal) {
      const maxDay = new Date(yVal, mVal, 0).getDate();
      const currentItemsCount = day.querySelectorAll("li").length;

      if (maxDay !== currentItemsCount) {
        const newDay = dVal > maxDay ? maxDay : dVal;
        renderWheelItems(day, 1, maxDay, newDay, CONFIG.WHEEL_DEFS.day.suffix, "day");
      }
    }
  }

  function parseInitialValues(inputValue) {
    const nums = inputValue.match(/\d+/g) || [];
    const now = new Date();
    const values = {};
    let numIndex = 0;

    state.activeColumns.forEach((colId) => {
      if (nums[numIndex]) {
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
            values[colId] = now.getHours();
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

  function confirmSelection() {
    const vals = {};
    state.activeColumns.forEach((colId) => {
      vals[colId] = getWheelValue(ui.colMap[colId]);
    });

    state.activeInput.value = formatResult(vals, state.activeFormat);
    closeSheet();
  }

  function formatResult(vals, formatStr) {
    const now = new Date();
    const y = vals.year !== undefined ? vals.year : now.getFullYear();
    const m = vals.month !== undefined ? vals.month : now.getMonth() + 1;
    const d = vals.day !== undefined ? vals.day : now.getDate();
    const h = vals.hour !== undefined ? vals.hour : 0;
    const min = vals.minute !== undefined ? vals.minute : 0;

    const dateObj = new Date(y, m - 1, d);
    const isPM = h >= 12;
    const h12 = h % 12 || 12;

    const map = {
      YYYY: y,
      YY: String(y).slice(-2),
      MM: String(m).padStart(2, "0"),
      M: m,
      DD: String(d).padStart(2, "0"),
      D: d,
      dddd: CONFIG.locale[dateObj.getDay()] + "요일",
      ddd: CONFIG.locale[dateObj.getDay()],
      HH: String(h).padStart(2, "0"),
      H: h,
      hh: String(h12).padStart(2, "0"),
      h: h12,
      mm: String(min).padStart(2, "0"),
      m: min,
      A: isPM ? "오후" : "오전",
      a: isPM ? "pm" : "am",
    };

    const tokens = Object.keys(map).sort((a, b) => b.length - a.length);
    const regex = new RegExp(tokens.join("|"), "g");

    return formatStr.replace(regex, (match) => map[match]);
  }

  function trapFocus(e) {
    if (e.key !== "Tab") return;
    // 컬럼(wheel-col)에도 tabindex="0"이 부여되어 있어 자연스럽게 탭 이동이 순환됩니다.
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

  setup();
}
