/**
 * Minified by jsDelivr using Terser v5.37.0.
 * Original file: /npm/@solb/bottom-sheet@1.0.0/dist/index.js
 *
 * Do NOT use SRI with dynamically generated files! More
 */
"use strict";
class BottomSheet extends HTMLElement {
  constructor() {
    super(),
      (this.defaultVh = 0),
      (this.beforeVh = 0),
      (this.sheetHeight = 0),
      (this.mobileVh = 0.01 * window.innerHeight);
    this.resizeHandler = this.handleResize.bind(this); // 리사이즈 핸들러 바인딩
  }
  connectedCallback() {
    this.setAttribute("aria-hidden", "true"), this.renderBottomSheet();
    window.addEventListener("resize", this.resizeHandler); // 리사이즈 이벤트 리스너 추가
  }
  disconnectedCallback() {
    window.removeEventListener("resize", this.resizeHandler); // 컴포넌트 제거 시 리스너 제거
  }
  handleResize() {
    // 리사이즈 시 수행할 동작
    this.mobileVh = 0.01 * window.innerHeight; // mobileVh 업데이트

    if (this.getAttribute("aria-hidden") === "false") {
      // 바텀 시트가 열려있을 때 리사이즈 대응
      this.adjustHeightOnResize();
    }
  }
  adjustHeightOnResize() {
    const sheetWrapper = this.querySelector(".sheet__wrapper");
    if (sheetWrapper) {
      if (this.sheetHeight === 100) {
        // 풀스크린 상태일 때 높이 재조정 (필요한 경우)
        sheetWrapper.style.height = "100%"; // 또는 다른 로직
      } else if (this.defaultVh > 0) {
        // 기본 높이 기반으로 높이 재설정
        sheetWrapper.style.height = `${this.defaultVh * this.mobileVh}px`;
      } else {
        // defaultVh가 아직 설정되지 않은 경우 높이 다시 계산
        const contentHeight = sheetWrapper.offsetHeight;
        this.defaultVh = Number((contentHeight / window.innerHeight) * 100);
        sheetWrapper.style.height = `${this.defaultVh * this.mobileVh}px`;
      }
    }
  }
  renderBottomSheet() {
    const e = this.getAttribute("id");
    (this.className = "customBottomsheet"),
      isMobile || this.classList.add("_modal");
    const t = document.createElement("div");
    t.className = "overlay";
    const s = document.createElement("div");
    s.className = "sheet__wrapper";
    const i = document.createElement("header");
    (i.className = "controls"),
      (i.innerHTML = `
        <div class="draggable-area">
          <div class="draggable-thumb"></div>
        </div>
      ${
        this.getAttribute("title")
          ? `<div class="title__wrapper">
          <span class="title">${this.getAttribute("title")}</span>
        </div>`
          : ""
      }
  `);
    const h = this.querySelector(`#${e} > main`);
    const bottomActions = this.querySelector(`#${e} > .bottom-actions`);
    if (
      ((h.className = `${h.className} content`),
      s.appendChild(i),
      s.appendChild(h),
      bottomActions && s.appendChild(bottomActions),
      this.appendChild(t),
      this.appendChild(s),
      this.querySelector(".overlay").addEventListener("click", () => {
        this.closeSheet();
      }),
      isMobile)
    ) {
      const e = this.querySelector(".draggable-area");
      let t = 0;
      this.beforeY = 0;
      this.touchStartTime = 0;
      const i = (e) => {
          (t = e.touches[0].clientY), (this.beforeY = e.touches[0].clientY);
          this.touchStartTime = e.timeStamp;
          s.classList.add("not-selectable");
        },
        h = (e) => {
          if (0 === t) return;
          const s = e.touches[0].clientY,
            i = ((t - s) / window.innerHeight) * 100;
          this.setSheetHeight(this.sheetHeight + i), (t = s);
        },
        o = (event) => {
          (t = 0), s.classList.remove("not-selectable");

          const deltaY = this.beforeY - event.changedTouches[0].clientY;

          let shouldClose = false;

          if (this.beforeVh === 75 && deltaY > -5) {
            this.beforeVh = this.defaultVh;
            this.setSheetHeight(this.defaultVh);
          } else if (
            this.beforeVh === this.defaultVh &&
            deltaY > 10 &&
            this.sheetHeight < this.defaultVh - 10
          ) {
            shouldClose = true;
          } else if (this.sheetHeight < this.beforeVh - 15) {
            shouldClose = true;
          } else if (this.sheetHeight > this.defaultVh + 10) {
            this.setSheetHeight(75);
          } else {
            this.setSheetHeight(this.defaultVh);
          }

          this.beforeVh = this.sheetHeight;

          if (shouldClose) {
            this.closeSheet();
          }
        };
      e.addEventListener("touchstart", i, { passive: !0 }),
        this.addEventListener("touchmove", h, { passive: !0 }),
        this.addEventListener("touchend", o, { passive: !0 });
    }
  }
  setSheetHeight(e) {
    const t = this.querySelector(".sheet__wrapper");
    isMobile &&
      ((this.sheetHeight = Math.max(0, Math.min(100, e))),
      (t.style.height = this.sheetHeight * this.mobileVh + "px"),
      100 === this.sheetHeight
        ? t.classList.add("fullscreen")
        : t.classList.remove("fullscreen"));
  }
  setIsSheetShown(e) {
    if ((this.setAttribute("aria-hidden", String(!e)), e))
      document.body.classList.add("no-scroll");
    else {
      Array.from(document.querySelectorAll("bottom-sheet")).find(
        (e) => "false" === e.ariaHidden
      ) || document.body.classList.remove("no-scroll");
    }
  }
  openSheet() {
    if (0 === this.defaultVh) {
      const e = this.querySelector(".sheet__wrapper");
      const vhAttribute = this.getAttribute("vh");
      if (vhAttribute) {
        this.defaultVh = Number(vhAttribute);
      } else {
        this.defaultVh = Number(
          (e.offsetHeight /
            (window.visualViewport
              ? window.visualViewport.height
              : window.innerHeight)) *
            100
        );
      }
    }
    (this.beforeVh = this.defaultVh),
      this.setSheetHeight(this.defaultVh),
      this.setIsSheetShown(!0);
  }
  openFullSheet() {
    (this.beforeVh = 75), this.setSheetHeight(75), this.setIsSheetShown(!0);
  }
  closeSheet() {
    this.setSheetHeight(0), this.setIsSheetShown(!1);
  }
  fullSheet() {
    (this.beforeVh = 75), this.setSheetHeight(75);
  }
}
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
customElements.define("bottom-sheet", BottomSheet);
