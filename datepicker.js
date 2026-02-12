document.addEventListener("DOMContentLoaded", () => {
  const ENABLE_MANUAL_EDIT = true;

  // 상수 설정
  const ITEM_HEIGHT = 40;
  const CONTAINER_HEIGHT = 220;

  const wrappers = document.querySelectorAll(".picker-wrapper");
  const overlay = document.querySelector(".picker-overlay");
  const sheet = document.querySelector(".bottom-sheet");
  const btnDone = document.querySelector(".btn-done");
  const btnClose = document.querySelector(".btn-close");

  const colYear = document.querySelector(".year-col");
  const colMonth = document.querySelector(".month-col");
  const colDay = document.querySelector(".day-col");

  let activeInput = null;

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => currentYear - 50 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  // --- 이벤트 바인딩 ---
  wrappers.forEach((wrapper) => {
    const input = wrapper.querySelector(".picker-input");
    const iconBtn = wrapper.querySelector(".picker-icon-btn");

    if (ENABLE_MANUAL_EDIT) {
      input.removeAttribute("readonly");
      input.addEventListener("blur", () => handleInputBlur(input));
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") input.blur();
      });
      input.addEventListener("input", () => clearError(input));

      iconBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        clearError(input);
        activeInput = input;
        openSheetWithSync(input.value);
      });
    } else {
      input.setAttribute("readonly", true);
      wrapper.addEventListener("click", () => {
        activeInput = input;
        openSheetWithSync(input.value);
      });
    }
  });

  // --- 유효성 검사 ---
  function handleInputBlur(input) {
    const val = input.value.trim();
    if (!val) {
      clearError(input);
      return;
    }

    const nums = val.replace(/[^0-9]/g, "");
    let y, m, d;
    let isValid = false;

    if (nums.length === 8) {
      y = parseInt(nums.substring(0, 4));
      m = parseInt(nums.substring(4, 6));
      d = parseInt(nums.substring(6, 8));
    } else if (nums.length === 6) {
      y = 2000 + parseInt(nums.substring(0, 2));
      m = parseInt(nums.substring(2, 4));
      d = parseInt(nums.substring(4, 6));
    } else if (val.includes("-") || val.includes(".") || val.includes("/")) {
      const parts = val.split(/[-./]/);
      if (parts.length === 3) {
        y = parseInt(parts[0]);
        m = parseInt(parts[1]);
        d = parseInt(parts[2]);
        if (y < 100) y += 2000;
      }
    }

    if (isValidDate(y, m, d)) isValid = true;

    if (isValid) {
      const dayOfWeek = getDayOfWeek(y, m, d);
      input.value = `${y}년 ${String(m).padStart(2, "0")}월 ${String(d).padStart(2, "0")}일 ${dayOfWeek}`;
      clearError(input);
    } else {
      showError(input);
    }
  }

  function showError(input) {
    const group = input.closest(".input-group");
    const wrapper = group.querySelector(".picker-wrapper");
    const errorText = group.querySelector(".error-text");
    wrapper.classList.add("input-error");
    errorText.classList.add("show");
  }

  function clearError(input) {
    const group = input.closest(".input-group");
    const wrapper = group.querySelector(".picker-wrapper");
    const errorText = group.querySelector(".error-text");
    wrapper.classList.remove("input-error");
    errorText.classList.remove("show");
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

  // --- 바텀 시트 열기 ---
  function openSheetWithSync(dateString) {
    const now = new Date();
    let targetY = now.getFullYear();
    let targetM = now.getMonth() + 1;
    let targetD = now.getDate();

    if (dateString) {
      const numbers = dateString.match(/\d+/g);
      if (numbers && numbers.length >= 3) {
        targetY = parseInt(numbers[0]);
        targetM = parseInt(numbers[1]);
        targetD = parseInt(numbers[2]);
      }
    }

    initWheel(colYear, years, "년", targetY);
    initWheel(colMonth, months, "월", targetM);
    initWheel(colDay, days, "일", targetD);

    overlay.classList.add("is-active");
    sheet.classList.add("is-active");
  }

  btnDone.addEventListener("click", () => {
    if (!activeInput) return;
    const y = getSelectedValue(colYear);
    const m = getSelectedValue(colMonth);
    const d = getSelectedValue(colDay);

    if (y && m && d) {
      const dayOfWeek = getDayOfWeek(y, m, d);
      activeInput.value = `${y}년 ${String(m).padStart(2, "0")}월 ${String(d).padStart(2, "0")}일 ${dayOfWeek}`;
      clearError(activeInput);
    }
    closeSheet();
  });

  function closeSheet() {
    overlay.classList.remove("is-active");
    sheet.classList.remove("is-active");
  }
  btnClose.addEventListener("click", closeSheet);
  overlay.addEventListener("click", closeSheet);

  // --- [최적화] 휠 초기화 및 3D 로직 ---
  function initWheel(colElement, dataArray, label, initialValue) {
    const ul = colElement.querySelector(".wheel-list");
    ul.innerHTML = "";

    // 1. 패딩 계산
    const padding = (CONTAINER_HEIGHT - ITEM_HEIGHT) / 2;
    ul.style.paddingTop = `${padding}px`;
    ul.style.paddingBottom = `${padding}px`;

    // 2. 아이템 생성
    let initialIndex = 0;
    dataArray.forEach((val, index) => {
      const li = document.createElement("li");
      li.className = "wheel-item";
      li.textContent = `${val}${label}`;
      li.dataset.val = val;
      // li.dataset.index = index; // 불필요시 제거
      ul.appendChild(li);

      if (val == initialValue) initialIndex = index;
    });

    // 3. [핵심 최적화] 아이템 리스트를 미리 캐싱 (스크롤할 때마다 querySelector 안 쓰기 위함)
    const cachedItems = Array.from(ul.children);

    // 4. 초기 스크롤 및 이벤트 바인딩
    setTimeout(() => {
      colElement.scrollTop = initialIndex * ITEM_HEIGHT;
      // 초기 1회 실행
      requestAnimationFrame(() => update3D(colElement, cachedItems));
    }, 0);

    // 스크롤 이벤트에 캐싱된 items 전달
    colElement.onscroll = () => {
      requestAnimationFrame(() => update3D(colElement, cachedItems));
    };
  }

  function update3D(colElement, items) {
    const center = colElement.scrollTop + colElement.clientHeight / 2;

    // [최적화] items는 파라미터로 받아서 사용 (querySelectorAll 제거)
    // 화면에 보일 수 있는 범위 (위아래 여유 포함)
    const VISIBLE_RANGE = 150;

    items.forEach((item) => {
      // offsetTop은 비용이 들지만 캐싱하기엔 복잡하므로 유지하되, 계산 최소화
      const itemCenter = item.offsetTop + ITEM_HEIGHT / 2;
      const dist = center - itemCenter;
      const absDist = Math.abs(dist);

      // [핵심 최적화] 화면 밖으로 벗어난 아이템은 연산 건너뛰기
      if (absDist > VISIBLE_RANGE) {
        // 이미 스타일이 초기화된 상태라면 건너뜀 (성능 향상)
        if (item.style.transform !== "") {
          item.style.transform = "";
          item.style.opacity = "0.3"; // 기본값
          item.classList.remove("selected");
        }
        return;
      }

      // --- 보이는 아이템만 3D 계산 ---
      const angle = Math.max(Math.min(dist / 5, 60), -60);
      const opacity = Math.max(1 - Math.pow(absDist / 150, 2), 0.1);
      const offset = -Math.pow(absDist / 10, 1.5);

      item.style.setProperty("--angle", -angle);
      item.style.setProperty("--opacity", opacity);
      item.style.setProperty("--offset", offset);

      if (absDist < ITEM_HEIGHT / 2 + 1) {
        item.classList.add("selected");
      } else {
        item.classList.remove("selected");
      }
    });
  }

  function getSelectedValue(colElement) {
    const selected = colElement.querySelector(".selected");
    return selected ? parseInt(selected.dataset.val) : null;
  }

  function getDayOfWeek(y, m, d) {
    const week = ["일", "월", "화", "수", "목", "금", "토"];
    const date = new Date(y, m - 1, d);
    return week[date.getDay()] + "요일";
  }
});
