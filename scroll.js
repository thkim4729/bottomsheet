document.addEventListener("DOMContentLoaded", () => {
  const nav = uiInit();
});

function uiInit() {
  return dynamicNavigator({
    scrollToTop: false,
    scrollDuration: 500,
    debug: true,
  });
}

/**
 * [Dynamic Navigator Module]
 * - 기능: 목차 자동 생성, 스크롤 스파이, 스무스 스크롤
 * - 수정됨: HTML에 작성된 브레드크럼(경로)은 절대 건드리지 않습니다.
 * - 수정됨: 오직 .navigator(목차 리스트) 요소만 생성/삭제/관리합니다.
 */
function dynamicNavigator(options = {}) {
  // =================================================================
  // [1] 설정 및 상태 관리
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

      nav: "navigator", // 생성될 목록의 클래스명

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

  init();

  return {
    refresh: refreshNavigator,
    destroy: destroy,
  };

  // =================================================================
  // [2] 생명주기 관리
  // =================================================================
  function init() {
    logger("초기화 시작...");
    refreshNavigator();

    if ("scrollRestoration" in history) {
      history.scrollRestoration = CONFIG.scrollToTop ? "manual" : "auto";
    }
    if (CONFIG.scrollToTop) {
      setTimeout(() => window.scrollTo(0, 0), 0);
    }

    bindEvents();
    observeContentChanges();
  }

  function refreshNavigator() {
    // 1. 기존에 스크립트가 만든 네비게이터가 있다면 제거 (브레드크럼은 건드리지 않음)
    removeExistingNav();

    const structure = parseContentStructure();

    // 2. 타이틀이 없으면 내비게이터 래퍼 자체를 숨김
    if (structure.length === 0) {
      DOM.wrap.style.display = "none";
      DOM.navLinks = null;
      STATE.sections = [];
      logger("표시할 목차가 없어 숨깁니다.");
      return;
    } else {
      DOM.wrap.style.display = "block";
    }

    // 3. 목차 생성 및 추가
    renderNavigation(structure);

    updateDimensions();
    updateLayoutPosition();
    updateActiveState(true); // 즉시 이동

    logger(`갱신 완료. (총 ${structure.length}개 챕터)`);
  }

  /**
   * [중요] 기존 목차(<nav>)만 찾아서 삭제합니다.
   * innerHTML = "" 이나 replaceChildren()을 쓰면 브레드크럼까지 날아가므로 사용 금지.
   */
  function removeExistingNav() {
    const oldNav = DOM.inner.querySelector(`.${CONFIG.selectors.nav}`);
    if (oldNav) {
      oldNav.remove();
    }
  }

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

    // 종료 시에도 목록만 제거 (브레드크럼 보존)
    removeExistingNav();
    if (DOM.wrap) DOM.wrap.style.display = "none";

    logger("종료 완료.");
  }

  // =================================================================
  // [3] 파싱 및 렌더링
  // =================================================================
  function parseContentStructure() {
    const [h1Sel, h2Sel] = CONFIG.selectors.titles;
    const h1List = document.querySelectorAll(h1Sel);
    const result = [];

    h1List.forEach((h1, idx) => {
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

    // [중요] appendChild를 사용해 기존 요소(브레드크럼) 뒤에 목차를 추가합니다.
    DOM.inner.appendChild(navEl);

    DOM.navLinks = navEl.querySelectorAll("button");
    attachScrollbarHandler(navEl);
  }

  // =================================================================
  // [4] 계산 및 상태 업데이트
  // =================================================================
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

  function updateActiveState(isInstant = false) {
    const scrollY =
      window.scrollY + STATE.headerHeight + CONFIG.offset.scrollSpyBuffer;
    const scrollBehavior = isInstant ? "auto" : "smooth";

    if (window.scrollY <= 0) {
      if (DOM.navLinks && DOM.navLinks.length > 0)
        activateButton(DOM.navLinks[0], isInstant);
      const navEl = DOM.inner.querySelector(`.${CONFIG.selectors.nav}`);
      if (navEl) navEl.scrollTo({ top: 0, behavior: scrollBehavior });
      return;
    }

    if (window.scrollY + STATE.winHeight >= STATE.docHeight - 5) {
      if (DOM.navLinks && DOM.navLinks.length > 0) {
        const lastBtn = DOM.navLinks[DOM.navLinks.length - 1];
        activateButton(lastBtn, isInstant);
        const navEl = DOM.inner.querySelector(`.${CONFIG.selectors.nav}`);
        if (navEl)
          navEl.scrollTo({ top: navEl.scrollHeight, behavior: scrollBehavior });
      }
      return;
    }

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
  // [5] 이벤트 핸들러
  // =================================================================
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

  function onResize() {
    updateDimensions();
    updateLayoutPosition();
    updateActiveState(false);
  }

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

  function bindEvents() {
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    if (DOM.header) {
      STATE.resizeObserver = new ResizeObserver(onResize);
      STATE.resizeObserver.observe(DOM.header);
    }
  }

  function observeContentChanges() {
    if (!DOM.content) return;

    const observerCallback = () => {
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
  // [6] 유틸리티
  // =================================================================
  function activateButton(targetBtn, isInstant = false) {
    if (!targetBtn || targetBtn.classList.contains(CONFIG.classes.active))
      return;

    resetActiveStatus();
    targetBtn.classList.add(CONFIG.classes.active);
    targetBtn.setAttribute("aria-current", "true");

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

    const behavior = isInstant ? "auto" : "smooth";
    scrollTargetElement.scrollIntoView({
      behavior: behavior,
      block: "nearest",
    });
  }

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

  function moveMarker(ul, activeLi) {
    const marker = ul.querySelector(".nav-marker");
    if (marker && activeLi) {
      marker.style.top = `${activeLi.offsetTop}px`;
      marker.style.height = `${activeLi.offsetHeight}px`;
      marker.style.opacity = "1";
    }
  }

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

  function isVisible(el) {
    return el.offsetParent !== null;
  }

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
