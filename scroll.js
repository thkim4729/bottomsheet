document.addEventListener("DOMContentLoaded", uiInit);

function uiInit() {
  dynamicNavigator({
    scrollToTop: false,
    scrollDuration: 500,
  });
}

/**
 * [Dynamic Navigator Main]
 * 본문의 H1, H2 태그를 읽어 우측 내비게이터를 생성하고,
 * 스크롤 위치에 따라 활성화(Active) 상태를 동적으로 변경하는 기능을 수행합니다.
 */
function dynamicNavigator(options = {}) {
  // =================================================================
  // [1] 설정 및 상태 관리 (Config & State)
  // =================================================================
  const CONFIG = {
    scrollToTop: options.scrollToTop ?? false,
    scrollDuration: options.scrollDuration || 500,
    attrName: "data-nav-section", // ID 충돌 방지를 위한 전용 식별자 속성

    selectors: {
      wrap: ".navigator-wrap",
      area: ".navigator-area",
      inner: ".navigator-inner",
      nav: "navigator", // 생성될 nav 클래스

      header: ".header_dev",
      footer: ".footer_dev",

      // 파싱 대상 타이틀 (순서대로 Depth 1, Depth 2)
      titles: [".dev_contents .h1_title", ".dev_contents .h2_title"],
      descWrapper: ".desc", // H2가 숨어있을 수 있는 특정 래퍼 클래스
    },
    classes: {
      active: "active-nav-item",
      showScroll: "show-scrollbar",
    },
    offset: {
      top: 80, // 헤더 아래에서 띄울 간격
      scrollSpyBuffer: 20, // 스크롤 감지 시 오차 범위
      bottomBuffer: 32, // 푸터 위에서 띄울 간격
    },
  };

  // 자주 쓰는 DOM 요소 캐싱 (매번 querySelector를 호출하면 성능 저하)
  const DOM = {
    wrap: document.querySelector(CONFIG.selectors.wrap),
    area: document.querySelector(CONFIG.selectors.area),
    inner: document.querySelector(CONFIG.selectors.inner),
    header: document.querySelector(CONFIG.selectors.header),
    footer: document.querySelector(CONFIG.selectors.footer),
    navLinks: null, // 렌더링 후 생성된 버튼들을 담을 변수
  };

  // 성능 최적화를 위한 상태값 저장소 (리사이즈 시에만 갱신됨)
  const STATE = {
    headerHeight: 0,
    winHeight: 0,
    docHeight: 0,
    sections: [], // { id, top, btnElement } 정보를 담을 배열 (스크롤 스파이 핵심)
  };

  // 필수 요소가 없으면 기능 중단
  if (!DOM.wrap || !DOM.area || !DOM.inner) return;

  // 초기화 실행
  init();

  /**
   * [초기화 함수]
   * 전체 로직의 실행 순서를 제어합니다.
   */
  function init() {
    // 1. 본문 구조 파싱 (HTML -> 데이터 구조체 변환)
    const structure = parseContentStructure();

    // 2. 타이틀이 하나도 없으면 내비게이터 숨김 처리
    if (structure.length === 0) {
      DOM.wrap.style.display = "none";
      return;
    }

    // 3. 브라우저 스크롤 위치 초기화 설정
    if ("scrollRestoration" in history) {
      history.scrollRestoration = CONFIG.scrollToTop ? "manual" : "auto";
    }
    if (CONFIG.scrollToTop) setTimeout(() => window.scrollTo(0, 0), 0);

    // 4. HTML 렌더링 (데이터 -> 실제 태그 생성)
    renderNavigation(structure);

    // 5. 이벤트 바인딩 (스크롤, 리사이즈, 클릭)
    bindEvents();

    // 6. 초기 사이즈 및 위치 계산 (화면 그려진 직후 실행)
    updateDimensions();
    updateLayoutPosition();
  }

  // =================================================================
  // [2] 파싱 로직 (Reader)
  // =================================================================
  /**
   * 본문의 H1, H2 태그를 찾아 계층형 데이터(JSON 형태)로 만듭니다.
   * - Depth 1 (H1) 아래에 Depth 2 (H2)들을 자식으로 그룹화합니다.
   */
  function parseContentStructure() {
    const [h1Sel, h2Sel] = CONFIG.selectors.titles;
    const h1List = document.querySelectorAll(h1Sel);
    const result = [];

    h1List.forEach((h1, idx) => {
      // 1. Depth 1 데이터 생성
      const h1Id = getOrSetNavAttribute(h1, idx + 1, "nav-sec");
      const section = {
        id: h1Id,
        text: h1.textContent,
        type: "depth1",
        children: [],
      };

      // 2. Depth 2 탐색 logic (다음 H1이 나오기 전까지의 모든 H2 수집)
      let nextNode = h1.nextElementSibling;
      let subIdx = 0;

      while (nextNode && !nextNode.matches(h1Sel)) {
        let h2 = null;
        // 바로 다음 형제가 H2이거나, 특정 래퍼(.desc) 안에 H2가 있는 경우
        if (nextNode.matches(h2Sel)) h2 = nextNode;
        else if (nextNode.matches(CONFIG.selectors.descWrapper)) {
          h2 = nextNode.querySelector(h2Sel);
        }

        if (h2) {
          subIdx++;
          const h2Id = getOrSetNavAttribute(
            h2,
            `${idx + 1}-${subIdx}`,
            "nav-sub"
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

  /**
   * [Helper] 식별자 속성(data-nav-section) 관리
   * 요소에 속성이 있으면 그 값을 쓰고, 없으면 자동으로 생성해서 부여합니다.
   */
  function getOrSetNavAttribute(element, index, prefix) {
    let val = element.getAttribute(CONFIG.attrName);
    if (!val) {
      val = `${prefix}-${index}`;
      element.setAttribute(CONFIG.attrName, val);
    }
    // 포커스 이동을 위해 tabindex 설정
    if (!element.hasAttribute("tabindex")) {
      element.setAttribute("tabindex", "-1");
    }
    return val;
  }

  // =================================================================
  // [3] 렌더링 로직 (Builder)
  // =================================================================
  /**
   * 파싱된 데이터를 기반으로 <nav>, <ul>, <li>, <button> 태그를 생성하여
   * HTML의 .navigator-inner 안에 삽입합니다.
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

      // 자식(Depth 2)이 있는 경우 하위 리스트 생성
      if (sec.children.length > 0) {
        const subUl = document.createElement("ul");
        subUl.className = "depth2";

        // 현재 위치를 표시할 '슬라이딩 마커(Bar)' 생성
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

    // 생성된 버튼 목록을 캐싱 (추후 스크롤 스파이에서 사용)
    DOM.navLinks = navEl.querySelectorAll("button");

    // 내비게이터 자체 스크롤바 페이드인/아웃 효과 적용
    attachScrollbarHandler(navEl);
  }

  // 버튼 태그 생성 헬퍼 함수
  function createButton(data) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `${data.type}--item`; // depth1--item 또는 depth2--item
    btn.textContent = data.text.trim();
    btn.dataset.target = data.id; // 클릭 시 이동할 타겟 ID 저장
    btn.addEventListener("click", handleNavClick);
    return btn;
  }

  // =================================================================
  // [4] 이벤트 및 업데이트 로직 (Controller)
  // =================================================================
  function bindEvents() {
    let tick = false;

    // 1. 스크롤 이벤트 (requestAnimationFrame으로 성능 최적화)
    window.addEventListener(
      "scroll",
      () => {
        updateLayoutPosition(); // 레이아웃 위치(top/bottom)는 즉시 반응해야 함
        if (!tick) {
          window.requestAnimationFrame(() => {
            updateActiveState(); // 활성 메뉴 변경은 프레임 단위로 처리
            tick = false;
          });
          tick = true;
        }
      },
      { passive: true }
    );

    // 2. 리사이즈 이벤트
    const handleResize = () => {
      updateDimensions(); // 높이값 등 재계산
      updateLayoutPosition(); // 위치 재조정
      updateActiveState(); // 활성 상태 갱신
    };
    window.addEventListener("resize", handleResize);

    // 3. 헤더 크기가 변할 때도 대응 (ResizeObserver)
    if (DOM.header) {
      new ResizeObserver(handleResize).observe(DOM.header);
    }
  }

  /**
   * [성능 최적화 핵심]
   * 리사이즈 시에만 섹션들의 위치(top)를 계산해서 STATE.sections에 저장합니다.
   * 스크롤 이벤트에서는 DOM에 접근하지 않고 저장된 배열값만 비교합니다.
   */
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
            // 현재 스크롤값 포함한 절대 좌표 저장
            top: targetElem.getBoundingClientRect().top + window.scrollY,
            btn: btn,
          };
        })
        .filter((item) => item !== null);
    }
  }

  /**
   * [레이아웃 위치 조정]
   * 내비게이터가 헤더에 가려지거나, 푸터와 겹치지 않도록 Top/Bottom 값을 조정합니다.
   */
  function updateLayoutPosition() {
    // Top: 헤더 높이만큼 내리고 + 오프셋 추가
    DOM.area.style.top = `${STATE.headerHeight}px`;
    DOM.inner.style.paddingTop = `${CONFIG.offset.top}px`;

    // Bottom: 푸터가 화면에 올라오면 그만큼 bottom 값을 키워서 밀어 올림
    let bottomVal = CONFIG.offset.bottomBuffer;
    if (DOM.footer) {
      const footerRect = DOM.footer.getBoundingClientRect();
      if (footerRect.top < STATE.winHeight) {
        bottomVal += STATE.winHeight - footerRect.top;
      }
    }
    DOM.area.style.bottom = `${bottomVal}px`;
  }

  /**
   * [스크롤 스파이]
   * 현재 스크롤 위치를 감지하여 해당하는 메뉴를 활성화합니다.
   */
  function updateActiveState() {
    const scrollY =
      window.scrollY + STATE.headerHeight + CONFIG.offset.scrollSpyBuffer;

    // 1. 페이지 최상단: 첫 번째 메뉴 활성화
    if (window.scrollY <= 0) {
      if (DOM.navLinks.length > 0) activateButton(DOM.navLinks[0]);
      return;
    }

    // 2. 페이지 최하단: 마지막 메뉴 강제 활성화 (푸터 보일 때)
    if (window.scrollY + STATE.winHeight >= STATE.docHeight - 5) {
      const lastBtn = DOM.navLinks[DOM.navLinks.length - 1];
      activateButton(lastBtn);

      // 사용자 편의를 위해 내비게이터 자체 스크롤도 끝까지 내림
      const navEl = DOM.inner.querySelector(`.${CONFIG.selectors.nav}`);
      if (navEl)
        navEl.scrollTo({ top: navEl.scrollHeight, behavior: "smooth" });
      return;
    }

    // 3. 일반 섹션 매칭: 역순으로 탐색하여 현재 보고 있는 섹션 찾기
    for (let i = STATE.sections.length - 1; i >= 0; i--) {
      const sec = STATE.sections[i];
      if (scrollY >= sec.top) {
        activateButton(sec.btn);
        break;
      }
    }
  }

  /**
   * [클릭 핸들러]
   * 메뉴 클릭 시 해당 섹션으로 부드럽게 스크롤 이동합니다.
   */
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
        // 이동 후 포커스 (접근성)
        targetElem.focus({ preventScroll: true });
      });
    }
  }

  // =================================================================
  // [5] UI 유틸리티 (활성화, 마커, 애니메이션)
  // =================================================================

  /**
   * 버튼 활성화 통합 로직
   * Depth 1, Depth 2 구분 없이 마커 이동 및 부모 활성화를 처리합니다.
   */
  function activateButton(targetBtn) {
    if (!targetBtn || targetBtn.classList.contains(CONFIG.classes.active))
      return;

    // 1. 기존 활성 상태 초기화
    resetActiveStatus();

    // 2. 타겟 버튼 활성화
    targetBtn.classList.add(CONFIG.classes.active);
    targetBtn.setAttribute("aria-current", "true");

    const li = targetBtn.closest("li");
    const parentUl = li.parentElement; // ul.depth1 또는 ul.depth2

    if (parentUl.classList.contains("depth2")) {
      // Depth 2인 경우: 슬라이딩 마커 이동 + 부모 Depth 1도 활성화
      moveMarker(parentUl, li);

      const parentDepth1Li = parentUl.closest("li");
      const parentDepth1Btn = parentDepth1Li?.querySelector(".depth1--item");
      if (parentDepth1Btn) parentDepth1Btn.classList.add(CONFIG.classes.active);

      // 내비게이터 스크롤 이동 (부모 그룹이 다 보이도록)
      parentDepth1Li.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else {
      // Depth 1인 경우: 자식(Depth 2)이 있다면 첫 번째 자식에 마커 미리 세팅
      const childUl = li.querySelector(".depth2");
      if (childUl) {
        const firstChildLi = childUl.querySelector("li");
        const firstChildBtn = firstChildLi?.querySelector("button");
        if (firstChildBtn) {
          firstChildBtn.classList.add(CONFIG.classes.active);
          moveMarker(childUl, firstChildLi);
        }
      }
      li.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  // 활성 클래스 및 마커 초기화
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

  // 슬라이딩 마커(회색 바) 위치 이동
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

      // Easing: EaseInOutQuad
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

  // 스크롤 시에만 스크롤바가 진하게 보이는 효과
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
