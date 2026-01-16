document.addEventListener("DOMContentLoaded", () => {
  const nav = uiInit();
});

function uiInit() {
  return dynamicNavigator({
    // [옵션] true: 부드럽게 이동, false: 즉시 이동
    smoothScroll: true,

    scrollToTop: false,
    scrollDuration: 500,
    debug: true,
  });
}

function dynamicNavigator(options = {}) {
  // =================================================================
  // [1] 설정 및 상태 관리
  // =================================================================
  const CONFIG = {
    smoothScroll: options.smoothScroll ?? true,
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
      top: 40,
      scrollSpyBuffer: 32, // 버퍼값 유지 (너무 늘릴 필요 없음)
      bottomBuffer: 0,
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

  return { refresh: refreshNavigator, destroy: destroy };

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
    removeExistingNav();
    const structure = parseContentStructure();
    if (structure.length === 0) {
      DOM.wrap.style.display = "none";
      DOM.navLinks = null;
      STATE.sections = [];
      logger("표시할 목차가 없어 숨깁니다.");
      return;
    } else {
      DOM.wrap.style.display = "block";
    }
    renderNavigation(structure);
    updateDimensions();
    updateLayoutPosition();
    updateActiveState(true);
    logger(`갱신 완료. (총 ${structure.length}개 챕터)`);
  }

  function removeExistingNav() {
    const oldNav = DOM.inner.querySelector(`.${CONFIG.selectors.nav}`);
    if (oldNav) oldNav.remove();
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

  // [4] 계산 및 상태 업데이트 내부함수
  function updateActiveState(isInstant = false) {
    const scrollBehavior = isInstant ? "auto" : "smooth";

    // =================================================================
    // [1] 문서 최하단 도달 시 처리 (가장 강력한 우선순위)
    // =================================================================
    // 스크롤이 끝까지 내려왔는지 확인 (소수점 오차 보정 -2)
    const isBottom = window.scrollY + STATE.winHeight >= STATE.docHeight - 2;

    if (isBottom) {
      if (DOM.navLinks && DOM.navLinks.length > 0) {
        // 무조건 '가장 마지막 버튼'을 가져옴
        const lastBtn = DOM.navLinks[DOM.navLinks.length - 1];

        // 해당 버튼 활성화 (이 함수 내부에서 부모/자식 관계도 같이 켜짐)
        activateButton(lastBtn, isInstant);

        // 내비게이터 스크롤도 끝으로 이동
        const navEl = DOM.inner.querySelector(`.${CONFIG.selectors.nav}`);
        if (navEl)
          navEl.scrollTo({ top: navEl.scrollHeight, behavior: scrollBehavior });
      }
      return; // 여기서 함수 종료 (더 이상 계산 안 함)
    }

    // =================================================================
    // [2] 문서 최상단 처리
    // =================================================================
    if (window.scrollY <= 0) {
      if (DOM.navLinks && DOM.navLinks.length > 0)
        activateButton(DOM.navLinks[0], isInstant);
      const navEl = DOM.inner.querySelector(`.${CONFIG.selectors.nav}`);
      if (navEl) navEl.scrollTo({ top: 0, behavior: scrollBehavior });
      return;
    }

    // =================================================================
    // [3] 중간 영역: 실시간 화면 위치 감지 (getBoundingClientRect)
    // =================================================================
    // "기준선": 헤더 높이 + 버퍼 (약간의 여유공간)
    const cutOffLine = STATE.headerHeight + CONFIG.offset.scrollSpyBuffer;

    let activeCandidate = null;

    // 모든 섹션을 순회하면서 "기준선보다 위에 있는(지나친) 섹션" 중 가장 마지막 녀석을 찾음
    STATE.sections.forEach((sec) => {
      const targetElem = document.querySelector(
        `[${CONFIG.attrName}="${sec.id}"]`
      );
      if (targetElem) {
        // rect.top: 눈에 보이는 현재 위치
        const rect = targetElem.getBoundingClientRect();

        // 요소의 머리가 기준선보다 위로 올라갔거나 걸쳤다면?
        if (rect.top <= cutOffLine + 2) {
          activeCandidate = sec.btn;
        }
      }
    });

    if (activeCandidate) {
      activateButton(activeCandidate, isInstant);
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

    // [중요 수정] 클릭 시점에 좌표 강제 갱신 (데이터 불일치 방지)
    updateDimensions();

    const targetElem = document.querySelector(
      `[${CONFIG.attrName}="${targetId}"]`
    );
    if (targetElem) {
      const targetTop =
        targetElem.getBoundingClientRect().top +
        window.scrollY -
        STATE.headerHeight;

      if (CONFIG.smoothScroll) {
        smoothScrollTo(targetTop, () =>
          targetElem.focus({ preventScroll: true })
        );
      } else {
        window.scrollTo(0, targetTop);
        targetElem.focus({ preventScroll: true });
      }
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
