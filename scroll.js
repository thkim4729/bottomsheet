document.addEventListener("DOMContentLoaded", uiInit);

function uiInit() {
  // [초기화] 옵션값을 여기서 전달합니다.
  dynamicNavigator({
    scrollToTop: false, // true: 새로고침 시 맨 위로 강제 이동
    scrollDuration: 500, // 스크롤 이동 속도 (ms)
  });
}

/**
 * [Dynamic Navigator Component]
 * - 본문의 H1, H2 태그를 감지하여 목차를 자동 생성
 * - 스크롤 위치에 따른 자동 활성화 (Scroll Spy)
 * - 헤더 및 푸터와 겹치지 않도록 위치 자동 보정
 */
function dynamicNavigator(options = {}) {
  // =================================================================
  // [1. 설정 및 상수 정의 (CONFIG)]
  // * 유지보수 시 이 부분의 셀렉터와 클래스명만 수정하면 됩니다.
  // =================================================================
  const CONFIG = {
    scrollToTop:
      typeof options.scrollToTop !== "undefined" ? options.scrollToTop : false,
    scrollDuration: options.scrollDuration || 500,

    selectors: {
      // 내비게이터 껍데기와 내부 컨테이너
      navigator: ".dynamic-navigator",
      navigatorInner: ".dynamic-navigator__inner",

      // [레이아웃 요소] 높이 계산 및 충돌 방지에 사용됨
      header: ".header_dev", // 사이트 상단 고정 헤더
      footer: ".footer_dev", // 사이트 하단 푸터
      container: ".container", // 본문과 내비게이터를 감싸는 래퍼 (레이아웃 보정용)

      // [목차 수집 대상] 본문의 제목 태그들
      sectionTitles: ".dev_contents .h1_title", // 대제목 (Depth 1)
      subTitles: ".dev_contents .h2_title", // 소제목 (Depth 2)
      desc: ".desc", // 소제목을 감싸는 부모가 있다면 명시 (탐색용)
    },

    classes: {
      active: "active-nav-item", // 활성화된 메뉴 스타일 클래스
      showScroll: "show-scrollbar", // 스크롤바 페이드 효과 클래스
    },

    offset: {
      top: 80, // (참고용) 기본 상단 여백
      scrollSpyBuffer: 20, // 스크롤 감지 시 약간의 오차를 보정하는 값
    },
  };

  const navigatorEl = document.querySelector(CONFIG.selectors.navigator);
  if (!navigatorEl) return; // 내비게이터 요소가 없으면 종료

  // =================================================================
  // [2. 안전 장치 (Defensive Coding)]
  // * 본문에 목차로 쓸 대제목(H1)이 하나도 없다면?
  // * 빈 회색 막대만 나오는 것을 방지하기 위해 숨김 처리하고 종료합니다.
  // =================================================================
  const targetTitles = document.querySelectorAll(
    CONFIG.selectors.sectionTitles
  );

  if (targetTitles.length === 0) {
    navigatorEl.style.display = "none"; // 화면에서 숨김

    // 내비게이터 자리를 비워두기 위해 CSS에서 주었던 여백(padding-right) 제거
    const container = document.querySelector(CONFIG.selectors.container);
    if (container) {
      container.style.paddingRight = "0";
    }
    return; // 스크립트 실행 중단
  }

  // 초기화 실행
  init();

  // =================================================================
  // [3. 내부 로직 함수들]
  // =================================================================

  function init() {
    // 브라우저의 스크롤 위치 복원 기능 제어
    if ("scrollRestoration" in history) {
      history.scrollRestoration = CONFIG.scrollToTop ? "manual" : "auto";
    }
    if (CONFIG.scrollToTop) {
      setTimeout(() => window.scrollTo(0, 0), 0);
    }
    buildDOM(); // DOM 생성
    bindEvents(); // 이벤트 연결
  }

  // --- [DOM 생성] HTML 구조를 만듭니다 ---
  function buildDOM() {
    const innerClass = CONFIG.selectors.navigatorInner.replace(/^\./, "");
    navigatorEl.setAttribute("role", "navigation");
    navigatorEl.setAttribute("aria-label", "문서 목차");

    const depth1Ul = document.createElement("ul");
    depth1Ul.className = "depth1";

    // 대제목(H1) 순회하며 리스트 생성
    const primaryTitles = document.querySelectorAll(
      CONFIG.selectors.sectionTitles
    );

    primaryTitles.forEach((pTitle, idx) => {
      // ID가 없으면 강제로 생성 (앵커 기능 위함)
      const pTitleId = pTitle.id || `section-title-${idx + 1}`;
      pTitle.id = pTitleId;
      pTitle.setAttribute("tabindex", "-1"); // 포커스 이동 가능하게 설정

      const li = document.createElement("li");
      li.appendChild(
        createNavButton(pTitleId, pTitle.textContent, "depth1--item")
      );

      // 소제목(H2)이 있으면 하위 리스트 생성
      const depth2Ul = buildDepth2DOM(pTitle, idx + 1);
      if (depth2Ul.querySelectorAll("li").length > 0) {
        li.appendChild(depth2Ul);
      }
      depth1Ul.appendChild(li);
    });

    // [Semantic] 의미론적으로 올바른 <nav> 태그 사용
    const inner = document.createElement("nav");
    inner.className = innerClass;
    inner.appendChild(depth1Ul);
    navigatorEl.appendChild(inner);

    attachScrollbarHandler(inner);
  }

  // --- [DOM 생성] Depth 2 (서브 메뉴) 생성 ---
  function buildDepth2DOM(currentPTitle, pIndex) {
    const ul = document.createElement("ul");
    ul.className = "depth2";

    // 슬라이딩 마커 (현재 위치 표시용 바)
    const marker = document.createElement("span");
    marker.className = "nav-marker";
    marker.setAttribute("aria-hidden", "true");
    ul.appendChild(marker);

    // 다음 대제목을 만날 때까지 형제 요소를 탐색하며 소제목 수집
    let nextNode = currentPTitle.nextElementSibling;
    let sIndex = 0;

    while (nextNode && !nextNode.matches(CONFIG.selectors.sectionTitles)) {
      let targetSTitle = null;

      // 바로 H2인 경우 or .desc 등으로 감싸진 H2인 경우 판별
      if (nextNode.matches(CONFIG.selectors.subTitles)) {
        targetSTitle = nextNode;
      } else if (nextNode.matches(CONFIG.selectors.desc)) {
        targetSTitle = nextNode.querySelector(CONFIG.selectors.subTitles);
      }

      if (targetSTitle) {
        sIndex++;
        const sTitleId = targetSTitle.id || `sub-title-${pIndex}-${sIndex}`;
        targetSTitle.id = sTitleId;
        targetSTitle.setAttribute("tabindex", "-1");

        const li = document.createElement("li");
        li.appendChild(
          createNavButton(sTitleId, targetSTitle.textContent, "depth2--item")
        );
        ul.appendChild(li);
      }
      nextNode = nextNode.nextElementSibling;
    }
    return ul;
  }

  // --- [유틸] 버튼 생성 헬퍼 ---
  function createNavButton(targetId, text, className) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = className;
    btn.textContent = text.trim();
    btn.dataset.target = targetId; // 타겟 ID 저장
    btn.addEventListener("click", handleNavClick);
    return btn;
  }

  // --- [이벤트] 메뉴 클릭 시 커스텀 스크롤 ---
  function handleNavClick(e) {
    const targetId = e.currentTarget.dataset.target;
    const targetElement = document.getElementById(targetId);

    // 헤더 높이만큼 덜 이동해야 콘텐츠가 가려지지 않음
    const header = document.querySelector(CONFIG.selectors.header);
    const headerHeight = header ? header.offsetHeight : 0;

    if (targetElement) {
      const targetY =
        targetElement.getBoundingClientRect().top +
        window.scrollY -
        headerHeight;

      smoothScrollTo(targetY, CONFIG.scrollDuration, () => {
        // 이동 후 접근성(a11y)을 위해 포커스 이동
        targetElement.focus({ preventScroll: true });
        if (document.activeElement !== targetElement) {
          targetElement.focus({ preventScroll: true });
        }
      });
    }
  }

  // --- [애니메이션] 부드러운 스크롤 (Easing 적용) ---
  function smoothScrollTo(targetPosition, duration, callback) {
    const startPosition = window.scrollY;
    const distance = targetPosition - startPosition;
    let startTime = null;

    function animation(currentTime) {
      if (startTime === null) startTime = currentTime;
      const timeElapsed = currentTime - startTime;
      const progress = Math.min(timeElapsed / duration, 1);

      // easeInOutQuad 공식
      const ease =
        progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      window.scrollTo(0, startPosition + distance * ease);

      if (timeElapsed < duration) {
        requestAnimationFrame(animation);
      } else {
        if (callback) callback();
      }
    }
    requestAnimationFrame(animation);
  }

  // --- [이벤트 바인딩] 핵심 로직 ---
  function bindEvents() {
    let isScrollingTick = false;

    window.addEventListener(
      "scroll",
      () => {
        // [성능 최적화]
        // 1. 위치 계산(푸터 충돌 등)은 즉시 실행하여 딜레이(Lag)를 없앱니다.
        updateNavigatorPosition();

        // 2. 활성 상태 변경(Scroll Spy)은 연산이 무거우므로 rAF로 최적화합니다.
        if (!isScrollingTick) {
          window.requestAnimationFrame(() => {
            updateActiveNavItem();
            isScrollingTick = false;
          });
          isScrollingTick = true;
        }
      },
      { passive: true } // 스크롤 성능 향상 옵션
    );

    const updatePos = () => {
      updateNavigatorPosition();
      updateActiveNavItem();
    };

    // 창 크기가 변할 때도 위치 재계산
    window.addEventListener("resize", updatePos);

    // 헤더 높이가 변할 수 있으므로 ResizeObserver로 감시
    const header = document.querySelector(CONFIG.selectors.header);
    if (header) {
      new ResizeObserver(updatePos).observe(header);
    }

    updatePos(); // 초기 실행
  }

  // --- [로직] 현재 보고 있는 섹션 활성화 (Scroll Spy) ---
  function updateActiveNavItem() {
    const header = document.querySelector(CONFIG.selectors.header);
    const headerHeight = header ? header.offsetHeight : 0;
    const scrollY =
      window.scrollY + headerHeight + CONFIG.offset.scrollSpyBuffer;

    // [예외 처리 1] 최상단(0)이면 첫 번째 메뉴 강제 활성화
    if (window.scrollY <= 0) {
      const firstBtn = navigatorEl.querySelector("button");
      if (firstBtn) {
        if (!firstBtn.classList.contains(CONFIG.classes.active)) {
          activateButton(firstBtn);
        }
        return;
      }
    }

    const docHeight = document.documentElement.scrollHeight;
    const winHeight = window.innerHeight;

    // [예외 처리 2] 페이지 끝에 도달하면 마지막 메뉴 강제 활성화
    if (window.scrollY + winHeight >= docHeight - 5) {
      const buttons = navigatorEl.querySelectorAll("button");
      if (buttons.length > 0) {
        const lastBtn = buttons[buttons.length - 1];
        if (!lastBtn.classList.contains(CONFIG.classes.active)) {
          activateButton(lastBtn);
        }
        return;
      }
    }

    // [기본 로직] 현재 스크롤 위치보다 위에 있는 섹션 중 가장 가까운 것 찾기 (역순 탐색)
    let currentTargetId = "";
    const sections = document.querySelectorAll(
      `${CONFIG.selectors.sectionTitles}, ${CONFIG.selectors.subTitles}`
    );
    for (let i = sections.length - 1; i >= 0; i--) {
      const section = sections[i];
      const rect = section.getBoundingClientRect();
      const absoluteTop = rect.top + window.scrollY;

      if (scrollY >= absoluteTop) {
        currentTargetId = section.id;
        break;
      }
    }

    // 활성 상태 적용
    const currentActiveBtn = navigatorEl.querySelector(
      'button[aria-current="true"]'
    );
    if (currentTargetId) {
      if (currentActiveBtn?.dataset.target !== currentTargetId) {
        const targetBtn = navigatorEl.querySelector(
          `button[data-target="${currentTargetId}"]`
        );
        if (targetBtn) {
          activateButton(targetBtn);
        }
      }
    }
  }

  // --- [UI] 버튼 활성화 및 자동 스크롤 ---
  function activateButton(targetBtn) {
    resetActiveStatus(); // 기존 활성 상태 초기화

    // 현재 버튼 활성화
    targetBtn.classList.add(CONFIG.classes.active);
    targetBtn.setAttribute("aria-current", "true");

    let elementToScroll = targetBtn; // 자동 스크롤 시킬 대상

    // CASE 1: 서브 메뉴(Depth 2)인 경우
    if (targetBtn.classList.contains("depth2--item")) {
      const parentLi = targetBtn.closest("li");
      const parentUl = parentLi.closest("ul.depth2");
      if (parentUl) {
        const grandParentLi = parentUl.closest("li");
        const depth1Btn = grandParentLi?.querySelector(".depth1--item");

        // 부모(Depth 1)도 같이 불 켜주기
        if (depth1Btn) {
          depth1Btn.classList.add(CONFIG.classes.active);
        }

        // 슬라이딩 마커 이동
        const marker = parentUl.querySelector(".nav-marker");
        if (marker) {
          const topPos = parentLi.offsetTop;
          const height = parentLi.offsetHeight;
          marker.style.top = `${topPos}px`;
          marker.style.height = `${height}px`;
          marker.style.opacity = "1";
        }

        // 스크롤 시에는 그룹 전체가 보이도록 부모 Li를 기준으로 삼음
        if (grandParentLi) {
          elementToScroll = grandParentLi;
        }
      }
    }
    // CASE 2: 메인 메뉴(Depth 1)인 경우
    else {
      const currentLi = targetBtn.closest("li");

      // 하위 메뉴가 있다면 첫 번째 것도 같이 활성화 (UX 개선)
      const childUl = currentLi.querySelector("ul.depth2");
      if (childUl) {
        const firstChildBtn = childUl.querySelector(".depth2--item");
        if (firstChildBtn) {
          firstChildBtn.classList.add(CONFIG.classes.active);

          const marker = childUl.querySelector(".nav-marker");
          const firstChildLi = firstChildBtn.closest("li");
          if (marker && firstChildLi) {
            const topPos = firstChildLi.offsetTop;
            const height = firstChildLi.offsetHeight;
            marker.style.top = `${topPos}px`;
            marker.style.height = `${height}px`;
            marker.style.opacity = "1";
          }
        }
      }

      if (currentLi) elementToScroll = currentLi;
    }

    // 내비게이터 내부에서 해당 메뉴가 보이도록 자동 스크롤 (block: 'nearest'로 흔들림 최소화)
    elementToScroll.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // --- [유틸] 활성 상태 초기화 ---
  function resetActiveStatus() {
    navigatorEl.querySelectorAll(`.${CONFIG.classes.active}`).forEach((el) => {
      el.classList.remove(CONFIG.classes.active);
      el.removeAttribute("aria-current");
    });
    navigatorEl
      .querySelectorAll(".nav-marker")
      .forEach((m) => (m.style.opacity = "0"));
  }

  // --- [레이아웃] 내비게이터 위치 및 높이 실시간 보정 ---
  function updateNavigatorPosition() {
    // 1. 헤더 높이만큼 상단 여백(top) 주기 (헤더에 가려짐 방지)
    const header = document.querySelector(CONFIG.selectors.header);
    const headerHeight = header ? header.offsetHeight : 0;

    const inner = navigatorEl.querySelector(CONFIG.selectors.navigatorInner);
    if (inner) {
      inner.style.top = `${headerHeight}px`;
    }

    // 2. 푸터 충돌 방지 (푸터가 보이면 그만큼 bottom을 들어 올림)
    const footer = document.querySelector(CONFIG.selectors.footer);
    if (footer) {
      const footerRect = footer.getBoundingClientRect();
      const winHeight = window.innerHeight;

      if (footerRect.top < winHeight) {
        const overlap = winHeight - footerRect.top; // 겹치는 높이 계산
        navigatorEl.style.bottom = `${overlap}px`;
      } else {
        navigatorEl.style.bottom = "0px";
      }
    }
  }

  // --- [UI] 스크롤 시에만 스크롤바 보이기 (Fade-out) ---
  function attachScrollbarHandler(innerEl) {
    let timer = null;
    innerEl.addEventListener(
      "scroll",
      () => {
        innerEl.classList.add(CONFIG.classes.showScroll);
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          innerEl.classList.remove(CONFIG.classes.showScroll);
        }, 800); // 0.8초 뒤 숨김
      },
      { passive: true }
    );
  }
}
