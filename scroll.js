document.addEventListener("DOMContentLoaded", uiInit);

function uiInit() {
  dynamicNavigator({
    scrollToTop: false, // 새로고침 시 상단 이동 여부
    scrollDuration: 500, // 본문 스크롤 이동 속도 (ms)
    debug: true, // [ON] 디버그 모드 켜짐
  });
}

/**
 * [Dynamic Navigator Module]
 * - 기능: Scroll Spy, Smooth Scroll, Dynamic Update
 * - 특징: innerHTML 미사용 (DOM 조작 메서드만 사용)
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
    console.error("[Navigator] Essential DOM elements not found.");
    return;
  }

  init();

  function init() {
    logger("Initializing...");
    refreshNavigator();

    if ("scrollRestoration" in history) {
      history.scrollRestoration = CONFIG.scrollToTop ? "manual" : "auto";
    }
    if (CONFIG.scrollToTop) {
      setTimeout(() => window.scrollTo(0, 0), 0);
      logger("Scrolled to top (Config: scrollToTop=true)");
    }

    bindEvents();
    observeContentChanges();
    updateDimensions();
    updateLayoutPosition();
  }

  /**
   * [Core] 내비게이터 새로고침
   */
  function refreshNavigator() {
    // 1. 파싱
    const structure = parseContentStructure();

    // 2. 타이틀 유무 확인
    if (structure.length === 0) {
      DOM.wrap.style.display = "none";

      // [수정] innerHTML = "" 대신 replaceChildren() 사용 (안전하게 비우기)
      DOM.inner.replaceChildren();

      DOM.navLinks = null;
      STATE.sections = [];
      logger("No visible titles found. Navigator hidden.");
      return;
    } else {
      DOM.wrap.style.display = "block";
    }

    // 3. 렌더링
    // [수정] 기존 내용을 안전하게 비우고 다시 그림
    DOM.inner.replaceChildren();
    renderNavigation(structure);

    updateDimensions();

    // 4. 활성 상태 갱신 (즉시 이동)
    updateActiveState(true);

    logger(`Refreshed. Structure count: ${structure.length}`);
  }

  // =================================================================
  // [2] 파싱 로직
  // =================================================================
  function parseContentStructure() {
    const [h1Sel, h2Sel] = CONFIG.selectors.titles;
    const h1List = document.querySelectorAll(h1Sel);
    const result = [];

    h1List.forEach((h1, idx) => {
      if (!isVisible(h1)) {
        // logger(`Skipped hidden Depth 1: "${h1.textContent.trim()}"`);
        return;
      }

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

  // =================================================================
  // [3] 렌더링 로직 (DOM Creation)
  // =================================================================
  function renderNavigation(structure) {
    const navEl = document.createElement("nav");
    navEl.className = CONFIG.selectors.nav;
    navEl.setAttribute("role", "navigation");
    navEl.setAttribute("aria-label", "문서 목차");

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

  function createButton(data) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `${data.type}--item`;

    const span = document.createElement("span");
    span.className = `${data.type}--text`;
    // innerHTML 대신 textContent 사용 (안전)
    span.textContent = data.text.trim();

    btn.appendChild(span);
    btn.dataset.target = data.id;
    btn.addEventListener("click", handleNavClick);
    return btn;
  }

  // =================================================================
  // [4] 이벤트 감시 및 반응
  // =================================================================
  function bindEvents() {
    let tick = false;

    window.addEventListener(
      "scroll",
      () => {
        updateLayoutPosition();
        if (!tick) {
          window.requestAnimationFrame(() => {
            updateActiveState(false);
            tick = false;
          });
          tick = true;
        }
      },
      { passive: true }
    );

    const handleResize = () => {
      updateDimensions();
      updateLayoutPosition();
      updateActiveState(false);
    };
    window.addEventListener("resize", handleResize);

    if (DOM.header) {
      new ResizeObserver(handleResize).observe(DOM.header);
    }
  }

  function observeContentChanges() {
    if (!DOM.content) {
      logger("MutationObserver content area not found. Skipping observation.");
      return;
    }

    let debounceTimer;
    const observerCallback = (mutations) => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        logger("DOM change detected (MutationObserver). Refreshing...");
        refreshNavigator();
      }, 200);
    };

    const observer = new MutationObserver(observerCallback);
    observer.observe(DOM.content, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class", "hidden"],
    });

    logger("MutationObserver started.");
  }

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
      if (DOM.navLinks && DOM.navLinks.length > 0) {
        activateButton(DOM.navLinks[0], isInstant);
      }
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

  function handleNavClick(e) {
    const targetBtn = e.currentTarget;
    const targetId = targetBtn.dataset.target;
    logger(`Clicked: "${targetBtn.textContent.trim()}" (ID: ${targetId})`);

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
    } else {
      logger(`Target element not found: ${targetId}`);
    }
  }

  // =================================================================
  // [5] UI 유틸리티
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
