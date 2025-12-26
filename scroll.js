// DOM이 모두 로드된 후 스크립트를 실행합니다.
document.addEventListener("DOMContentLoaded", function () {
  function initializeDynamicNavigator() {
    // 페이지 로드 시 최상단으로 스크롤할지 여부를 제어하는 내부 플래그
    const shouldScrollToTopOnRefresh = false; // true: 최상단으로 스크롤, false: 스크롤 위치 기억

    // 브라우저의 스크롤 복원 동작을 설정
    if ("scrollRestoration" in history) {
      history.scrollRestoration = shouldScrollToTopOnRefresh
        ? "manual"
        : "auto";
    }

    // 페이지 로드 시 최상단으로 스크롤하는 함수
    function scrollToTop() {
      window.scrollTo({ top: 0, behavior: "instant" });
    }

    // shouldScrollToTopOnRefresh가 true일 경우에만 최상단으로 스크롤
    if (shouldScrollToTopOnRefresh) {
      setTimeout(() => {
        scrollToTop();
      }, 0);
    }

    // 기존의 단순한 네비게이션 핸들러(중복되거나 사용되지 않음)는 제거했습니다.

    // navigation-related sections.
    // 현재 스크롤 위치를 추적하고, 해당 위치에 따라 네비게이션 버튼의 활성 상태를 업데이트합니다.

    // 동적으로 ID를 부여하고 data-target 속성을 설정하며 navigator를 생성하는 함수
    function buildDynamicNavigator() {
      const dynamicNavigator = document.getElementById("dynamic-navigator");
      if (!dynamicNavigator) return;
      // add class so CSS can use class selectors instead of IDs
      dynamicNavigator.classList.add("dynamic-navigator");

      const depth1Ul = document.createElement("ul");
      depth1Ul.classList.add("depth1");

      const h1Titles = document.querySelectorAll(".dev_contents .h1_title");

      h1Titles.forEach((h1, h1Index) => {
        const h1Id = `h1-title-${h1Index + 1}`;
        h1.dataset.sectionId = h1Id; // data-section-id로 참조
        h1.tabIndex = -1; // h1 요소에 tabindex="-1" 추가

        const depth1Li = document.createElement("li");
        const depth1Button = document.createElement("button");
        depth1Button.type = "button";
        depth1Button.classList.add("depth1--item");
        depth1Button.dataset.target = h1Id;
        depth1Button.textContent = h1.textContent.trim();

        const depth2Ul = document.createElement("ul");
        depth2Ul.classList.add("depth2");

        const currentH1 = h1;
        const h2ElementsForCurrentH1 = [];
        let nextSibling = currentH1.nextElementSibling;

        while (nextSibling && !nextSibling.classList.contains("h1_title")) {
          if (nextSibling.classList.contains("h2_title")) {
            h2ElementsForCurrentH1.push(nextSibling);
          } else if (nextSibling.classList.contains("desc")) {
            // If there's a 'desc' div, check for h2_title within it
            const h2InDesc = nextSibling.querySelector(".h2_title");
            if (h2InDesc) {
              h2ElementsForCurrentH1.push(h2InDesc);
            }
          }
          nextSibling = nextSibling.nextElementSibling;
        }

        h2ElementsForCurrentH1.forEach((h2, h2Index) => {
          const h2Id = `h2-title-${h1Index + 1}-${h2Index + 1}`;
          h2.dataset.sectionId = h2Id; // data-section-id로 참조
          h2.tabIndex = -1; // h2 요소에 tabindex="-1" 추가

          const depth2Li = document.createElement("li");
          const depth2Button = document.createElement("button");
          depth2Button.type = "button";
          depth2Button.classList.add("depth2--item");
          depth2Button.dataset.target = h2Id;
          depth2Button.textContent = h2.textContent.trim();

          depth2Li.appendChild(depth2Button);
          depth2Ul.appendChild(depth2Li);
        });

        depth1Li.appendChild(depth1Button);
        depth1Li.appendChild(depth2Ul);
        depth1Ul.appendChild(depth1Li);
      });

      // wrap content in inner container so panel background can fill full height
      const inner = document.createElement("div");
      inner.classList.add("dynamic-navigator__inner");
      inner.appendChild(depth1Ul);
      dynamicNavigator.appendChild(inner);
      // attach scrollbar visibility handler: show thin scrollbar only while scrolling
      try {
        attachScrollbarVisibilityHandler(inner);
      } catch (e) {
        // non-fatal
      }
      // 접근성: 내비게이션 역할과 레이블 추가
      dynamicNavigator.setAttribute("role", "navigation");
      dynamicNavigator.setAttribute("aria-label", "문서 목차");

      // 이벤트 위임을 사용하여 클릭 이벤트 처리
      dynamicNavigator.addEventListener("click", function (event) {
        const clickedButton = event.target.closest(
          ".depth1--item, .depth2--item"
        );
        if (clickedButton) {
          // 클릭 즉시 네비게이션 상태 업데이트 (스크린리더에 즉시 알림)
          const navButtonsNow = dynamicNavigator.querySelectorAll(
            ".depth1--item, .depth2--item"
          );
          navButtonsNow.forEach((btn) => {
            btn.classList.remove("active-nav-item");
            btn.removeAttribute("aria-current");
          });
          clickedButton.classList.add("active-nav-item");
          clickedButton.setAttribute("aria-current", "true");
          // if a depth2 item was clicked, also activate its parent depth1
          try {
            setParentActiveForDepth2(clickedButton);
          } catch (e) {}

          const targetId = clickedButton.dataset.target;
          const targetElement = document.querySelector(
            `[data-section-id="${targetId}"]`
          ); // id 대신 data-section-id 사용
          const headerDev = document.getElementById("headerDev");
          const headerHeight = headerDev ? headerDev.offsetHeight : 0;

          if (targetElement) {
            const targetY = targetElement.offsetTop - headerHeight;
            window.scrollTo({
              top: targetY,
              behavior: "smooth",
            });
            // 스크롤 완료 후 포커스 이동: focus 시 불필요한 스크롤을 방지
            let scrollEndTimer;
            const onScrollEnd = () => {
              clearTimeout(scrollEndTimer);
              scrollEndTimer = setTimeout(() => {
                if (targetElement) {
                  try {
                    targetElement.focus({ preventScroll: true });
                  } catch (e) {
                    // 일부 브라우저는 옵션을 지원하지 않을 수 있으므로 폴백
                    targetElement.focus();
                  }
                }
                window.removeEventListener("scroll", onScrollEnd);
              }, 100); // 스크롤이 100ms 동안 멈추면 완료된 것으로 간주
            };
            window.addEventListener("scroll", onScrollEnd);
          }
        }
      });
    }

    // Attach a scroll handler to show a thin scrollbar while the user scrolls.
    function attachScrollbarVisibilityHandler(innerEl) {
      if (!innerEl) return;
      const showClass = "show-scrollbar";
      let timer = null;
      const onScroll = () => {
        innerEl.classList.add(showClass);
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          innerEl.classList.remove(showClass);
          timer = null;
        }, 600);
      };
      innerEl.addEventListener("scroll", onScroll, { passive: true });
      // store cleanup helper on element
      innerEl.__removeScrollbarHandler = function () {
        try {
          innerEl.removeEventListener("scroll", onScroll);
        } catch (e) {}
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        innerEl.classList.remove(showClass);
        try {
          delete innerEl.__removeScrollbarHandler;
        } catch (e) {}
      };
    }

    // When a depth2 item is active, also mark its parent depth1 button active.
    function setParentActiveForDepth2(itemButton) {
      if (!itemButton) return;
      if (!itemButton.classList.contains("depth2--item")) return;
      // find the depth1 li that contains this depth2 list
      const depth2Ul = itemButton.closest("ul.depth2");
      if (!depth2Ul) return;
      const depth1Li = depth2Ul.closest("li");
      if (!depth1Li) return;
      const parentDepth1Button = depth1Li.querySelector(".depth1--item");
      if (!parentDepth1Button) return;
      parentDepth1Button.classList.add("active-nav-item");
      parentDepth1Button.setAttribute("aria-current", "true");
    }

    // 스크롤 위치에 따라 활성 네비게이션 버튼을 업데이트하는 함수
    function updateActiveNavItem() {
      const headerHeight =
        document.getElementById("headerDev")?.offsetHeight || 0;
      const scrollPosition =
        document.documentElement.scrollTop + headerHeight + 10;

      let currentActiveId = null;

      const allNavButtons = document.querySelectorAll(
        ".dynamic-navigator .depth1--item, .dynamic-navigator .depth2--item"
      );

      // 모든 h1_title 및 h2_title 요소를 가져옵니다.
      const sections = document.querySelectorAll(
        ".dev_contents .h1_title, .dev_contents .h2_title"
      );

      // 스크롤이 페이지 하단에 도달했는지 확인
      const isAtBottom =
        window.innerHeight + document.documentElement.scrollTop >=
        document.documentElement.scrollHeight - 5;

      if (isAtBottom) {
        allNavButtons.forEach((button) => {
          button.classList.remove("active-nav-item");
          button.removeAttribute("aria-current"); // aria-current 속성 제거
        });
        const lastNavButton = allNavButtons[allNavButtons.length - 1];
        if (lastNavButton) {
          lastNavButton.classList.add("active-nav-item");
          lastNavButton.setAttribute("aria-current", "true"); // aria-current 속성 추가
          try {
            setParentActiveForDepth2(lastNavButton);
          } catch (e) {}
        }
        return;
      }

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i];
        if (section.offsetTop <= scrollPosition) {
          currentActiveId = section.dataset.sectionId; // id 대신 data-section-id 사용
          break;
        }
      }

      allNavButtons.forEach((button) => {
        button.classList.remove("active-nav-item");
        button.removeAttribute("aria-current"); // aria-current 속성 제거
      });

      if (currentActiveId) {
        const activeNavButton = document.querySelector(
          `[data-target="${currentActiveId}"]`
        );
        if (activeNavButton) {
          activeNavButton.classList.add("active-nav-item");
          activeNavButton.setAttribute("aria-current", "true"); // aria-current 속성 추가
          try {
            setParentActiveForDepth2(activeNavButton);
          } catch (e) {}
        }
      }
    }

    buildDynamicNavigator(); // 페이지 로드 시 동적 네비게이터 생성 함수 실행
    // 스크롤 이벤트 리스너 추가
    window.addEventListener("scroll", updateActiveNavItem);
    // 페이지 로드 시 한 번 실행하여 초기 상태 설정
    updateActiveNavItem();

    // Dynamic positioning: set inner container top = headerHeight + 80px
    function updateDynamicNavigatorPosition() {
      const dynamicNavigator = document.getElementById("dynamic-navigator");
      if (!dynamicNavigator) return;
      const headerDev = document.getElementById("headerDev");
      const headerHeight = headerDev ? headerDev.offsetHeight : 0;
      const topOffset = headerHeight + 80; // user requested offset

      // apply inline styles to inner container so the panel background can remain full-height
      const innerEl = dynamicNavigator.querySelector(
        ".dynamic-navigator__inner"
      );
      const targetEl = innerEl || dynamicNavigator;
      if (!targetEl.style.transition) {
        targetEl.style.transition = "top 240ms ease, height 240ms ease";
      }
      targetEl.style.top = topOffset + "px";
      // set height so it fits remaining viewport below the offset
      const remaining = window.innerHeight - topOffset;
      targetEl.style.height = (remaining > 0 ? remaining : 0) + "px";
    }

    // observe header size changes in real-time
    const headerElement = document.getElementById("headerDev");
    if (headerElement && window.ResizeObserver) {
      const ro = new ResizeObserver(() => {
        updateDynamicNavigatorPosition();
      });
      ro.observe(headerElement);
      // store observer on element for potential cleanup (not strictly necessary here)
      headerElement.__dynamicNavResizeObserver = ro;
    } else if (headerElement) {
      // fallback to mutation observer if ResizeObserver not supported
      const mo = new MutationObserver(() => updateDynamicNavigatorPosition());
      mo.observe(headerElement, {
        attributes: true,
        childList: true,
        subtree: true,
      });
      headerElement.__dynamicNavMutationObserver = mo;
    }

    // update on window resize as well
    window.addEventListener("resize", updateDynamicNavigatorPosition);
    // initial call
    updateDynamicNavigatorPosition();
    // cleanup observers and listeners on unload to avoid leaks
    function cleanupDynamicNavigator() {
      if (headerElement) {
        if (headerElement.__dynamicNavResizeObserver) {
          try {
            headerElement.__dynamicNavResizeObserver.disconnect();
          } catch (e) {}
          delete headerElement.__dynamicNavResizeObserver;
        }
        if (headerElement.__dynamicNavMutationObserver) {
          try {
            headerElement.__dynamicNavMutationObserver.disconnect();
          } catch (e) {}
          delete headerElement.__dynamicNavMutationObserver;
        }
      }
      // remove scrollbar handler on inner navigator if present
      try {
        const dynNav = document.getElementById("dynamic-navigator");
        if (dynNav) {
          const innerEl = dynNav.querySelector(".dynamic-navigator__inner");
          if (
            innerEl &&
            typeof innerEl.__removeScrollbarHandler === "function"
          ) {
            try {
              innerEl.__removeScrollbarHandler();
            } catch (e) {}
          }
        }
      } catch (e) {}
      window.removeEventListener("resize", updateDynamicNavigatorPosition);
      window.removeEventListener("scroll", updateActiveNavItem);
      window.removeEventListener("beforeunload", cleanupDynamicNavigator);
    }
    window.addEventListener("beforeunload", cleanupDynamicNavigator);
  }
  initializeDynamicNavigator();
});
