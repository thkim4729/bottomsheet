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
      contentHeaders: ".dev_contents .h1_title",
      contentSubHeaders: ".dev_contents .h2_title",
      desc: ".desc",
    },
    classes: {
      active: "active-nav-item",
      showScroll: "show-scrollbar",
    },
    offset: {
      top: 80, // 기본값(실제로는 JS가 헤더 높이 계산)
      scrollSpyBuffer: 20,
    },
  };

  const navigatorEl = document.querySelector(CONFIG.selectors.navigator);
  if (!navigatorEl) return;

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

    const h1Elements = document.querySelectorAll(
      CONFIG.selectors.contentHeaders
    );

    h1Elements.forEach((h1, idx) => {
      const h1Id = h1.id || `section-h1-${idx + 1}`;
      h1.id = h1Id;
      h1.setAttribute("tabindex", "-1");
      const li = document.createElement("li");
      li.appendChild(createNavButton(h1Id, h1.textContent, "depth1--item"));
      const depth2Ul = buildDepth2DOM(h1, idx + 1);
      if (depth2Ul.querySelectorAll("li").length > 0) {
        li.appendChild(depth2Ul);
      }
      depth1Ul.appendChild(li);
    });

    // [변경] div 대신 nav 태그 사용 (시맨틱)
    const inner = document.createElement("nav");
    inner.className = innerClass;
    inner.appendChild(depth1Ul);
    navigatorEl.appendChild(inner);

    attachScrollbarHandler(inner);
  }

  function buildDepth2DOM(currentH1, h1Index) {
    const ul = document.createElement("ul");
    ul.className = "depth2";
    const marker = document.createElement("span");
    marker.className = "nav-marker";
    marker.setAttribute("aria-hidden", "true");
    ul.appendChild(marker);
    let nextNode = currentH1.nextElementSibling;
    let h2Index = 0;

    while (nextNode && !nextNode.matches(CONFIG.selectors.contentHeaders)) {
      let targetH2 = null;
      if (nextNode.matches(CONFIG.selectors.contentSubHeaders)) {
        targetH2 = nextNode;
      } else if (nextNode.matches(CONFIG.selectors.desc)) {
        targetH2 = nextNode.querySelector(CONFIG.selectors.contentSubHeaders);
      }
      if (targetH2) {
        h2Index++;
        const h2Id = targetH2.id || `section-h2-${h1Index}-${h2Index}`;
        targetH2.id = h2Id;
        targetH2.setAttribute("tabindex", "-1");
        const li = document.createElement("li");
        li.appendChild(
          createNavButton(h2Id, targetH2.textContent, "depth2--item")
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
        // 위치 계산은 즉시 실행 (Lag 방지)
        updateNavigatorPosition();

        // 활성 상태 업데이트는 rAF 사용
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

    const header = document.querySelector(CONFIG.selectors.header);
    if (header) {
      new ResizeObserver(updatePos).observe(header);
    }

    updatePos();
  }

  function updateActiveNavItem() {
    const header = document.querySelector(CONFIG.selectors.header);
    const headerHeight = header ? header.offsetHeight : 0;
    const scrollY =
      window.scrollY + headerHeight + CONFIG.offset.scrollSpyBuffer;

    // 1. 최상단(0)이면 첫 번째 버튼 강제 활성화
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

    // 2. 최하단이면 마지막 버튼 활성화
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

    // 3. 스크롤 스파이 로직
    let currentTargetId = "";
    const sections = document.querySelectorAll(
      `${CONFIG.selectors.contentHeaders}, ${CONFIG.selectors.contentSubHeaders}`
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

    // 스크롤 대상 (기본값: 버튼 자신)
    let elementToScroll = targetBtn;

    // CASE 1: Depth 2 (서브 메뉴)가 타겟인 경우
    if (targetBtn.classList.contains("depth2--item")) {
      const parentLi = targetBtn.closest("li");
      const parentUl = parentLi.closest("ul.depth2");
      if (parentUl) {
        const grandParentLi = parentUl.closest("li");
        const depth1Btn = grandParentLi?.querySelector(".depth1--item");

        // 부모 Depth 1도 같이 활성화
        if (depth1Btn) {
          depth1Btn.classList.add(CONFIG.classes.active);
        }

        // 마커를 현재 타겟(Depth 2) 위치로 이동
        const marker = parentUl.querySelector(".nav-marker");
        if (marker) {
          const topPos = parentLi.offsetTop;
          const height = parentLi.offsetHeight;
          marker.style.top = `${topPos}px`;
          marker.style.height = `${height}px`;
          marker.style.opacity = "1";
        }

        // 스크롤 시 상위 그룹 전체가 보이도록 설정
        if (grandParentLi) {
          elementToScroll = grandParentLi;
        }
      }
    }
    // CASE 2: Depth 1 (메인 메뉴)이 타겟인 경우 -> ★ [추가된 로직]
    else {
      const currentLi = targetBtn.closest("li");

      // 하위 메뉴(Depth 2)가 있는지 확인
      const childUl = currentLi.querySelector("ul.depth2");
      if (childUl) {
        // 첫 번째 자식 버튼 찾기
        const firstChildBtn = childUl.querySelector(".depth2--item");

        if (firstChildBtn) {
          // 첫 번째 자식도 활성화 (색상 변경)
          firstChildBtn.classList.add(CONFIG.classes.active);

          // ★ 마커를 첫 번째 자식 위치로 이동
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

      // Depth 1은 Li 단위로 스크롤 (여백 확보)
      if (currentLi) elementToScroll = currentLi;
    }

    // 화면 자동 스크롤
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
    // 1. 헤더 높이만큼 inner 내려주기 (가림 방지)
    const header = document.querySelector(CONFIG.selectors.header);
    const headerHeight = header ? header.offsetHeight : 0;
    const topOffset = headerHeight + CONFIG.offset.top; // offset.top을 추가 여백으로 활용 가능

    const inner = navigatorEl.querySelector(CONFIG.selectors.navigatorInner);
    if (inner) {
      inner.style.top = `${headerHeight}px`; // 헤더 바로 밑
    }

    // 2. 푸터 충돌 시 bottom 올려주기
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
