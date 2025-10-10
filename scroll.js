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

    // 필요한 요소들을 미리 선택해 변수에 저장합니다.
    const navButtons = document.querySelectorAll(".section_nav__button");
    const navItems = document.querySelectorAll(".section_nav__item");
    // '.section_nav'는 스크롤 대상이 되는 섹션을 의미하는 것으로 보입니다.
    // 만약 다른 클래스라면 해당 클래스로 변경해주세요.
    const sections = document.querySelectorAll(".section_nav");

    /**
     * 스크롤 이벤트 핸들러
     * 스크롤 위치에 따라 해당하는 네비게이션 버튼에 'active' 클래스를 추가합니다.
     */
    window.addEventListener("scroll", function () {
      const windowPosition = document.documentElement.scrollTop; // window.scrollY 대신 document.documentElement.scrollTop 사용

      // 모든 섹션을 순회하며 현재 스크롤 위치와 비교합니다.
      sections.forEach((section, i) => {
        // 섹션의 문서 전체에서의 상단 위치를 계산합니다.
        const sectionTop = section.offsetTop;

        // 스크롤 위치가 섹션의 상단 위치보다 크거나 같으면 해당 네비게이션을 활성화합니다.
        // -2는 약간의 오차를 보정하기 위한 값으로 보입니다.
        if (windowPosition >= sectionTop - 2) {
          // 먼저 모든 버튼에서 'active' 클래스를 제거합니다.
          navButtons.forEach((btn) => btn.classList.remove("active"));
          // 현재 섹션에 해당하는 버튼에만 'active' 클래스를 추가합니다.
          navButtons[i].classList.add("active");
        }
      });
    });

    /**
     * 네비게이션 버튼 클릭 이벤트 핸들러
     * 클릭된 버튼에 해당하는 섹션으로 부드럽게 스크롤하고, 해당 버튼을 활성화합니다.
     */
    navButtons.forEach((button, idx) => {
      button.addEventListener("click", function (event) {
        // a 태그 등의 기본 동작을 막습니다. (필요한 경우)
        event.preventDefault();

        // 클릭된 버튼에 해당하는 섹션의 상단 위치를 가져옵니다.
        const sectionTop = sections[idx].offsetTop;

        // 먼저 모든 버튼에서 'active' 클래스를 제거합니다.
        // navButtons.forEach((btn) => btn.classList.remove("active"));
        // 클릭된 버튼에 'active' 클래스를 추가합니다.
        // this.classList.add("active");

        // 해당 섹션으로 부드럽게 스크롤 이동합니다.
        window.scrollTo({
          top: sectionTop,
          behavior: "smooth",
        });
      });
    });

    // navigation-related sections.
    // 현재 스크롤 위치를 추적하고, 해당 위치에 따라 네비게이션 버튼의 활성 상태를 업데이트합니다.

    // navigator 내의 depth1--item 버튼 클릭 이벤트 핸들러
    // const depth1Buttons = document.querySelectorAll(".navigator .depth1--item");
    // depth1Buttons.forEach((button) => {
    //   button.addEventListener("click", function () {
    //     const targetId = this.dataset.target;
    //     const targetElement = document.getElementById(targetId);

    //     if (targetElement) {
    //       window.scrollTo({
    //         top: targetElement.offsetTop,
    //         behavior: "smooth",
    //       });
    //     }
    //   });
    // });

    // navigator 내의 depth2--item 버튼 클릭 이벤트 핸들러
    // const depth2Buttons = document.querySelectorAll(".navigator .depth2--item");
    // depth2Buttons.forEach((button) => {
    //   button.addEventListener("click", function () {
    //     const targetId = this.dataset.target;
    //     const targetElement = document.getElementById(targetId);

    //     if (targetElement) {
    //       window.scrollTo({
    //         top: targetElement.offsetTop,
    //         behavior: "smooth",
    //       });
    //     }
    //   });
    // });

    // 동적으로 ID를 부여하고 data-target 속성을 설정하며 navigator를 생성하는 함수
    function buildDynamicNavigator() {
      const dynamicNavigator = document.getElementById("dynamic-navigator");
      if (!dynamicNavigator) return;

      const depth1Ul = document.createElement("ul");
      depth1Ul.classList.add("depth1");

      const h1Titles = document.querySelectorAll(".dev_contents .h1_title");

      h1Titles.forEach((h1, h1Index) => {
        const h1Id = `h1-title-${h1Index + 1}`;
        h1.dataset.sectionId = h1Id; // id 대신 data-section-id 사용
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
          h2.dataset.sectionId = h2Id; // id 대신 data-section-id 사용
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

      dynamicNavigator.appendChild(depth1Ul);

      // 이벤트 위임을 사용하여 클릭 이벤트 처리
      dynamicNavigator.addEventListener("click", function (event) {
        const clickedButton = event.target.closest(
          ".depth1--item, .depth2--item"
        );
        if (clickedButton) {
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
            // 스크롤 완료 후 포커스 이동을 위해 새로운 디바운스 메커니즘 사용
            let scrollEndTimer;
            const onScrollEnd = () => {
              clearTimeout(scrollEndTimer);
              scrollEndTimer = setTimeout(() => {
                if (targetElement) {
                  targetElement.focus();
                }
                window.removeEventListener("scroll", onScrollEnd);
              }, 100); // 스크롤이 100ms 동안 멈추면 완료된 것으로 간주
            };
            window.addEventListener("scroll", onScrollEnd);
          }
        }
      });
    }

    // Helper function to wait for scroll to end and then focus
    // function waitForScrollEndAndFocus(targetElement, scrollYTarget) {
    //   let lastScrollY = document.documentElement.scrollTop;
    //   let scrollAnimationId = null; // requestAnimationFrame ID

    //   const checkScroll = () => {
    //     const currentScrollY = document.documentElement.scrollTop;

    //     // 스크롤 위치가 변경되지 않았거나 목표 위치에 충분히 가까워지면
    //     if (
    //       currentScrollY === lastScrollY ||
    //       Math.abs(currentScrollY - scrollYTarget) < 2
    //     ) {
    //       // 2px 허용 오차
    //       if (targetElement) {
    //         targetElement.focus();
    //       }
    //       cancelAnimationFrame(scrollAnimationId); // 애니메이션 루프 중지
    //       return;
    //     }

    //     lastScrollY = currentScrollY;
    //     scrollAnimationId = requestAnimationFrame(checkScroll); // 다음 프레임에 다시 확인
    //   };

    //   scrollAnimationId = requestAnimationFrame(checkScroll); // 스크롤 확인 시작
    // }

    // 스크롤 위치에 따라 활성 네비게이션 버튼을 업데이트하는 함수
    function updateActiveNavItem() {
      const headerHeight =
        document.getElementById("headerDev")?.offsetHeight || 0;
      const scrollPosition =
        document.documentElement.scrollTop + headerHeight + 10;

      let currentActiveId = null;

      const allNavButtons = document.querySelectorAll(
        "#dynamic-navigator .depth1--item, #dynamic-navigator .depth2--item"
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
          lastNavButton.setAttribute("aria-current", "page"); // aria-current 속성 추가
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
          activeNavButton.setAttribute("aria-current", "page"); // aria-current 속성 추가
        }
      }
    }

    buildDynamicNavigator(); // 페이지 로드 시 동적 네비게이터 생성 함수 실행

    // 스크롤 이벤트 리스너 추가
    window.addEventListener("scroll", updateActiveNavItem);
    // 페이지 로드 시 한 번 실행하여 초기 상태 설정
    updateActiveNavItem();
  }
  initializeDynamicNavigator();
});
