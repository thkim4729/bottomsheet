document.addEventListener("DOMContentLoaded", uiInit);

function uiInit() {
  dynamicNavigator({
    scrollToTop: false,
    scrollDuration: 500,
  });
}

function dynamicNavigator(options = {}) {
  const CONFIG = {
    scrollToTop:
      typeof options.scrollToTop !== "undefined" ? options.scrollToTop : false,
    scrollDuration: options.scrollDuration || 500,

    selectors: {
      navigator: ".dynamic-navigator",
      navigatorInner: ".dynamic-navigator__inner",
      header: ".header_dev",
      footer: ".footer_dev",
      sectionTitles: ".dev_contents .h1_title",
      subTitles: ".dev_contents .h2_title",

      desc: ".desc",
      container: ".container",
    },
    classes: {
      active: "active-nav-item",
      showScroll: "show-scrollbar",
    },
    offset: {
      top: 80,
      scrollSpyBuffer: 20,
    },
  };

  const navigatorEl = document.querySelector(CONFIG.selectors.navigator);
  if (!navigatorEl) return;

  // [안전 장치] 본문 대제목(H1)이 없으면 실행 중단
  const targetTitles = document.querySelectorAll(
    CONFIG.selectors.sectionTitles
  );

  if (targetTitles.length === 0) {
    navigatorEl.style.display = "none";
    const container = document.querySelector(CONFIG.selectors.container);
    if (container) {
      container.style.paddingRight = "0";
    }
    return;
  }

  init();

  // --- [내부 함수] ---

  function init() {
    if ("scrollRestoration" in history) {
      history.scrollRestoration = CONFIG.scrollToTop ? "manual" : "auto";
    }
    if (CONFIG.scrollToTop) {
      setTimeout(() => window.scrollTo(0, 0), 0);
    }
    buildDOM();
    bindEvents();
  }

  function buildDOM() {
    const innerClass = CONFIG.selectors.navigatorInner.replace(/^\./, "");
    navigatorEl.setAttribute("role", "navigation");
    navigatorEl.setAttribute("aria-label", "문서 목차");

    const depth1Ul = document.createElement("ul");
    depth1Ul.className = "depth1";

    const primaryTitles = document.querySelectorAll(
      CONFIG.selectors.sectionTitles
    );

    primaryTitles.forEach((pTitle, idx) => {
      const pTitleId = pTitle.id || `section-title-${idx + 1}`;
      pTitle.id = pTitleId;
      pTitle.setAttribute("tabindex", "-1");

      const li = document.createElement("li");
      li.appendChild(
        createNavButton(pTitleId, pTitle.textContent, "depth1--item")
      );

      const depth2Ul = buildDepth2DOM(pTitle, idx + 1);
      if (depth2Ul.querySelectorAll("li").length > 0) {
        li.appendChild(depth2Ul);
      }
      depth1Ul.appendChild(li);
    });

    const inner = document.createElement("nav");
    inner.className = innerClass;
    inner.appendChild(depth1Ul);
    navigatorEl.appendChild(inner);

    attachScrollbarHandler(inner);
  }

  function buildDepth2DOM(currentPTitle, pIndex) {
    const ul = document.createElement("ul");
    ul.className = "depth2";
    const marker = document.createElement("span");
    marker.className = "nav-marker";
    marker.setAttribute("aria-hidden", "true");
    ul.appendChild(marker);

    let nextNode = currentPTitle.nextElementSibling;
    let sIndex = 0;

    while (nextNode && !nextNode.matches(CONFIG.selectors.sectionTitles)) {
      let targetSTitle = null;

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

  function createNavButton(targetId, text, className) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = className;
    btn.textContent = text.trim();
    btn.dataset.target = targetId;
    btn.addEventListener("click", handleNavClick);
    return btn;
  }

  function handleNavClick(e) {
    const targetId = e.currentTarget.dataset.target;
    const targetElement = document.getElementById(targetId);

    // [변경] siteHeader -> header
    const header = document.querySelector(CONFIG.selectors.header);
    const headerHeight = header ? header.offsetHeight : 0;

    if (targetElement) {
      const targetY =
        targetElement.getBoundingClientRect().top +
        window.scrollY -
        headerHeight;

      smoothScrollTo(targetY, CONFIG.scrollDuration, () => {
        targetElement.focus({ preventScroll: true });
        if (document.activeElement !== targetElement) {
          targetElement.focus({ preventScroll: true });
        }
      });
    }
  }

  function smoothScrollTo(targetPosition, duration, callback) {
    const startPosition = window.scrollY;
    const distance = targetPosition - startPosition;
    let startTime = null;
    function animation(currentTime) {
      if (startTime === null) startTime = currentTime;
      const timeElapsed = currentTime - startTime;
      const progress = Math.min(timeElapsed / duration, 1);
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

  function bindEvents() {
    let isScrollingTick = false;

    window.addEventListener(
      "scroll",
      () => {
        updateNavigatorPosition();
        if (!isScrollingTick) {
          window.requestAnimationFrame(() => {
            updateActiveNavItem();
            isScrollingTick = false;
          });
          isScrollingTick = true;
        }
      },
      { passive: true }
    );

    const updatePos = () => {
      updateNavigatorPosition();
      updateActiveNavItem();
    };
    window.addEventListener("resize", updatePos);

    // [변경] siteHeader -> header
    const header = document.querySelector(CONFIG.selectors.header);
    if (header) {
      new ResizeObserver(updatePos).observe(header);
    }

    updatePos();
  }

  function updateActiveNavItem() {
    // [변경] siteHeader -> header
    const header = document.querySelector(CONFIG.selectors.header);
    const headerHeight = header ? header.offsetHeight : 0;
    const scrollY =
      window.scrollY + headerHeight + CONFIG.offset.scrollSpyBuffer;

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
    } else {
      if (currentActiveBtn && window.scrollY > 0) {
        // 활성 상태 유지
      }
    }
  }

  function activateButton(targetBtn) {
    resetActiveStatus();
    targetBtn.classList.add(CONFIG.classes.active);
    targetBtn.setAttribute("aria-current", "true");

    let elementToScroll = targetBtn;

    if (targetBtn.classList.contains("depth2--item")) {
      const parentLi = targetBtn.closest("li");
      const parentUl = parentLi.closest("ul.depth2");
      if (parentUl) {
        const grandParentLi = parentUl.closest("li");
        const depth1Btn = grandParentLi?.querySelector(".depth1--item");

        if (depth1Btn) {
          depth1Btn.classList.add(CONFIG.classes.active);
        }

        const marker = parentUl.querySelector(".nav-marker");
        if (marker) {
          const topPos = parentLi.offsetTop;
          const height = parentLi.offsetHeight;
          marker.style.top = `${topPos}px`;
          marker.style.height = `${height}px`;
          marker.style.opacity = "1";
        }

        if (grandParentLi) {
          elementToScroll = grandParentLi;
        }
      }
    } else {
      const currentLi = targetBtn.closest("li");
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

    elementToScroll.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function resetActiveStatus() {
    navigatorEl.querySelectorAll(`.${CONFIG.classes.active}`).forEach((el) => {
      el.classList.remove(CONFIG.classes.active);
      el.removeAttribute("aria-current");
    });
    navigatorEl
      .querySelectorAll(".nav-marker")
      .forEach((m) => (m.style.opacity = "0"));
  }

  function updateNavigatorPosition() {
    // [변경] siteHeader -> header
    const header = document.querySelector(CONFIG.selectors.header);
    const headerHeight = header ? header.offsetHeight : 0;

    // 이 변수는 여분 여백이 필요할 때 사용 (현재는 headerHeight만 사용)
    const topOffset = headerHeight + CONFIG.offset.top;

    const inner = navigatorEl.querySelector(CONFIG.selectors.navigatorInner);
    if (inner) {
      inner.style.top = `${headerHeight}px`;
    }

    const footer = document.querySelector(CONFIG.selectors.footer);
    if (footer) {
      const footerRect = footer.getBoundingClientRect();
      const winHeight = window.innerHeight;

      if (footerRect.top < winHeight) {
        const overlap = winHeight - footerRect.top;
        navigatorEl.style.bottom = `${overlap}px`;
      } else {
        navigatorEl.style.bottom = "0px";
      }
    }
  }

  function attachScrollbarHandler(innerEl) {
    let timer = null;
    innerEl.addEventListener(
      "scroll",
      () => {
        innerEl.classList.add(CONFIG.classes.showScroll);
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          innerEl.classList.remove(CONFIG.classes.showScroll);
        }, 800);
      },
      { passive: true }
    );
  }
}
