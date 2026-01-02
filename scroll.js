document.addEventListener("DOMContentLoaded", () => {
  // 내비게이터 실행 및 제어 객체 할당
  const nav = uiInit();
});

/**
 * [초기화 진입점]
 * 설정을 주입하고 내비게이터 모듈을 시작합니다.
 */
function uiInit() {
  return dynamicNavigator({
    scrollToTop: false, // 새로고침 시 최상단 이동 여부
    scrollDuration: 500, // 스크롤 애니메이션 속도 (ms)
    debug: true, // [디버깅] 한글 로그 출력 여부
  });
}

/**
 * [Dynamic Navigator Module]
 * 본문의 H1, H2를 파싱하여 목차를 생성하고 스크롤과 연동하는 핵심 모듈입니다.
 */
function dynamicNavigator(options = {}) {
  // =================================================================
  // [1] 설정 및 상태 관리 (Config & State)
  // =================================================================
  const CONFIG = {
    debug: options.debug ?? false,
    scrollToTop: options.scrollToTop ?? false,
    scrollDuration: options.scrollDuration || 500,
    attrName: "data-nav-title",

    selectors: {
      wrap: ".navigator-wrap",
      area: ".navigator-area",
      inner: ".navigator-inner",
      nav: "navigator",
      header: ".header_dev",
      footer: ".footer_dev",
      contentArea: ".dev_contents",
      titles: [".dev_contents .h1_title", ".dev_contents .h2_title"],
      descWrapper: ".desc",
    },
    classes: {
      active: "active-nav-item",
      showScroll: "show-scrollbar",
    },
    offset: {
      top: 80,
      scrollSpyBuffer: 24,
      bottomBuffer: 32,
    },
  };

  const DOM = {
    wrap: document.querySelector(CONFIG.selectors.wrap),
    area: document.querySelector(CONFIG.selectors.area),
    inner: document.querySelector(CONFIG.selectors.inner),
    header: document.querySelector(CONFIG.selectors.header),
    footer: document.querySelector(CONFIG.selectors.footer),
    content: document.querySelector(CONFIG.selectors.contentArea),
    navLinks: null,
  };

  const STATE = {
    headerHeight: 0,
    winHeight: 0,
    docHeight: 0,
    sections: [],
    observer: null,
    resizeObserver: null,
    debounceTimer: null,
    tick: false,
  };

  // [유틸] 디버그 모드일 때만 로그를 출력하는 함수
  const logger = (msg, ...args) => {
    if (CONFIG.debug) {
      console.log(
        `%c[Navigator] ${msg}`,
        "color: #00bcd4; font-weight: bold;",
        ...args
      );
    }
  };

  if (!DOM.wrap || !DOM.area || !DOM.inner) {
    console.error("[Navigator] 필수 DOM 요소를 찾을 수 없습니다.");
    return;
  }

  // 모듈 실행
  init();

  // 외부 제어용 API 반환
  return {
    refresh: refreshNavigator,
    destroy: destroy,
  };

  // =================================================================
  // [2] 생명주기 관리 (Lifecycle)
  // =================================================================
  /**
   * [생성자]
   * 내비게이터를 처음 실행할 때 필요한 준비 작업을 수행합니다.
   * - 화면 그리기, 이벤트 연결, 감시 시작
   */
  function init() {
    logger("초기화 시작...");

    // 1. 초기 렌더링
    refreshNavigator();

    // 2. 스크롤 위치 초기화
    if ("scrollRestoration" in history) {
      history.scrollRestoration = CONFIG.scrollToTop ? "manual" : "auto";
    }
    if (CONFIG.scrollToTop) {
      setTimeout(() => window.scrollTo(0, 0), 0);
      logger("설정에 따라 최상단으로 이동했습니다.");
    }

    // 3. 이벤트 감시 시작
    bindEvents();
    observeContentChanges();
  }

  /**
   * [새로고침]
   * DOM 변경 시 호출되어 내비게이터를 완전히 다시 그립니다.
   * 파싱 -> 렌더링 -> 치수 계산 -> 위치 보정 과정을 수행합니다.
   */
  function refreshNavigator() {
    const structure = parseContentStructure();

    // 타이틀이 없으면 숨김 처리
    if (structure.length === 0) {
      DOM.wrap.style.display = "none";
      DOM.inner.replaceChildren();
      DOM.navLinks = null;
      STATE.sections = [];
      logger("표시할 목차가 없어 숨깁니다.");
      return;
    } else {
      DOM.wrap.style.display = "block";
    }

    // 다시 그리기
    DOM.inner.replaceChildren();
    renderNavigation(structure);

    // 치수 및 레이아웃 재계산
    updateDimensions();
    updateLayoutPosition();

    // 현재 위치로 즉시 이동
    updateActiveState(true);

    logger(`갱신 완료. (총 ${structure.length}개 챕터)`);
  }

  /**
   * [소멸자]
   * 메모리 누수를 방지하기 위해 등록된 이벤트와 옵저버를 모두 제거합니다.
   * (SPA 페이지 이동 시 등에 사용)
   */
  function destroy() {
    logger("종료 및 리소스 정리 중...");

    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onResize);

    if (STATE.observer) {
      STATE.observer.disconnect();
      STATE.observer = null;
    }
    if (STATE.resizeObserver) {
      STATE.resizeObserver.disconnect();
      STATE.resizeObserver = null;
    }
    if (STATE.debounceTimer) clearTimeout(STATE.debounceTimer);

    if (DOM.inner) DOM.inner.replaceChildren();
    if (DOM.wrap) DOM.wrap.style.display = "none";

    logger("종료 완료.");
  }

  // =================================================================
  // [3] 핵심 로직: 파싱 및 렌더링 (Core Logic)
  // =================================================================
  /**
   * [파싱]
   * 본문의 H1, H2 태그를 찾아 계층형 데이터(JSON 형태)로 변환합니다.
   * display: none 인 요소는 제외합니다.
   */
  function parseContentStructure() {
    const [h1Sel, h2Sel] = CONFIG.selectors.titles;
    const h1List = document.querySelectorAll(h1Sel);
    const result = [];

    h1List.forEach((h1, idx) => {
      // 숨겨진 요소 건너뛰기
      if (!isVisible(h1)) return;

      const h1Id = getOrSetNavAttribute(h1, idx + 1, "nav-title");
      const section = {
        id: h1Id,
        text: h1.textContent,
        type: "depth1",
        children: [],
      };

      let nextNode = h1.nextElementSibling;
      let subIdx = 0;

      while (nextNode && !nextNode.matches(h1Sel)) {
        let h2 = null;
        if (nextNode.matches(h2Sel)) h2 = nextNode;
        else if (nextNode.matches(CONFIG.selectors.descWrapper)) {
          h2 = nextNode.querySelector(h2Sel);
        }

        if (h2 && isVisible(h2)) {
          subIdx++;
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

  /**
   * [렌더링]
   * 파싱된 데이터를 바탕으로 실제 HTML 태그(nav, ul, li, button)를 생성합니다.
   */
  function renderNavigation(structure) {
    const navEl = document.createElement("nav");
    navEl.className = CONFIG.selectors.nav;
    navEl.setAttribute("role", "navigation");
    navEl.setAttribute("aria-label", "목차");

    const rootUl = document.createElement("ul");
    rootUl.className = "depth1";

    structure.forEach((sec) => {
      const li = document.createElement("li");
      li.appendChild(createButton(sec));

      if (sec.children.length > 0) {
        const subUl = document.createElement("ul");
        subUl.className = "depth2";

        const marker = document.createElement("span");
        marker.className = "nav-marker";
        marker.setAttribute("aria-hidden", "true");
        subUl.appendChild(marker);

        sec.children.forEach((subSec) => {
          const subLi = document.createElement("li");
          subLi.appendChild(createButton(subSec));
          subUl.appendChild(subLi);
        });
        li.appendChild(subUl);
      }
      rootUl.appendChild(li);
    });

    navEl.appendChild(rootUl);
    DOM.inner.appendChild(navEl);
    DOM.navLinks = navEl.querySelectorAll("button");
    attachScrollbarHandler(navEl);
  }

  // =================================================================
  // [4] 계산 및 상태 업데이트 (Calculations)
  // =================================================================
  /**
   * [치수 계산]
   * 각 섹션의 Y좌표(top)와 헤더 높이 등을 미리 계산하여 STATE에 저장합니다.
   * 스크롤 할 때마다 계산하면 성능이 저하되므로 미리 계산합니다.
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
          if (!targetElem || !isVisible(targetElem)) return null;

          return {
            id: targetId,
            top: targetElem.getBoundingClientRect().top + window.scrollY,
            btn: btn,
          };
        })
        .filter((item) => item !== null);
    }
  }

  /**
   * [위치 보정]
   * 내비게이터가 헤더나 푸터와 겹치지 않도록 top, bottom 값을 조정합니다.
   */
  function updateLayoutPosition() {
    DOM.area.style.top = `${STATE.headerHeight}px`;
    DOM.inner.style.paddingTop = `${CONFIG.offset.top}px`;

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
   * 현재 스크롤 위치를 감지하여 해당하는 내비게이터 버튼을 활성화합니다.
   * @param {boolean} isInstant - true면 내비게이터 스크롤을 즉시 이동, false면 부드럽게 이동
   */
  function updateActiveState(isInstant = false) {
    const scrollY =
      window.scrollY + STATE.headerHeight + CONFIG.offset.scrollSpyBuffer;

    // 1. 최상단 처리
    if (window.scrollY <= 0) {
      if (DOM.navLinks && DOM.navLinks.length > 0)
        activateButton(DOM.navLinks[0], isInstant);
      const navEl = DOM.inner.querySelector(`.${CONFIG.selectors.nav}`);
      if (navEl)
        navEl.scrollTo({ top: 0, behavior: isInstant ? "auto" : "smooth" });
      return;
    }

    // 2. 최하단 처리
    if (window.scrollY + STATE.winHeight >= STATE.docHeight - 5) {
      if (DOM.navLinks && DOM.navLinks.length > 0) {
        const lastBtn = DOM.navLinks[DOM.navLinks.length - 1];
        activateButton(lastBtn, isInstant);
        const navEl = DOM.inner.querySelector(`.${CONFIG.selectors.nav}`);
        if (navEl)
          navEl.scrollTo({
            top: navEl.scrollHeight,
            behavior: isInstant ? "auto" : "smooth",
          });
      }
      return;
    }

    // 3. 일반 섹션 매칭 (역순 탐색)
    if (!STATE.sections || STATE.sections.length === 0) return;

    for (let i = STATE.sections.length - 1; i >= 0; i--) {
      const sec = STATE.sections[i];
      if (scrollY >= sec.top) {
        activateButton(sec.btn, isInstant);
        break;
      }
    }
  }

  // =================================================================
  // [5] 이벤트 핸들러 (Event Handlers)
  // =================================================================
  /**
   * [스크롤 핸들러]
   * 스크롤 시 위치 보정 및 활성 상태 갱신을 수행합니다. (requestAnimationFrame 최적화)
   */
  function onScroll() {
    updateLayoutPosition();
    if (!STATE.tick) {
      window.requestAnimationFrame(() => {
        updateActiveState(false);
        STATE.tick = false;
      });
      STATE.tick = true;
    }
  }

  /**
   * [리사이즈 핸들러]
   * 창 크기가 변하면 치수와 위치를 다시 계산합니다.
   */
  function onResize() {
    updateDimensions();
    updateLayoutPosition();
    updateActiveState(false);
  }

  /**
   * [클릭 핸들러]
   * 내비게이터 버튼 클릭 시 해당 본문 위치로 부드럽게 이동합니다.
   */
  function handleNavClick(e) {
    const targetBtn = e.currentTarget;
    const targetId = targetBtn.dataset.target;
    logger(`클릭됨: "${targetBtn.textContent.trim()}"`);

    const targetElem = document.querySelector(
      `[${CONFIG.attrName}="${targetId}"]`
    );
    if (targetElem) {
      const targetTop =
        targetElem.getBoundingClientRect().top +
        window.scrollY -
        STATE.headerHeight;
      smoothScrollTo(targetTop, () =>
        targetElem.focus({ preventScroll: true })
      );
    }
  }

  /**
   * [이벤트 바인딩]
   * 스크롤, 리사이즈 이벤트를 등록합니다.
   */
  function bindEvents() {
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    if (DOM.header) {
      STATE.resizeObserver = new ResizeObserver(onResize);
      STATE.resizeObserver.observe(DOM.header);
    }
  }

  /**
   * [DOM 변경 감시]
   * MutationObserver를 사용하여 본문 내용 변화(display:none 등)를 감지합니다.
   */
  function observeContentChanges() {
    if (!DOM.content) return;

    const observerCallback = () => {
      // 변경이 너무 자주 일어나는 것을 방지 (Debounce 0.2초)
      if (STATE.debounceTimer) clearTimeout(STATE.debounceTimer);
      STATE.debounceTimer = setTimeout(() => {
        logger("DOM 변경 감지. 갱신합니다...");
        refreshNavigator();
      }, 200);
    };

    STATE.observer = new MutationObserver(observerCallback);
    STATE.observer.observe(DOM.content, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class", "hidden"],
    });
    logger("변경 감시 시작됨.");
  }

  // =================================================================
  // [6] 유틸리티 및 헬퍼 함수 (Utilities)
  // =================================================================
  /**
   * [버튼 활성화]
   * 특정 버튼에 active 클래스를 주고, 내비게이터 스크롤을 해당 위치로 이동시킵니다.
   */
  function activateButton(targetBtn, isInstant = false) {
    if (!targetBtn || targetBtn.classList.contains(CONFIG.classes.active))
      return;

    resetActiveStatus();
    targetBtn.classList.add(CONFIG.classes.active);
    targetBtn.setAttribute("aria-current", "true");

    // 부모(Depth 1)와 자식(Depth 2) 관계를 고려하여 스크롤 대상을 선정
    const li = targetBtn.closest("li");
    const parentUl = li.parentElement;
    let scrollTargetElement = li;

    if (parentUl.classList.contains("depth2")) {
      moveMarker(parentUl, li);
      const parentDepth1Li = parentUl.closest("li");
      const parentDepth1Btn = parentDepth1Li?.querySelector(".depth1--item");
      if (parentDepth1Btn) parentDepth1Btn.classList.add(CONFIG.classes.active);
      scrollTargetElement = parentDepth1Li;
    } else {
      const childUl = li.querySelector(".depth2");
      if (childUl) {
        const firstChildLi = childUl.querySelector("li");
        const firstChildBtn = firstChildLi?.querySelector("button");
        if (firstChildBtn) {
          firstChildBtn.classList.add(CONFIG.classes.active);
          moveMarker(childUl, firstChildLi);
        }
      }
      scrollTargetElement = li;
    }

    // 내비게이터 내부 스크롤 이동 (화면에 보이도록)
    const behavior = isInstant ? "auto" : "smooth";
    scrollTargetElement.scrollIntoView({
      behavior: behavior,
      block: "nearest",
    });
  }

  /**
   * [활성 상태 초기화]
   * 모든 버튼의 active 클래스를 제거하고 마커를 숨깁니다.
   */
  function resetActiveStatus() {
    if (!DOM.navLinks) return;
    DOM.navLinks.forEach((el) => {
      el.classList.remove(CONFIG.classes.active);
      el.removeAttribute("aria-current");
    });
    DOM.wrap
      .querySelectorAll(".nav-marker")
      .forEach((m) => (m.style.opacity = "0"));
  }

  /**
   * [마커 이동]
   * Depth 2 활성화 시 옆에 표시되는 바(Bar)의 위치를 조정합니다.
   */
  function moveMarker(ul, activeLi) {
    const marker = ul.querySelector(".nav-marker");
    if (marker && activeLi) {
      marker.style.top = `${activeLi.offsetTop}px`;
      marker.style.height = `${activeLi.offsetHeight}px`;
      marker.style.opacity = "1";
    }
  }

  /**
   * [버튼 생성]
   * 버튼 태그와 내부 텍스트 span을 생성합니다.
   */
  function createButton(data) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `${data.type}--item`;

    const span = document.createElement("span");
    span.className = `${data.type}--text`;
    span.textContent = data.text.trim();

    btn.appendChild(span);
    btn.dataset.target = data.id;
    btn.addEventListener("click", handleNavClick);
    return btn;
  }

  /**
   * [가시성 체크]
   * 요소가 display: none 상태인지 확인합니다. (offsetParent 이용)
   */
  function isVisible(el) {
    return el.offsetParent !== null;
  }

  /**
   * [ID 관리]
   * 요소에 data-nav-title 속성이 없으면 생성하여 부여합니다.
   */
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

  /**
   * [커스텀 스무스 스크롤]
   * JS 기반의 부드러운 스크롤 애니메이션을 실행합니다.
   */
  function smoothScrollTo(targetPosition, callback) {
    const start = window.scrollY;
    const distance = targetPosition - start;
    const duration = CONFIG.scrollDuration;
    let startTime = null;

    function animation(currentTime) {
      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
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

  /**
   * [스크롤바 핸들러]
   * 내비게이터에 스크롤 발생 시에만 스크롤바를 표시하고, 멈추면 숨깁니다.
   */
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
