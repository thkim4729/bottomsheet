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
    attrName: "data-nav-section",

    selectors: {
      wrap: ".navigator-wrap",
      area: ".navigator-area",
      inner: ".navigator-inner",
      nav: "navigator",

      header: ".header_dev",
      footer: ".footer_dev",

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

  // 자주 쓰는 DOM 요소 캐싱
  const DOM = {
    wrap: document.querySelector(CONFIG.selectors.wrap),
    area: document.querySelector(CONFIG.selectors.area),
    inner: document.querySelector(CONFIG.selectors.inner),
    header: document.querySelector(CONFIG.selectors.header),
    footer: document.querySelector(CONFIG.selectors.footer),
    navLinks: null,
  };

  // 성능 최적화를 위한 상태값 저장소
  const STATE = {
    headerHeight: 0,
    winHeight: 0,
    docHeight: 0,
    sections: [],
  };

  if (!DOM.wrap || !DOM.area || !DOM.inner) return;

  init();

  function init() {
    const structure = parseContentStructure();
    if (structure.length === 0) {
      DOM.wrap.style.display = "none";
      return;
    }

    if ("scrollRestoration" in history) {
      history.scrollRestoration = CONFIG.scrollToTop ? "manual" : "auto";
    }
    if (CONFIG.scrollToTop) setTimeout(() => window.scrollTo(0, 0), 0);

    renderNavigation(structure);
    bindEvents();
    updateDimensions();
    updateLayoutPosition();
  }

  // =================================================================
  // [2] 파싱 로직
  // =================================================================
  function parseContentStructure() {
    const [h1Sel, h2Sel] = CONFIG.selectors.titles;
    const h1List = document.querySelectorAll(h1Sel);
    const result = [];

    h1List.forEach((h1, idx) => {
      const h1Id = getOrSetNavAttribute(h1, idx + 1, "nav-sec");
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
  // [3] 렌더링 로직
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
    span.textContent = data.text.trim();

    btn.appendChild(span);
    btn.dataset.target = data.id;
    btn.addEventListener("click", handleNavClick);
    return btn;
  }

  // =================================================================
  // [4] 이벤트 및 업데이트 로직
  // =================================================================
  function bindEvents() {
    let tick = false;

    window.addEventListener(
      "scroll",
      () => {
        updateLayoutPosition();
        if (!tick) {
          window.requestAnimationFrame(() => {
            updateActiveState();
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
      updateActiveState();
    };
    window.addEventListener("resize", handleResize);

    if (DOM.header) {
      new ResizeObserver(handleResize).observe(DOM.header);
    }
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
          if (!targetElem) return null;
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

  function updateActiveState() {
    const scrollY =
      window.scrollY + STATE.headerHeight + CONFIG.offset.scrollSpyBuffer;

    if (window.scrollY <= 0) {
      if (DOM.navLinks.length > 0) activateButton(DOM.navLinks[0]);
      return;
    }

    if (window.scrollY + STATE.winHeight >= STATE.docHeight - 5) {
      const lastBtn = DOM.navLinks[DOM.navLinks.length - 1];
      activateButton(lastBtn);

      const navEl = DOM.inner.querySelector(`.${CONFIG.selectors.nav}`);
      if (navEl)
        navEl.scrollTo({ top: navEl.scrollHeight, behavior: "smooth" });
      return;
    }

    for (let i = STATE.sections.length - 1; i >= 0; i--) {
      const sec = STATE.sections[i];
      if (scrollY >= sec.top) {
        activateButton(sec.btn);
        break;
      }
    }
  }

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
  // [5] UI 유틸리티
  // =================================================================
  function activateButton(targetBtn) {
    if (!targetBtn || targetBtn.classList.contains(CONFIG.classes.active))
      return;

    resetActiveStatus();

    targetBtn.classList.add(CONFIG.classes.active);
    targetBtn.setAttribute("aria-current", "true");

    const li = targetBtn.closest("li");
    const parentUl = li.parentElement;

    // 스크롤 대상 변수 (항상 Depth 1 그룹 전체를 보이게 하기 위해 부모 설정)
    let scrollTargetElement = li;

    if (parentUl.classList.contains("depth2")) {
      moveMarker(parentUl, li);

      const parentDepth1Li = parentUl.closest("li");
      const parentDepth1Btn = parentDepth1Li?.querySelector(".depth1--item");
      if (parentDepth1Btn) parentDepth1Btn.classList.add(CONFIG.classes.active);

      // Depth 2 활성 시, 부모 Depth 1 그룹을 타겟으로 함
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

    // [원복] 복잡한 계산 없이, 가장 기본적인 'nearest' 사용
    // 아이템이 화면 밖으로 나갔을 때만 화면 안으로 들어오도록 최소한으로 이동
    scrollTargetElement.scrollIntoView({
      behavior: "smooth",
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
