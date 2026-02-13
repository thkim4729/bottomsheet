document.addEventListener("DOMContentLoaded", () => {
  // [설정] true일 경우 입력창 타이핑 허용, false면 클릭만 허용(readonly)
  const ENABLE_MANUAL_EDIT = true;

  // [중요 상수] CSS와 값이 일치해야 계산 오차가 발생하지 않음
  const ITEM_HEIGHT = 40; // 아이템 하나 높이 (px)
  const CONTAINER_HEIGHT = 220; // 휠 전체 높이 (px)

  // DOM 요소 선택
  const wrappers = document.querySelectorAll(".picker-wrapper");
  const overlay = document.querySelector(".picker-overlay");
  const sheet = document.querySelector(".bottom-sheet");
  const btnDone = document.querySelector(".btn-done");
  const btnClose = document.querySelector(".btn-close");

  // 휠 컬럼 요소
  const colYear = document.querySelector(".year-col");
  const colMonth = document.querySelector(".month-col");
  const colDay = document.querySelector(".day-col");

  // 현재 활성화된 Input을 추적하기 위한 변수
  let activeInput = null;

  // 날짜 데이터 생성 (현재 년도 기준 전후 100년)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => currentYear - 50 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  // ==========================================
  // 1. 이벤트 리스너 등록 (입력창 초기화)
  // ==========================================
  wrappers.forEach((wrapper) => {
    const input = wrapper.querySelector(".picker-input");
    const iconBtn = wrapper.querySelector(".picker-icon-btn");

    if (ENABLE_MANUAL_EDIT) {
      // [모드 1] 직접 입력 허용
      input.removeAttribute("readonly");

      // Blur 이벤트: 입력창에서 포커스가 나갈 때 유효성 검사 수행
      input.addEventListener("blur", () => handleInputBlur(input));

      // Enter 키: 입력 완료로 간주하고 Blur 강제 실행
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") input.blur();
      });

      // Input 이벤트: 타이핑 중에는 에러 메시지 제거 (UX 향상)
      input.addEventListener("input", () => clearError(input));

      // 아이콘 클릭: 에러 제거 후 바텀 시트 열기
      iconBtn.addEventListener("click", (e) => {
        e.stopPropagation(); // 부모 요소 클릭 이벤트 방지
        clearError(input);
        activeInput = input;
        openSheetWithSync(input.value); // 현재 입력된 값으로 휠 맞춤
      });
    } else {
      // [모드 2] 읽기 전용 (클릭 시 무조건 시트 열림)
      input.setAttribute("readonly", true);
      wrapper.addEventListener("click", () => {
        activeInput = input;
        openSheetWithSync(input.value);
      });
    }
  });

  // ==========================================
  // 2. 유효성 검사 및 에러 처리 (Validation)
  // ==========================================
  function handleInputBlur(input) {
    const val = input.value.trim();

    // 빈 값인 경우 에러 없이 종료 (선택 취소로 간주)
    if (!val) {
      clearError(input);
      return;
    }

    // 숫자만 추출 (예: 2024.05.20 -> 20240520)
    const nums = val.replace(/[^0-9]/g, "");
    let y, m, d;
    let isValid = false;

    // 다양한 입력 패턴 파싱
    if (nums.length === 8) {
      // 8자리: 20240520
      y = parseInt(nums.substring(0, 4));
      m = parseInt(nums.substring(4, 6));
      d = parseInt(nums.substring(6, 8));
    } else if (nums.length === 6) {
      // 6자리: 240520 -> 2000년대 가정
      y = 2000 + parseInt(nums.substring(0, 2));
      m = parseInt(nums.substring(2, 4));
      d = parseInt(nums.substring(4, 6));
    } else if (val.includes("-") || val.includes(".") || val.includes("/")) {
      // 구분자 사용: 2024-5-20
      const parts = val.split(/[-./]/);
      if (parts.length === 3) {
        y = parseInt(parts[0]);
        m = parseInt(parts[1]);
        d = parseInt(parts[2]);
        if (y < 100) y += 2000; // 2자리 년도 처리
      }
    }

    // 날짜 유효성 체크 (예: 2월 30일 방지)
    if (isValidDate(y, m, d)) isValid = true;

    if (isValid) {
      // 성공: 포맷팅(년 월 일 요일) 적용 후 에러 제거
      const dayOfWeek = getDayOfWeek(y, m, d);
      input.value = `${y}년 ${String(m).padStart(2, "0")}월 ${String(d).padStart(2, "0")}일 ${dayOfWeek}`;
      clearError(input);
    } else {
      // 실패: 에러 메시지 표시
      showError(input);
    }
  }

  // 에러 표시 (빨간 테두리 + 메시지)
  function showError(input) {
    const group = input.closest(".input-group"); // 부모 그룹 찾기
    const wrapper = group.querySelector(".picker-wrapper");
    const errorText = group.querySelector(".error-text");
    wrapper.classList.add("input-error");
    errorText.classList.add("show");
  }

  // 에러 제거
  function clearError(input) {
    const group = input.closest(".input-group");
    const wrapper = group.querySelector(".picker-wrapper");
    const errorText = group.querySelector(".error-text");
    wrapper.classList.remove("input-error");
    errorText.classList.remove("show");
  }

  // 실제 존재하는 날짜인지 검사하는 헬퍼 함수
  function isValidDate(y, m, d) {
    if (!y || !m || !d) return false;
    const date = new Date(y, m - 1, d);
    // JS Date 객체는 2월 30일을 3월 2일로 자동보정함.
    // 따라서 입력값과 생성된 Date값이 일치하는지 확인해야 함.
    return (
      date.getFullYear() === y &&
      date.getMonth() + 1 === m &&
      date.getDate() === d
    );
  }

  // ==========================================
  // 3. 바텀 시트 열기 (데이터 동기화)
  // ==========================================
  function openSheetWithSync(dateString) {
    const now = new Date();
    let targetY = now.getFullYear();
    let targetM = now.getMonth() + 1;
    let targetD = now.getDate();

    // 입력창에 값이 있다면 숫자를 추출해서 휠의 초기값으로 설정
    if (dateString) {
      const numbers = dateString.match(/\d+/g);
      if (numbers && numbers.length >= 3) {
        targetY = parseInt(numbers[0]);
        targetM = parseInt(numbers[1]);
        targetD = parseInt(numbers[2]);
      }
    }

    // 3개의 휠(년, 월, 일) 초기화
    initWheel(colYear, years, "년", targetY);
    initWheel(colMonth, months, "월", targetM);
    initWheel(colDay, days, "일", targetD);

    // 시트 표시 (CSS transition으로 애니메이션 됨)
    overlay.classList.add("is-active");
    sheet.classList.add("is-active");
  }

  // ==========================================
  // 4. 완료 / 닫기 버튼 이벤트
  // ==========================================
  btnDone.addEventListener("click", () => {
    if (!activeInput) return;

    // 현재 선택된 값 가져오기
    const y = getSelectedValue(colYear);
    const m = getSelectedValue(colMonth);
    const d = getSelectedValue(colDay);

    if (y && m && d) {
      const dayOfWeek = getDayOfWeek(y, m, d);
      activeInput.value = `${y}년 ${String(m).padStart(2, "0")}월 ${String(d).padStart(2, "0")}일 ${dayOfWeek}`;
      clearError(activeInput); // 올바른 값을 선택했으므로 에러 제거
    }
    closeSheet();
  });

  function closeSheet() {
    overlay.classList.remove("is-active");
    sheet.classList.remove("is-active");
  }
  btnClose.addEventListener("click", closeSheet);
  overlay.addEventListener("click", closeSheet);

  // ==========================================
  // 5. [핵심] 휠 초기화 및 3D 렌더링 (최적화 적용)
  // ==========================================
  function initWheel(colElement, dataArray, label, initialValue) {
    const ul = colElement.querySelector(".wheel-list");
    ul.innerHTML = ""; // 기존 리스트 초기화

    // 정확한 중앙 정렬을 위한 패딩 계산
    // (컨테이너 220px - 아이템 40px) / 2 = 90px
    const padding = (CONTAINER_HEIGHT - ITEM_HEIGHT) / 2;
    ul.style.paddingTop = `${padding}px`;
    ul.style.paddingBottom = `${padding}px`;

    // 아이템 생성 및 초기 위치 인덱스 찾기
    let initialIndex = 0;
    dataArray.forEach((val, index) => {
      const li = document.createElement("li");
      li.className = "wheel-item";
      li.textContent = `${val}${label}`;
      li.dataset.val = val;
      ul.appendChild(li);

      if (val == initialValue) initialIndex = index;
    });

    // [성능 최적화 1] DOM 탐색 비용을 줄이기 위해 자식 요소를 미리 배열로 저장(캐싱)
    const cachedItems = Array.from(ul.children);

    // 초기 스크롤 위치 이동
    setTimeout(() => {
      // scrollTop을 인덱스 * 높이로 설정하면 정확한 위치로 이동함
      colElement.scrollTop = initialIndex * ITEM_HEIGHT;
      // 최초 1회 3D 효과 적용
      requestAnimationFrame(() => update3D(colElement, cachedItems));
    }, 0);

    // 스크롤 이벤트 등록 (requestAnimationFrame으로 부드럽게)
    colElement.onscroll = () => {
      requestAnimationFrame(() => update3D(colElement, cachedItems));
    };
  }

  // 3D 회전 효과 계산 함수
  function update3D(colElement, items) {
    const center = colElement.scrollTop + colElement.clientHeight / 2;

    // [성능 최적화 2] 화면에 보이는 범위(약 150px) 밖의 아이템은 연산하지 않음
    const VISIBLE_RANGE = 150;

    items.forEach((item) => {
      // offsetTop 계산
      const itemCenter = item.offsetTop + ITEM_HEIGHT / 2;
      const dist = center - itemCenter; // 화면 중앙과의 거리
      const absDist = Math.abs(dist);

      // 화면 밖 아이템은 스타일 초기화 후 연산 중단 (성능 향상 핵심)
      if (absDist > VISIBLE_RANGE) {
        if (item.style.transform !== "") {
          item.style.transform = "";
          item.style.opacity = "0.3";
          item.classList.remove("selected");
        }
        return;
      }

      // --- 3D 수학 연산 (보이는 아이템만) ---

      // 1. 각도: 거리에 따라 회전 (최대 60도 제한)
      const angle = Math.max(Math.min(dist / 5, 60), -60);

      // 2. 투명도: 멀어질수록 투명해짐 (pow 함수로 급격하게 변하도록)
      const opacity = Math.max(1 - Math.pow(absDist / 150, 2), 0.1);

      // 3. 깊이(Z축): 멀어질수록 뒤로 들어감 (원통 형태 구현)
      const offset = -Math.pow(absDist / 10, 1.5);

      // CSS 변수에 값 적용
      item.style.setProperty("--angle", -angle);
      item.style.setProperty("--opacity", opacity);
      item.style.setProperty("--offset", offset);

      // 중앙 선택 하이라이트 (오차범위 1px 허용)
      if (absDist < ITEM_HEIGHT / 2 + 1) {
        item.classList.add("selected");
      } else {
        item.classList.remove("selected");
      }
    });
  }

  // 현재 선택된 값(중앙에 있는 값) 가져오기
  function getSelectedValue(colElement) {
    const selected = colElement.querySelector(".selected");
    return selected ? parseInt(selected.dataset.val) : null;
  }

  // 요일 계산 헬퍼
  function getDayOfWeek(y, m, d) {
    const week = ["일", "월", "화", "수", "목", "금", "토"];
    const date = new Date(y, m - 1, d);
    return week[date.getDay()] + "요일";
  }
});
