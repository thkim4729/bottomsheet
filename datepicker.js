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
      ampm: { min: 0, max: 1, items: ["오전", "오후"], suffix: "", label: "오전/오후" },
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
    announcementTimer: null,
  };

  const ui = {
    sheet: null,
    overlay: null,
    btnDone: null,
    btnClose: null,
    pickerArea: null,
    liveRegion: null,
    colMap: {},
  };

  function setup() {
    cacheUI();
    setupA11y();
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

  function setupA11y() {
    const liveRegion = document.createElement("div");
    liveRegion.className = "sr-only";
    liveRegion.setAttribute("aria-live", "polite");
    liveRegion.setAttribute("aria-atomic", "true");
    document.body.appendChild(liveRegion);
    ui.liveRegion = liveRegion;
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

    if (activeColumns.includes("ampm")) {
      CONFIG.WHEEL_DEFS.hour.min = 1;
      CONFIG.WHEEL_DEFS.hour.max = 12;
    } else {
      CONFIG.WHEEL_DEFS.hour.min = 0;
      CONFIG.WHEEL_DEFS.hour.max = 23;
    }

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

  function renderWheelItems(colDiv, min, max, current, suffix, id) {
    const ul = colDiv.querySelector(".wheel-list");
    ul.innerHTML = "";

    const fragment = document.createDocumentFragment();
    let targetItem = null;

    for (let i = min; i <= max; i++) {
      const li = document.createElement("li");
      li.className = "wheel-item";

      // ⭐ 수정된 부분: 분(minute)에만 0을 채우고, 시간(hour) 등 나머지는 그대로 둡니다.
      let displayNum;
      if (id === "ampm") {
        displayNum = CONFIG.WHEEL_DEFS.ampm.items[i];
      } else if (id === "minute") {
        displayNum = String(i).padStart(2, "0"); // 분은 00, 01 표기 유지
      } else {
        displayNum = i; // 연, 월, 일, 시간은 앞의 0 제거 (1, 2, 3...)
      }

      li.textContent = displayNum + suffix;
      li.dataset.val = i;
      li.setAttribute("role", "option");
      li.setAttribute("tabindex", "0");

      if (i === current) {
        li.classList.add("selected");
        li.setAttribute("aria-selected", "true");
        targetItem = li;
      } else {
        li.setAttribute("aria-selected", "false");
      }

      li.addEventListener("click", () => li.scrollIntoView({ block: "center", behavior: "smooth" }));
      li.addEventListener("focus", () => li.scrollIntoView({ block: "center", behavior: "smooth" }));

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

  function applyItemStyle(item, center, itemCenter, dist) {
    if (dist < 20) {
      if (!item.classList.contains("selected")) {
        item.classList.add("selected");
        item.setAttribute("aria-selected", "true");
      }
    } else {
      if (item.classList.contains("selected")) {
        item.classList.remove("selected");
        item.setAttribute("aria-selected", "false");
      }
    }

    if (dist <= 250) {
      const angle = Math.max(Math.min((center - itemCenter) / 5, 50), -50);
      item.style.transform = `rotateX(${-angle}deg) translateZ(0)`;
      item.style.opacity = Math.max(1 - Math.pow(dist / 250, 2), 0.1);
    } else {
      if (item.style.opacity !== "0") item.style.opacity = "0";
    }
  }

  function handleScrollEnd(activeCol) {
    const activeValue = getWheelValue(activeCol);
    if (activeValue !== null) {
      const activeId = Object.keys(ui.colMap).find((key) => ui.colMap[key] === activeCol);
      const def = CONFIG.WHEEL_DEFS[activeId];
      if (def) {
        const textValue = activeId === "ampm" ? def.items[activeValue] : activeValue;
        speak(`${textValue}${def.suffix} 선택됨`);
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
    const isPMText = inputValue.includes("오후") || inputValue.toLowerCase().includes("pm");
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
    const min = vals.minute !== undefined ? vals.minute : 0;

    let h24 = now.getHours();
    if (vals.hour !== undefined) {
      if (vals.ampm !== undefined) {
        if (vals.ampm === 1) {
          h24 = vals.hour === 12 ? 12 : vals.hour + 12;
        } else {
          h24 = vals.hour === 12 ? 0 : vals.hour;
        }
      } else {
        h24 = vals.hour;
      }
    }

    const dateObj = new Date(y, m - 1, d);
    const isPM = h24 >= 12;
    const h12 = h24 % 12 || 12;

    const map = {
      YYYY: y,
      YY: String(y).slice(-2),
      MM: String(m).padStart(2, "0"),
      M: m,
      DD: String(d).padStart(2, "0"),
      D: d,
      dddd: CONFIG.locale[dateObj.getDay()] + "요일",
      ddd: CONFIG.locale[dateObj.getDay()],
      HH: String(h24).padStart(2, "0"),
      H: h24,
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

  function speak(msg) {
    if (state.announcementTimer) clearTimeout(state.announcementTimer);
    if (ui.liveRegion) {
      ui.liveRegion.textContent = "";
      state.announcementTimer = setTimeout(() => {
        ui.liveRegion.textContent = msg;
      }, 50);
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

  setup();
}
