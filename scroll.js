document.addEventListener("DOMContentLoaded", uiInit);

function uiInit() {
  dynamicNavigator({
    scrollToTop: false, // 새로고침 시 상단 이동 여부
    scrollDuration: 500, // 본문 스크롤 이동 속도 (ms)
  });
}

/**
 * [Dynamic Navigator Module]
 * 본문의 H1, H2 태그를 파싱하여 우측 내비게이터를 생성하고,
 * 스크롤 위치에 따라 현재 섹션을 하이라이트(Active)하는 기능을 수행합니다.
 */
function dynamicNavigator(options = {}) {
  // =================================================================
  // [1] 설정 및 상태 관리 (Configuration & State)
  // =================================================================
  const CONFIG = {
    scrollToTop: options.scrollToTop ?? false,
    scrollDuration: options.scrollDuration || 500,

    // [변경] 더 직관적인 속성명으로 수정
    attrName: "data-nav-title",

    selectors: {
      wrap: ".navigator-wrap", // 내비게이터 전체 래퍼
      area: ".navigator-area", // 배경 영역
      inner: ".navigator-inner", // 내부 콘텐츠 영역
      nav: "navigator", // 생성될 nav 태그의 클래스명

      header: ".header_dev", // 헤더 요소 (높이 계산용)
      footer: ".footer_dev", // 푸터 요소 (위치 계산용)

      // 파싱 대상 타이틀 [Depth 1, Depth 2]
      titles: [".dev_contents .h1_title", ".dev_contents .h2_title"],
      descWrapper: ".desc", // H2가 감싸져 있을 수 있는 래퍼
    },
    classes: {
      active: "active-nav-item",
      showScroll: "show-scrollbar",
    },
    offset: {
      top: 80, // 헤더 아래 여백
      scrollSpyBuffer: 24, // 스크롤 감지 오차 보정값
      bottomBuffer: 32, // 푸터 위 여백
    },
  };

  // 자주 접근하는 DOM 요소 캐싱
  const DOM = {
    wrap: document.querySelector(CONFIG.selectors.wrap),
    area: document.querySelector(CONFIG.selectors.area),
    inner: document.querySelector(CONFIG.selectors.inner),
    header: document.querySelector(CONFIG.selectors.header),
    footer: document.querySelector(CONFIG.selectors.footer),
    navLinks: null, // 렌더링 후 생성된 버튼들을 저장
  };

  // 렌더링 및 위치 계산에 필요한 상태값
  const STATE = {
    headerHeight: 0,
    winHeight: 0,
    docHeight: 0,
    sections: [], // { id, top, btnElement } 배열 (스크롤 스파이 최적화용)
  };

  // 필수 요소 부재 시 실행 중단
  if (!DOM.wrap || !DOM.area || !DOM.inner) return;

  // 모듈 초기화
  init();

  /**
   * [초기화 함수] 실행 순서 정의
   */
  function init() {
    // 1. 본문 파싱 (HTML -> 데이터 구조)
    const structure = parseContentStructure();

    // 2. 타이틀이 없으면 내비게이터 숨김
    if (structure.length === 0) {
      DOM.wrap.style.display = "none";
      return;
    }

    // 3. 스크롤 위치 초기화 옵션 처리
    if ("scrollRestoration" in history) {
      history.scrollRestoration = CONFIG.scrollToTop ? "manual" : "auto";
    }
    if (CONFIG.scrollToTop) setTimeout(() => window.scrollTo(0, 0), 0);

    // 4. 내비게이터 HTML 생성 및 삽입
    renderNavigation(structure);

    // 5. 이벤트 리스너 등록 (Scroll, Resize, Click)
    bindEvents();

    // 6. 초기 사이즈 및 레이아웃 위치 계산
    updateDimensions();
    updateLayoutPosition();
  }

  // =================================================================
  // [2] 파싱 로직 (Content Parser)
  // =================================================================
  /**
   * 본문의 H1(Depth1), H2(Depth2) 구조를 읽어 계층형 데이터로 반환합니다.
   */
  function parseContentStructure() {
    const [h1Sel, h2Sel] = CONFIG.selectors.titles;
    const h1List = document.querySelectorAll(h1Sel);
    const result = [];

    h1List.forEach((h1, idx) => {
      // [변경] Depth 1 ID 생성: nav-title-1, nav-title-2 ...
      const h1Id = getOrSetNavAttribute(h1, idx + 1, "nav-title");

      const section = {
        id: h1Id,
        text: h1.textContent,
        type: "depth1",
        children: [],
      };

      // Depth 2 탐색 (다음 H1이 나오기 전까지의 H2 수집)
      let nextNode = h1.nextElementSibling;
      let subIdx = 0;

      while (nextNode && !nextNode.matches(h1Sel)) {
        let h2 = null;
        if (nextNode.matches(h2Sel)) h2 = nextNode;
        else if (nextNode.matches(CONFIG.selectors.descWrapper)) {
          // 특정 래퍼 안에 H2가 있는 경우 대응
          h2 = nextNode.querySelector(h2Sel);
        }

        if (h2) {
          subIdx++;
          // [변경] Depth 2 ID 생성: nav-title-1-1, nav-title-1-2 ...
          // prefix를 부모와 동일하게 'nav-title'로 통일하여 직관성 확보
          const h2Id = getOrSetNavAttribute(
            h2,
            `${idx + 1}-${subIdx}`,
            "nav-title"
          );
          section.children.push({
            id: h2Id,
            text: h2.textContent,
            type: "depth2",
          });
        }
        nextNode = nextNode.nextElementSibling;
      }
      result.push(section);
    });

    return result;
  }

  // 요소에 식별자(ID 역할) 속성이 없으면 부여
  function getOrSetNavAttribute(element, index, prefix) {
    let val = element.getAttribute(CONFIG.attrName);
    if (!val) {
      val = `${prefix}-${index}`;
      element.setAttribute(CONFIG.attrName, val);
    }
    if (!element.hasAttribute("tabindex")) {
      element.setAttribute("tabindex", "-1");
    }
    return val;
  }

  // =================================================================
  // [3] 렌더링 로직 (DOM Renderer)
  // =================================================================
  /**
   * 파싱된 데이터를 기반으로 HTML 구조를 생성합니다.
   */
  function renderNavigation(structure) {
    const navEl = document.createElement("nav");
    navEl.className = CONFIG.selectors.nav;
    navEl.setAttribute("role", "navigation");
    navEl.setAttribute("aria-label", "문서 목차");

    const rootUl = document.createElement("ul");
    rootUl.className = "depth1";

    structure.forEach((sec) => {
      const li = document.createElement("li");
      li.appendChild(createButton(sec)); // Depth 1 버튼

      // 하위 메뉴(Depth 2)가 있으면 생성
      if (sec.children.length > 0) {
        const subUl = document.createElement("ul");
        subUl.className = "depth2";

        // 활성 위치 표시 마커(Bar)
        const marker = document.createElement("span");
        marker.className = "nav-marker";
        marker.setAttribute("aria-hidden", "true");
        subUl.appendChild(marker);

        sec.children.forEach((subSec) => {
          const subLi = document.createElement("li");
          subLi.appendChild(createButton(subSec)); // Depth 2 버튼
          subUl.appendChild(subLi);
        });
        li.appendChild(subUl);
      }
      rootUl.appendChild(li);
    });

    navEl.appendChild(rootUl);
    DOM.inner.appendChild(navEl);

    // 버튼 목록 캐싱 및 스크롤바 이벤트 연결
    DOM.navLinks = navEl.querySelectorAll("button");
    attachScrollbarHandler(navEl);
  }

  // 버튼 생성 헬퍼 (Text 래핑 포함)
  function createButton(data) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `${data.type}--item`; // e.g., depth1--item

    // 텍스트 스타일링을 위해 span으로 래핑
    const span = document.createElement("span");
    span.className = `${data.type}--text`; // e.g., depth1--text
    span.textContent = data.text.trim();

    btn.appendChild(span);
    btn.dataset.target = data.id;
    btn.addEventListener("click", handleNavClick);
    return btn;
  }

  // =================================================================
  // [4] 이벤트 및 업데이트 로직 (Event & Update Controller)
  // =================================================================
  function bindEvents() {
    let tick = false;

    // 1. 스크롤 이벤트 (RAF 최적화)
    window.addEventListener(
      "scroll",
      () => {
        updateLayoutPosition(); // 레이아웃 위치는 즉시 반응
        if (!tick) {
          window.requestAnimationFrame(() => {
            updateActiveState(); // 활성 상태 변경은 프레임 단위 처리
            tick = false;
          });
          tick = true;
        }
      },
      { passive: true }
    );

    // 2. 리사이즈 이벤트
    const handleResize = () => {
      updateDimensions(); // 치수 재계산
      updateLayoutPosition(); // 위치 재조정
      updateActiveState(); // 활성 상태 갱신
    };
    window.addEventListener("resize", handleResize);

    // 헤더 높이 변경 감지
    if (DOM.header) {
      new ResizeObserver(handleResize).observe(DOM.header);
    }
  }

  // 화면 크기 및 섹션 위치 좌표 캐싱 (성능 최적화)
  function updateDimensions() {
    STATE.headerHeight = DOM.header ? DOM.header.offsetHeight : 0;
    STATE.winHeight = window.innerHeight;
    STATE.docHeight = document.documentElement.scrollHeight;

    if (DOM.navLinks) {
      STATE.sections = Array.from(DOM.navLinks)
        .map((btn) => {
          const targetId = btn.dataset.target;
          const targetElem = document.querySelector(
            `[${CONFIG.attrName}="${targetId}"]`
          );
          if (!targetElem) return null;
          return {
            id: targetId,
            // 현재 스크롤값을 포함한 절대 Y좌표 저장
            top: targetElem.getBoundingClientRect().top + window.scrollY,
            btn: btn,
          };
        })
        .filter((item) => item !== null);
    }
  }

  // 내비게이터 레이아웃 위치 조정 (헤더/푸터 회피)
  function updateLayoutPosition() {
    // Top: 헤더 높이만큼 아래로
    DOM.area.style.top = `${STATE.headerHeight}px`;
    DOM.inner.style.paddingTop = `${CONFIG.offset.top}px`;

    // Bottom: 푸터와 겹치지 않게 조정
    let bottomVal = CONFIG.offset.bottomBuffer;
    if (DOM.footer) {
      const footerRect = DOM.footer.getBoundingClientRect();
      if (footerRect.top < STATE.winHeight) {
        bottomVal += STATE.winHeight - footerRect.top;
      }
    }
    DOM.area.style.bottom = `${bottomVal}px`;
  }

  // 스크롤 스파이 로직 (현재 위치 활성화)
  function updateActiveState() {
    const scrollY =
      window.scrollY + STATE.headerHeight + CONFIG.offset.scrollSpyBuffer;

    // 1. 페이지 최상단
    if (window.scrollY <= 0) {
      if (DOM.navLinks.length > 0) activateButton(DOM.navLinks[0]);
      return;
    }

    // 2. 페이지 최하단
    if (window.scrollY + STATE.winHeight >= STATE.docHeight - 5) {
      const lastBtn = DOM.navLinks[DOM.navLinks.length - 1];
      activateButton(lastBtn);

      // 내비게이터 자체 스크롤도 끝까지 내림
      const navEl = DOM.inner.querySelector(`.${CONFIG.selectors.nav}`);
      if (navEl)
        navEl.scrollTo({ top: navEl.scrollHeight, behavior: "smooth" });
      return;
    }

    // 3. 일반 섹션 매칭 (역순 탐색)
    for (let i = STATE.sections.length - 1; i >= 0; i--) {
      const sec = STATE.sections[i];
      if (scrollY >= sec.top) {
        activateButton(sec.btn);
        break;
      }
    }
  }

  // 내비게이터 클릭 핸들러 (부드러운 스크롤 이동)
  function handleNavClick(e) {
    const targetId = e.currentTarget.dataset.target;
    const targetElem = document.querySelector(
      `[${CONFIG.attrName}="${targetId}"]`
    );

    if (targetElem) {
      const targetTop =
        targetElem.getBoundingClientRect().top +
        window.scrollY -
        STATE.headerHeight;
      smoothScrollTo(targetTop, () => {
        targetElem.focus({ preventScroll: true });
      });
    }
  }

  // =================================================================
  // [5] UI 유틸리티 (UI Utilities)
  // =================================================================
  /**
   * 버튼 활성화 처리 함수
   * - Depth 1, Depth 2 관계없이 항상 '부모 Depth 1'을 기준으로 뷰포트 정렬을 수행합니다.
   */
  function activateButton(targetBtn) {
    if (!targetBtn || targetBtn.classList.contains(CONFIG.classes.active))
      return;

    resetActiveStatus();

    // 버튼 활성화
    targetBtn.classList.add(CONFIG.classes.active);
    targetBtn.setAttribute("aria-current", "true");

    const li = targetBtn.closest("li");
    const parentUl = li.parentElement;

    // 내비게이터 스크롤 이동 대상 (항상 Depth 1 기준)
    let scrollTargetElement = li;

    if (parentUl.classList.contains("depth2")) {
      // Case 1: Depth 2 활성화
      moveMarker(parentUl, li); // 마커 이동

      const parentDepth1Li = parentUl.closest("li");
      const parentDepth1Btn = parentDepth1Li?.querySelector(".depth1--item");

      // 부모 Depth 1도 활성화 스타일 적용
      if (parentDepth1Btn) parentDepth1Btn.classList.add(CONFIG.classes.active);

      // 스크롤 기준은 부모 Depth 1
      scrollTargetElement = parentDepth1Li;
    } else {
      // Case 2: Depth 1 활성화
      const childUl = li.querySelector(".depth2");
      if (childUl) {
        // 첫 번째 자식에 마커 미리 위치시킴
        const firstChildLi = childUl.querySelector("li");
        const firstChildBtn = firstChildLi?.querySelector("button");
        if (firstChildBtn) {
          firstChildBtn.classList.add(CONFIG.classes.active);
          moveMarker(childUl, firstChildLi);
        }
      }
      // 스크롤 기준은 자기 자신 (Depth 1)
      scrollTargetElement = li;
    }

    // [Standard] 타겟 요소(Depth 1)가 화면 안에 들어오도록만 최소한으로 스크롤 이동
    // (강제 중앙 정렬이나 상단 정렬 없이, 가장 자연스러운 기본 동작)
    scrollTargetElement.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }

  // 활성 상태 초기화
  function resetActiveStatus() {
    if (!DOM.navLinks) return;
    DOM.navLinks.forEach((el) => {
      el.classList.remove(CONFIG.classes.active);
      el.removeAttribute("aria-current");
    });
    // 모든 마커 숨김
    DOM.wrap
      .querySelectorAll(".nav-marker")
      .forEach((m) => (m.style.opacity = "0"));
  }

  // 슬라이딩 마커 위치 이동
  function moveMarker(ul, activeLi) {
    const marker = ul.querySelector(".nav-marker");
    if (marker && activeLi) {
      marker.style.top = `${activeLi.offsetTop}px`;
      marker.style.height = `${activeLi.offsetHeight}px`;
      marker.style.opacity = "1";
    }
  }

  // 부드러운 스크롤 애니메이션 (Easing 함수 적용)
  function smoothScrollTo(targetPosition, callback) {
    const start = window.scrollY;
    const distance = targetPosition - start;
    const duration = CONFIG.scrollDuration;
    let startTime = null;

    function animation(currentTime) {
      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // EaseInOutQuad
      const ease =
        progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      window.scrollTo(0, start + distance * ease);

      if (elapsed < duration) requestAnimationFrame(animation);
      else if (callback) callback();
    }
    requestAnimationFrame(animation);
  }

  // 내비게이터 스크롤바 페이드 효과
  function attachScrollbarHandler(el) {
    let timer;
    el.addEventListener(
      "scroll",
      () => {
        el.classList.add(CONFIG.classes.showScroll);
        if (timer) clearTimeout(timer);
        timer = setTimeout(
          () => el.classList.remove(CONFIG.classes.showScroll),
          800
        );
      },
      { passive: true }
    );
  }
}
