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
