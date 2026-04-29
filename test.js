function bindEvents(el) {
  const { handleBtn, orderCurrent } = el;

  const targets = [handleBtn, orderCurrent].filter(Boolean);

  const onTouchMove = (e) => {
    // 실행 코드1
  };

  const onTouchStart = (e) => {
    // 실행 코드2
  };

  const onTouchEnd = (e) => {
    // 실행 코드3
  };

  targets.forEach((target) => {
    // Pointer 이벤트는 모바일/데스크탑 모두 대응 가능하므로 유지
    // passive: false를 주어 필요 시 e.preventDefault()를 사용할 수 있게 함 (드래그 기능 시 필수)
    target.addEventListener("pointermove", onTouchMove, { passive: false });
    target.addEventListener("pointerdown", onTouchStart, { passive: false });
    target.addEventListener("pointerup", onTouchEnd);
  });
}
function test01() {
  if (options.status === "max") {
    popContent.addEventListener("touchstart", (e) => {
      pagePanel && pagePanel.classList.add("hidden");
      onStart(e, el);
      toggleClass();
    });
    popContent.addEventListener("touchmove", (e) => {
      onMove(e, el);
      toggleClass();
    });
    popContent.addEventListener("touchend", (e) => {
      pagePanel && pagePanel.classList.add("hidden");
      onEnd(e, el);
      toggleClass();
    });
  } else {
    slidePanel.addEventListener("touchstart", (e) => {
      pagePanel && pagePanel.classList.add("hidden");
      onStart(e, el);
      toggleClass();
    });
    slidePanel.addEventListener("touchmove", (e) => {
      onMove(e, el);
      toggleClass();
    });
    slidePanel.addEventListener("touchend", (e) => {
      pagePanel && pagePanel.classList.add("hidden");
      onEnd(e, el);
      toggleClass();
    });
  }
}

function test02() {
  // 1. 이벤트가 바인딩될 타겟 요소를 먼저 결정합니다.
  const targetElement = options.status === "max" ? popContent : slidePanel;

  // 타겟 요소가 없을 경우 에러 방지
  if (!targetElement) return;

  // 2. 반복되는 UI 로직을 작은 함수로 정의합니다 (가독성 UP)
  // Optional Chaining (?.)을 사용하여 pagePanel이 있을 때만 동작하도록 안전하게 처리
  const hidePagePanel = () => pagePanel?.classList.add("hidden");

  // 3. 각 이벤트별로 실행할 로직을 정의합니다.
  // 여기서 onStart, onMove, onEnd를 구분해서 넣었습니다.
  const eventConfig = {
    touchstart: {
      handler: (e) => {
        hidePagePanel();
        onStart(e, el);
        toggleClass();
      },
      options: { passive: true }, // 스크롤 성능 최적화
    },
    touchmove: {
      handler: (e) => {
        onMove(e, el);
        toggleClass();
      },
      options: { passive: false }, // 드래그 중 브라우저 스크롤 방지 필요 시 false
    },
    touchend: {
      handler: (e) => {
        hidePagePanel();
        onEnd(e, el);
        toggleClass();
      },
      options: { passive: true },
    },
  };

  // 4. 설정된 이벤트를 반복문을 통해 바인딩합니다.
  Object.entries(eventConfig).forEach(([eventType, config]) => {
    targetElement.addEventListener(eventType, config.handler, config.options);
  });
}
