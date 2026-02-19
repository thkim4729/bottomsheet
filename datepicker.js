/**
 * [Library] Ultimate Date Picker (A11y & Performance Optimized)
 * 이 코드는 'date_picker' 클래스를 가진 모든 HTML 요소를 자동으로 찾아서 기능을 부여합니다.
 */
document.addEventListener("DOMContentLoaded", initDatePicker);

function initDatePicker() {
  // ============================================================
  // 1. [핵심 설정] 기능의 On/Off를 결정하는 구간
  // ============================================================
  const CONFIG = {
    // 선택 가능한 연도의 범위를 결정합니다.
    minYear: new Date().getFullYear() - 50,
    maxYear: new Date().getFullYear() + 50,

    /**
     * [blockWeekends] 주말 선택 차단 여부
     * - true: 토요일과 일요일을 선택하고 '완료'를 누르면 에러 메시지가 뜨며 입력되지 않습니다.
     * - false: 주말을 포함한 모든 요일을 자유롭게 선택할 수 있습니다. (기본값)
     */
    blockWeekends: false,

    /**
     * [blockHolidays] 공휴일 선택 차단 여부
     * - true: 신정, 설날, 추석 등 지정된 공휴일을 선택하면 에러가 발생합니다.
     * - false: 빨간날 상관없이 모든 날짜를 선택할 수 있습니다. (기본값)
     */
    blockHolidays: false,

    /**
     * [autoDayAdjust] 월별 일수 자동 조정 (매우 중요)
     * - true: 1월(31일)에서 2월로 휠을 돌리면, 일(Day) 항목이 자동으로 28일 또는 29일로 줄어듭니다.
     * - false: 모든 달이 무조건 31일까지 표시됩니다. (존재하지 않는 2월 30일 같은 날짜가 선택될 위험이 있음)
     */
    autoDayAdjust: true,

    /**
     * [enterToSelect] 키보드 Enter 키로 선택 완료
     * - true: 휠(연, 월, 일)에 포커스가 있는 상태에서 Enter를 누르면 '완료' 버튼을 클릭한 것과 동일하게 작동합니다.
     * - false: Enter를 눌러도 아무 반응이 없으며, 반드시 Tab을 눌러 '완료' 버튼까지 가서 Enter를 쳐야 합니다.
     */
    enterToSelect: true,

    // 화면에 표시될 단위 텍스트입니다.
    locale: { year: "년", month: "월", day: "일" },
  };

  // [내부 상태 데이터] 사용자가 직접 수정할 필요는 없지만 로직 유지에 필수적입니다.
  const state = {
    activeInput: null, // 현재 날짜를 입력받고 있는 실제 input창
    holidayCache: {}, // 이미 불러온 연도의 공휴일 정보를 저장해 재호출 방지 (성능 최적화)
    scrollTimer: null, // 스크롤이 완전히 멈췄는지 감지하는 타이머
    lastFocusedElement: null, // 바텀시트를 열기 직전, 사용자가 머물렀던 위치 (닫을 때 돌아갈 곳)
  };

  // [UI 참조] HTML 요소를 자바스크립트 변수로 연결해두는 곳입니다.
  const ui = {
    sheet: null, // 바텀 시트 본체
    overlay: null, // 시트 뒤쪽의 어두운 배경
    btnDone: null, // '완료' 버튼
    cols: { year: null, month: null, day: null }, // 연/월/일 스크롤 컬럼들
  };

  // ============================================================
  // 2. 초기 구동 함수 (setup)
  // ============================================================
  function setup() {
    cacheUI(); // 화면상의 요소들을 변수에 저장

    // 페이지 전체에서 .date_picker 클래스를 가진 모든 요소를 찾습니다.
    document.querySelectorAll(".date_picker").forEach((container) => {
      // 해당 컨테이너 안에 있는 모든 입력창(인풋 1개 혹은 2개)을 찾습니다.
      container.querySelectorAll(".picker-wrapper").forEach((wrapper) => {
        const input = wrapper.querySelector(".picker-input");
        const iconBtn = wrapper.querySelector(".picker-icon-btn");

        if (!input) return;

        // input의 '읽기전용' 상태를 해제하여 키보드로 직접 입력도 가능하게 만듭니다.
        input.removeAttribute("readonly");

        // [입력창 이벤트 관리]
        // 1. 입력을 마치고 다른 곳을 클릭(blur)하면 날짜가 유효한지 검사합니다.
        input.addEventListener("blur", () => validateInput(input));
        // 2. 입력창에서 Enter를 치면 자동으로 검사가 실행되도록 합니다.
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") input.blur();
        });
        // 3. 사용자가 오타를 고치기 위해 다시 타이핑을 시작하면 빨간색 에러 표시를 지워줍니다.
        input.addEventListener("input", () => clearError(container));

        // [열기 트리거]
        // 달력 아이콘 버튼이 있으면 버튼에, 없으면 입력창 박스 전체에 클릭 이벤트를 겁니다.
        const trigger = iconBtn || wrapper;
        trigger.addEventListener("click", (e) => {
          e.stopPropagation(); // 부모로 클릭 이벤트가 퍼지는 것을 방지
          openSheet(input, container); // 바텀 시트 열기
        });
      });
    });
  }

  // 화면의 요소를 자바스크립트가 조작하기 쉽게 변수에 담고 초기 접근성 설정을 합니다.
  function cacheUI() {
    if (ui.sheet) return; // 이미 실행됐다면 중복 실행 방지

    ui.overlay = document.querySelector(".picker-overlay");
    ui.sheet = document.querySelector(".bottom-sheet");
    ui.btnDone = document.querySelector(".btn-done");
    ui.cols.year = document.querySelector(".year-col");
    ui.cols.month = document.querySelector(".month-col");
    ui.cols.day = document.querySelector(".day-col");

    // [접근성] 휠 컬럼들에 키보드 포커스가 갈 수 있게 tabindex를 주고, 스크린리더 안내 메시지를 넣습니다.
    const labels = [
      "연도를 선택해주세요",
      "월을 선택해주세요",
      "일을 선택해주세요",
    ];
    [ui.cols.year, ui.cols.month, ui.cols.day].forEach((col, i) => {
      if (col) {
        col.setAttribute("tabindex", "0"); // 키보드 탭 키로 접근 가능하게 설정
        col.setAttribute("role", "listbox"); // 스크린리더가 "목록"으로 인식하게 설정
        col.setAttribute("aria-label", labels[i]);
      }
    });

    // 닫기/배경클릭/완료 버튼 이벤트 연결
    const btnClose = document.querySelector(".btn-close");
    if (btnClose) btnClose.addEventListener("click", closeSheet);
    if (ui.overlay) ui.overlay.addEventListener("click", closeSheet);
    if (ui.btnDone) ui.btnDone.addEventListener("click", confirmSelection);
  }

  // ============================================================
  // 3. 접근성 제어 (Focus Trap)
  // ============================================================
  // 바텀시트가 열려있는 동안 Tab키를 눌러도 포커스가 시트 밖(뒷배경)으로 나가지 않게 가두는 로직입니다.
  function trapFocus(e) {
    if (e.key !== "Tab") return;

    const focusables = ui.sheet.querySelectorAll('button, [tabindex="0"]');
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (e.shiftKey) {
      // Shift + Tab (역방향 이동)
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      // Tab (정방향 이동)
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  // ============================================================
  // 4. 바텀 시트 열기 및 닫기
  // ============================================================
  async function openSheet(input, container) {
    state.lastFocusedElement = input; // 시트가 닫힌 뒤 돌아올 위치 저장
    state.activeInput = input;
    clearError(container);

    // [컬러 동기화] HTML 클래스(예: theme-orange)에 설정된 색상을 바텀시트에도 똑같이 입힙니다.
    const computedStyle = getComputedStyle(container);
    const themeColor = computedStyle.getPropertyValue("--picker-color").trim();
    if (themeColor && ui.sheet)
      ui.sheet.style.setProperty("--picker-color", themeColor);

    // 현재 입력된 값을 읽어서 휠의 초기 위치를 잡습니다. 값이 비어있으면 오늘 날짜를 기준으로 합니다.
    const d = parseDate(input.value) || {
      y: new Date().getFullYear(),
      m: new Date().getMonth() + 1,
      d: new Date().getDate(),
    };

    // 공휴일 차단 기능이 켜져있을 때만 데이터를 가져옵니다.
    if (CONFIG.blockHolidays) await loadHolidayData(d.y);

    // 실제 휠 목록을 생성하고 현재 날짜 위치로 스크롤 시킵니다.
    renderWheel(
      ui.cols.year,
      CONFIG.minYear,
      CONFIG.maxYear,
      d.y,
      CONFIG.locale.year,
    );
    renderWheel(ui.cols.month, 1, 12, d.m, CONFIG.locale.month);
    renderWheel(
      ui.cols.day,
      1,
      new Date(d.y, d.m, 0).getDate(),
      d.d,
      CONFIG.locale.day,
    );

    // 시트 표시
    ui.sheet.setAttribute("tabindex", "-1"); // 시트 자체에 포커스 가능하게 임시 설정
    ui.overlay.classList.add("is-active");
    ui.sheet.classList.add("is-active");
    ui.sheet.addEventListener("keydown", trapFocus); // 포커스 가두기 시작

    // 0.05초 뒤 시트로 포커스를 이동시켜 스크린리더가 시트가 열렸음을 알게 합니다.
    setTimeout(() => ui.sheet.focus(), 50);
  }

  function closeSheet() {
    ui.overlay.classList.remove("is-active");
    ui.sheet.classList.remove("is-active");
    ui.sheet.removeAttribute("tabindex");
    ui.sheet.removeEventListener("keydown", trapFocus);

    // 시트가 닫히면 원래 사용자가 머물렀던 input창으로 포커스를 돌려줍니다.
    if (state.lastFocusedElement) {
      state.lastFocusedElement.focus();
      state.lastFocusedElement = null;
    }
  }

  // ============================================================
  // 5. 날짜 유효성 검사 로직
  // ============================================================
  // 선택된 날짜가 차단된 날짜(주말/공휴일)인지 확인하는 함수입니다.
  function isDateBlocked(y, m, d) {
    if (!y || !m || !d) return false;
    const date = new Date(y, m - 1, d);

    // 주말 차단 (CONFIG.blockWeekends가 true일 때만 작동)
    if (CONFIG.blockWeekends && (date.getDay() === 0 || date.getDay() === 6))
      return true;

    // 공휴일 차단 (CONFIG.blockHolidays가 true일 때만 작동)
    if (CONFIG.blockHolidays) {
      const list = state.holidayCache[y];
      const mmdd = `${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      if (list && list.includes(mmdd)) return true;
    }
    return false;
  }

  // 공휴일 정보를 자바스크립트 내부 데이터로 로드합니다. (오프라인 작동 가능)
  async function loadHolidayData(year) {
    if (state.holidayCache[year]) return; // 이미 있으면 통과
    await new Promise((r) => setTimeout(r, 100)); // 통신 지연 효과 (실제 통신은 아님)

    // 여기에 빨간날 데이터를 추가하면 해당 연도의 공휴일이 차단됩니다.
    state.holidayCache[year] = [
      "01-01",
      "03-01",
      "05-05",
      "06-06",
      "08-15",
      "10-03",
      "10-09",
      "12-25",
    ];
  }

  // ============================================================
  // 6. 휠 생성 및 렌더링 (보안 강화)
  // ============================================================
  function renderWheel(col, min, max, current, label) {
    const ul = col.querySelector(".wheel-list");

    // [innerHTML 금지] 안전하게 기존 내용을 삭제합니다.
    while (ul.firstChild) ul.removeChild(ul.firstChild);

    const fragment = document.createDocumentFragment(); // 성능 향상을 위한 임시 저장소
    let targetItem = null;

    for (let i = min; i <= max; i++) {
      const li = document.createElement("li"); // 새로운 요소를 만듦
      li.className = "wheel-item";
      li.textContent = i + label; // 텍스트만 삽입 (XSS 보안)
      li.setAttribute("data-val", i);
      li.setAttribute("role", "option");

      // [편의기능] 휠 아이템을 직접 클릭해도 중앙으로 스크롤 이동하며 선택됩니다.
      li.addEventListener("click", () => {
        li.scrollIntoView({ block: "center", behavior: "smooth" });
      });

      fragment.appendChild(li);
      if (i === current) targetItem = li;
    }
    ul.appendChild(fragment);

    // 스크롤 이벤트 연결 (포커스된 컬럼에서 스크롤하면 하이라이트가 업데이트됨)
    if (!col.onscroll) {
      col.onscroll = () => {
        update3D(col); // 3D 회전 및 Selected 클래스 실시간 처리
        clearTimeout(state.scrollTimer);
        state.scrollTimer = setTimeout(onScrollEnd, 150); // 스크롤 멈추면 후처리 실행
      };
    }

    // 키보드 조작 기능 활성화
    if (!col.dataset.hasKeyboard) {
      col.addEventListener("keydown", (e) => handleWheelKeyboard(e, col));
      col.dataset.hasKeyboard = "true";
    }

    // 초기 위치 잡기: 지정된 날짜를 중앙으로 보냅니다.
    if (targetItem) {
      setTimeout(() => {
        targetItem.scrollIntoView({ block: "center" });
        update3D(col); // 처음 나타날 때의 스타일 적용
      }, 0);
    }
  }

  // 키보드 조작: 위/아래 방향키로 휠을 돌리고 Enter로 완료합니다.
  function handleWheelKeyboard(e, col) {
    const itemHeight = 40;
    if (e.key === "ArrowUp") {
      e.preventDefault();
      col.scrollBy({ top: -itemHeight, behavior: "smooth" });
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      col.scrollBy({ top: itemHeight, behavior: "smooth" });
    } else if (e.key === "Enter" && CONFIG.enterToSelect) {
      // CONFIG.enterToSelect가 true일 때만 Enter 키가 '완료' 버튼 역할을 합니다.
      e.preventDefault();
      confirmSelection();
    }
  }

  // 실시간 시각 효과: 중앙에 가까울수록 진하고 크게, 멀어질수록 투명하고 회전되게 처리합니다.
  function update3D(col) {
    const items = col.querySelectorAll(".wheel-item");
    const center = col.scrollTop + col.offsetHeight / 2;

    items.forEach((item) => {
      const itemCenter = item.offsetTop + item.offsetHeight / 2;
      const dist = Math.abs(center - itemCenter);

      if (dist < 20) {
        // 중앙 지점 20px 이내에 들어오면 '선택됨' 상태
        item.classList.add("selected");
        item.setAttribute("aria-selected", "true");
      } else {
        item.classList.remove("selected");
        item.setAttribute("aria-selected", "false");
      }

      // 3D 입체 효과 계산 (중앙에서 멀어질수록 굴곡을 줌)
      if (dist <= 150) {
        const angle = Math.max(Math.min((center - itemCenter) / 5, 50), -50);
        item.style.transform = `rotateX(${-angle}deg)`;
        item.style.opacity = Math.max(1 - Math.pow(dist / 150, 2), 0.3);
      }
    });
  }

  // 스크롤이 멈췄을 때 실행: 일수 자동 조정 및 공휴일 데이터 로드
  async function onScrollEnd() {
    const y = getWheelValue(ui.cols.year);
    const m = getWheelValue(ui.cols.month);
    const d = getWheelValue(ui.cols.day);

    // 연도를 돌리다가 새로운 연도가 나오면 공휴일 데이터를 새로 로드합니다.
    if (CONFIG.blockHolidays && y) await loadHolidayData(y);

    // [CONFIG.autoDayAdjust] 기능: 월을 바꿨을 때 일(Day) 휠을 다시 계산합니다.
    if (CONFIG.autoDayAdjust && y && m) {
      const max = new Date(y, m, 0).getDate(); // 해당 월의 실제 마지막 날(28, 30, 31) 계산
      if (max !== ui.cols.day.querySelectorAll("li").length) {
        // 현재 선택된 날짜가 새 월의 마지막 날보다 크면(예: 31일인데 2월로 이동) 마지막 날로 맞춥니다.
        renderWheel(ui.cols.day, 1, max, d > max ? max : d, CONFIG.locale.day);
      }
    }
  }

  // ============================================================
  // 7. 유틸리티 함수 (Helpful functions)
  // ============================================================

  // 현재 휠의 중앙에 가장 가깝게 멈춘 아이템의 값을 찾아옵니다.
  function getWheelValue(col) {
    const center = col.scrollTop + col.offsetHeight / 2;
    let closest = null;
    let minDist = Infinity;
    col.querySelectorAll(".wheel-item").forEach((item) => {
      const dist = Math.abs(center - (item.offsetTop + item.offsetHeight / 2));
      if (dist < minDist) {
        minDist = dist;
        closest = item;
      }
    });
    return closest ? parseInt(closest.getAttribute("data-val")) : null;
  }

  // 텍스트(예: 2025년 05월 10일)를 분석해서 숫자만 뽑아 날짜 객체로 변환합니다.
  function parseDate(str) {
    const nums = str.replace(/[^0-9]/g, "");
    if (nums.length === 8)
      return {
        y: +nums.substr(0, 4),
        m: +nums.substr(4, 2),
        d: +nums.substr(6, 2),
      };
    return null;
  }

  // 인풋창에 직접 입력한 날짜가 유효하고 차단되지 않았는지 확인합니다.
  function validateInput(input) {
    const d = parseDate(input.value);
    const container = input.closest(".input-group");
    if (d && !isDateBlocked(d.y, d.m, d.d)) {
      // 유효하다면 표준 포맷으로 깔끔하게 바꿔줍니다.
      input.value = `${d.y}년 ${String(d.m).padStart(2, "0")}월 ${String(d.d).padStart(2, "0")}일`;
      clearError(container);
    } else if (input.value.trim() !== "") {
      // 유효하지 않거나 차단된 날짜라면 에러 표시를 합니다.
      showError(container);
    }
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

  // [최종 실행] 위에서 정의한 셋업 함수를 실행하여 시스템을 가동합니다.
  setup();
}
