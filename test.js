function bindEvents(el) {
  const { handleBtn, orderCurrent } = el;
  const customEvent = document.createEvent("Event");
  customEvent.initEvent("click", false, true);

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
    target.addEventListener("pointermove", onTouchMove);
    target.addEventListener("pointerdown", onTouchStart);
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

  // 2. 반복되는 UI 로직을 작은 함수로 정의합니다 (가독성 UP)
  // Optional Chaining (?.)을 사용하여 pagePanel이 있을 때만 동작하도록 안전하게 처리
  const hidePagePanel = () => pagePanel?.classList.add("hidden");

  // 3. 각 이벤트별로 실행할 로직을 정의합니다.
  // 여기서 onStart, onMove, onEnd를 구분해서 넣었습니다.
  const eventConfig = {
    touchstart: (e) => {
      hidePagePanel();
      onStart(e, el); // 시작 로직
      toggleClass();
    },
    touchmove: (e) => {
      // move 때는 hidePagePanel을 호출하지 않음
      onMove(e, el); // 이동 로직 (onStart가 아님!)
      toggleClass();
    },
    touchend: (e) => {
      hidePagePanel();
      onEnd(e, el); // 종료 로직
      toggleClass();
    },
  };

  // 4. 설정된 이벤트를 반복문을 통해 바인딩합니다.
  Object.entries(eventConfig).forEach(([eventType, handler]) => {
    targetElement.addEventListener(eventType, handler);
  });
}
