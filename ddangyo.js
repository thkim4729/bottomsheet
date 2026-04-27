document.addEventListener("DOMContentLoaded", () => {
  ui();
});

function ui() {
  const fullScroll = function (params = {}) {
    const container = document.querySelector(".scroll_container");
    if (!container) return; // scroll_container가 HTML에 없을 경우 에러 방지
    const sections = container.querySelectorAll(".scroll_section");
    const defaults = {
      container: container,
      sections: sections,
      header: document.querySelector(".C_header"),
      animateTime: params.animateTime || 0.7,
      animateFunction: params.animateFunction || "ease",
      maxPosition: sections.length - 1,
      currentPosition: 0,
      activeClass: "active",
      displayDots: typeof params.displayDots !== "undefined" ? params.displayDots : true,
      dotsPosition: params.dotsPosition || "left",
    };
    const sceneInfo = [];
    sections.forEach((section) => {
      const match = section.className.match(/scroll-section-(\d+)/);
      const id = match ? parseInt(match[1]) : 0;
      let info = { id: id, type: "normal", objs: {} };

      if (id === 1) {
        info.type = "sticky";
        info.scrollHeight = 20;
        info.objs = {
          container: section,
          bWrapper: section.querySelector(".benefit_wrapper"),
          bItemAll: section.querySelectorAll(".benefit_item"),
          benefitA: section.querySelector(".benefit_item.a"),
          benefitB: section.querySelector(".benefit_item.b"),
          benefitC: section.querySelector(".benefit_item.c"),
          benefitD: section.querySelector(".benefit_item.d"),
          benefitE: section.querySelector(".benefit_item.e"),
          benefitF: section.querySelector(".benefit_item.f"),
        };
      } else if (id === 2) {
        info.type = "sticky";
        info.scrollHeight = 20;
        info.objs = {
          container: section,
          bItemAll: section.querySelectorAll(".main_message"),
          messageA: section.querySelector(".main_message.a"),
          messageB: section.querySelector(".main_message.b"),
          messageC: section.querySelector(".main_message.c"),
        };
      } else if (id === 3) {
        info.type = "sticky";
        info.scrollHeight = 7;
        info.objs = {
          container: section,
          bItemAll: section.querySelectorAll(".main_benefit"),
          benefitA: section.querySelector(".main_benefit.a"),
          benefitB: section.querySelector(".main_benefit.b"),
        };
      } else if (id === 5) {
        info.objs = {
          video: section.querySelector(".slot_machine > video"),
        };
      } else if (id === 6) {
        info.type = "sticky";
        info.scrollHeight = 10;
        info.objs = {
          container: section,
          bItemAll: section.querySelectorAll(".img_phone"),
          phoneGroup: section.querySelector(".phone_group"),
          phoneA: section.querySelector(".img_phone.a"),
          phoneB: section.querySelector(".img_phone.b"),
          phoneC: section.querySelector(".img_phone.c"),
        };
      } else if (id === 8) {
        info.type = "sticky";
        info.scrollHeight = 20;
        info.objs = {
          container: section,
          bItemAll: section.querySelectorAll(".img_menu"),
          menuList: section.querySelector(".img_menu_list"),
        };
      }
      sceneInfo.push(info);
    });

    this.defaults = defaults;
    this.sceneInfo = sceneInfo;

    console.log(this.defaults);

    this.init();
  };

  fullScroll.prototype.init = function () {
    this.buildSections().buildPublicFunctions().addEvents();

    let anchor = location.hash.replace("#", "").split("/")[0];
    location.hash = 0;
    this.changeCurrentPosition(anchor);

    setTimeout(() => {
      this.addActiveClass(anchor);
    }, 100);

    const footerElem = document.querySelector(".scroll-section-11 .footer");
    const moreElem = footerElem.querySelector(".btn_txt.more");
    moreElem.addEventListener("click", () => {
      const infoTxt = footerElem.querySelector(".info_txt");
      moreElem.classList.toggle("on");
      infoTxt.classList.toggle("active");
    });
  };

  fullScroll.prototype.buildSections = function () {
    const sections = this.defaults.sections;
    for (let i = 0; i < sections.length; i++) {
      sections[i].setAttribute("data-index", i);
    }
    return this;
  };

  fullScroll.prototype.addEvents = function () {
    if (document.addEventListener) {
      document.addEventListener("mousewheel", this.mouseWheelAndKey, false);
      document.addEventListener("scroll", this.mouseWheelAndKey, false);
      document.addEventListener("wheel", this.mouseWheelAndKey, false);
      document.addEventListener("keyup", this.mouseWheelAndKey, false);
      document.addEventListener("touchstart", this.touchStart, false);
      document.addEventListener("touchend", this.touchEnd, false);
      window.addEventListener("hashchange", this.hashChange, false);
    } else {
      document.attachEvent("onmousewheel", this.mouseWheelAndKey, false);
      document.attachEvent("onkeyup", this.mouseWheelAndKey, false);
    }

    return this;
  };

  fullScroll.prototype.buildPublicFunctions = function () {
    let mTouchStart = 0;
    let mTouchEnd = 0;
    let scrollCount = 1;
    let ratio = 0;
    let scrollTop = 0;
    let absTop = null;
    let _self = this;

    this.mouseWheelAndKey = function (event) {
      event.deltaY > 0 ? scrollCount++ : scrollCount--;

      const currentSceneId = _self.sceneInfo[_self.defaults.currentPosition]?.id;
      if (
        currentSceneId == 1 ||
        currentSceneId == 2 ||
        currentSceneId == 3 ||
        currentSceneId == 6 ||
        currentSceneId == 8
      ) {
        const rev = _self.scrollLoop(event, scrollCount);
        console.log(rev);
        if (rev) {
          return false;
        } else {
          scrollCount = 1;
        }
      }

      let currentScrollTop = window.scrollY || document.documentElement.scrollTop || 0;
      if (event.deltaY < 0 && currentScrollTop > 0) {
        setTimeout(() => {
          scrollTop = window.scrollY || document.documentElement.scrollTop || 0;

          absTop = _self.defaults.sections[_self.defaults.maxPosition].getBoundingClientRect().top + scrollTop;
          if (scrollTop >= absTop) {
            _self.defaults.header.classList.replace("type01", "type02");
          }
        }, 100);
        console.log("call 1");
        return false;
      } else {
        document.body.classList.remove("scrolled");
        console.log("call 2");
      }

      if (event.deltaY > 0 || event.keyCode == 40) {
        _self.defaults.currentPosition++;
        _self.changeCurrentPosition(_self.defaults.currentPosition);
      } else if (event.deltaY < 0 || event.keyCode == 38) {
        _self.defaults.currentPosition--;
        _self.changeCurrentPosition(_self.defaults.currentPosition);
      }
      _self.removeEvents();
    };

    this.touchStart = function (event) {
      mTouchStart = parseInt(event.changedTouches[0].clientY);
      mTouchEnd = 0;
    };

    this.touchEnd = function (event) {
      mTouchEnd = parseInt(event.changedTouches[0].clientY);

      const currentSceneId = _self.sceneInfo[_self.defaults.currentPosition]?.id;
      if (
        currentSceneId == 1 ||
        currentSceneId == 2 ||
        currentSceneId == 3 ||
        currentSceneId == 6 ||
        currentSceneId == 8
      ) {
        mTouchStart > mTouchEnd ? scrollCount++ : scrollCount--;

        let len = _self.sceneInfo[_self.defaults.currentPosition].objs.bItemAll.length;

        if (currentSceneId == 6) {
          len = _self.sceneInfo[_self.defaults.currentPosition].objs.bItemAll.length - 1;
        }

        const rev = _self.scrollLoop(event, scrollCount, len);
        console.log(rev);
        if (rev) {
          return false;
        } else {
          scrollCount = 1;
        }
      }

      if (mTouchEnd - mTouchStart > 100 || mTouchStart - mTouchEnd > 100) {
        if (mTouchEnd > mTouchStart) {
          _self.defaults.currentPosition--;
        } else {
          _self.defaults.currentPosition++;
        }
        _self.changeCurrentPosition(_self.defaults.currentPosition);
      }
    };

    this.scrollLoop = function (event, scrollCount, len) {
      if (event.type == "touchend") {
        if (scrollCount > 0 && scrollCount <= len) {
          _self.scrollMobile(scrollCount);
          return true;
        } else {
          return false;
        }
      } else {
        ratio = _self.scrollAnimation(scrollCount);
        return ratio > 0.01 && ratio < 0.99;
      }
    };

    this.scrollMobile = function (scrollCount) {
      const currentScene = _self.defaults.currentPosition;
      const currentSceneId = _self.sceneInfo[currentScene]?.id;
      const objs = _self.sceneInfo[currentScene].objs;

      console.log("scrollCount", scrollCount);
      console.log("currentSceneId", currentSceneId);

      if (currentSceneId == 1) {
        const count = scrollCount - 1;
        const benefitAll = objs.bItemAll;
        const halfWidth = benefitAll[count].clientWidth / 2;

        benefitAll.forEach((benefit) => benefit.classList.remove("active"));
        benefitAll[count].classList.add("active");
        objs.bWrapper.style.transform = `translate3d(-${halfWidth + (benefitAll[count].clientWidth + 20) * count}px, 0, 0)`;
      }

      if (currentSceneId == 2) {
        const count = scrollCount - 1;
        const messageAll = objs.bItemAll;

        messageAll.forEach((message) => message.classList.remove("active"));
        messageAll[count].classList.add("active");
      }

      if (currentSceneId == 3) {
        const count = scrollCount - 1;
        const benefitAll = objs.bItemAll;

        _self.changeActiveClass(benefitAll, benefitAll[count]);
      }

      if (currentSceneId == 6) {
        const mainBenefit = objs.container.querySelectorAll(".main_benefit");

        _self.changeActiveClass(mainBenefit, objs.phoneB, function () {
          if (objs.phoneB) objs.phoneB.classList.add(_self.defaults.activeClass);
          if (objs.phoneGroup) objs.phoneGroup.classList.add(_self.defaults.activeClass);
        });
      }

      if (currentSceneId == 8) {
        const count = scrollCount - 1;
        const menuWidth = objs.menuList.querySelector(".img_menu").offsetWidth + 4;

        objs.menuList.style.transform = `translate3d(-${menuWidth * count}px, 0, 0)`;
      }
    };

    this.scrollAnimation = function (scrollCount) {
      const currentScene = _self.defaults.currentPosition;
      const currentSceneId = _self.sceneInfo[currentScene]?.id;
      const objs = _self.sceneInfo[currentScene].objs;
      const scrollRatio = scrollCount / _self.sceneInfo[currentScene].scrollHeight;

      console.log("scrollRatio", scrollRatio);
      console.log("scrollCount", scrollCount);

      if (currentSceneId == 1) {
        const benefitItems = objs.container.querySelectorAll(".benefit_item");

        if (scrollRatio < 0.16) {
          _self.changeActiveClass(benefitItems, objs.benefitA);
        } else if (scrollRatio >= 0.16 && scrollRatio < 0.32) {
          _self.changeActiveClass(benefitItems, objs.benefitB);
        } else if (scrollRatio >= 0.32 && scrollRatio < 0.48) {
          _self.changeActiveClass(benefitItems, objs.benefitC);
        } else if (scrollRatio >= 0.48 && scrollRatio < 0.64) {
          _self.changeActiveClass(benefitItems, objs.benefitD);
        } else if (scrollRatio >= 0.64 && scrollRatio < 0.8) {
          _self.changeActiveClass(benefitItems, objs.benefitE);
        } else if (scrollRatio >= 0.8) {
          _self.changeActiveClass(benefitItems, objs.benefitF);
        }
      } else if (currentSceneId == 2) {
        const mainMessage = objs.container.querySelectorAll(".main_message");

        if (scrollRatio < 0.22) {
          _self.changeActiveClass(mainMessage, objs.messageA);
        } else if (scrollRatio >= 0.22 && scrollRatio < 0.55) {
          _self.changeActiveClass(mainMessage, objs.messageB);
        } else if (scrollRatio >= 0.55) {
          _self.changeActiveClass(mainMessage, objs.messageC);
        }
      } else if (currentSceneId == 3) {
        const mainBenefit = objs.container.querySelectorAll(".main_benefit");

        if (scrollRatio >= 0.1 && scrollRatio < 0.2) {
          _self.changeActiveClass(mainBenefit, objs.benefitA, function () {
            if (objs.benefitA) objs.benefitA.classList.remove(_self.defaults.activeClass);
          });
        } else if (scrollRatio >= 0.2) {
          setTimeout(() => {
            _self.changeActiveClass(mainBenefit, objs.benefitB);
          }, 500);
        }
      } else if (currentSceneId == 6) {
        const mainBenefit = objs.container.querySelectorAll(".main_benefit");

        if (scrollRatio >= 0.1) {
          _self.changeActiveClass(mainBenefit, objs.phoneB, function () {
            if (objs.phoneB) objs.phoneB.classList.add(_self.defaults.activeClass);
            if (objs.phoneGroup) objs.phoneGroup.classList.add(_self.defaults.activeClass);
          });
        }
      } else if (currentSceneId == 8) {
        const menuWidth = objs.menuList.querySelector(".img_menu").offsetWidth;
        let num;

        console.log(menuWidth);
        if (scrollRatio < 0.2) {
          num = 0;
          objs.menuList.style.transform = `translate3d(-${menuWidth * num}px, 0, 0)`;
        } else if (scrollRatio >= 0.2 && scrollRatio < 0.4) {
          num = 1;
          objs.menuList.style.transform = `translate3d(-${menuWidth * num}px, 0, 0)`;
        } else if (scrollRatio >= 0.4 && scrollRatio < 0.6) {
          num = 2;
          objs.menuList.style.transform = `translate3d(-${menuWidth * num}px, 0, 0)`;
        } else if (scrollRatio >= 0.6 && scrollRatio < 0.8) {
          num = 3;
          objs.menuList.style.transform = `translate3d(-${menuWidth * num}px, 0, 0)`;
        } else if (scrollRatio >= 0.8 && scrollRatio < 0.99) {
          num = 4;
          objs.menuList.style.transform = `translate3d(-${menuWidth * num}px, 0, 0)`;
        }
      }

      return scrollRatio;
    };

    this.hashChange = function (event) {
      if (location) {
        let anchor = location.hash.replace("#", "").split("/")[0];
        if (anchor !== "") {
          if (anchor < 0) {
            _self.changeCurrentPosition(0);
          } else if (anchor > _self.defaults.maxPosition) {
            _self.changeCurrentPosition(_self.defaults.maxPosition);
            _self.addActiveClass(_self.defaults.maxPosition);
          } else {
            console.log("scene " + anchor);
            const sceneId = _self.sceneInfo[anchor]?.id;

            if (sceneId == 1) {
              setTimeout(() => {
                _self.sceneInfo[anchor].objs.benefitA.classList.add("active");
              }, 2500);
            }

            if (sceneId == 2) {
              setTimeout(() => {
                _self.sceneInfo[anchor].objs.messageA.classList.add("active");
              }, 1000);
            }

            if (sceneId == 3) {
              setTimeout(() => {
                _self.sceneInfo[anchor].objs.benefitA.classList.add("active");
              }, 1000);
            }

            if (sceneId == 5) {
              setTimeout(() => {
                if (_self.sceneInfo[anchor].objs.video) _self.sceneInfo[anchor].objs.video.play();
              }, 1000);
            }

            if (sceneId == 6) {
              setTimeout(() => {
                if (_self.sceneInfo[anchor].objs.phoneA) _self.sceneInfo[anchor].objs.phoneA.classList.add("active");
                if (_self.sceneInfo[anchor].objs.phoneC) _self.sceneInfo[anchor].objs.phoneC.classList.add("active");
              }, 100);
            }

            if (sceneId == 8) {
              if (_self.sceneInfo[anchor].objs.menuList)
                _self.sceneInfo[anchor].objs.menuList.style.transform = `translate3d(0, 0, 0)`;
            }

            if (sceneId == 12) {
              const accordion = document.querySelector(".scroll-section-12 .C_accordion");
              if (accordion) {
                const inputLabel = accordion.querySelector("label");
                const inputChk = accordion.querySelector("input[type=checkbox]");
                inputLabel.addEventListener("click", () => {
                  const isChecked = !inputChk.checked;
                  if (isChecked) {
                    accordion.classList.add("active");
                  } else {
                    accordion.classList.remove("active");
                  }
                });
              }
            }

            const scene2 = _self.sceneInfo.find((s) => s.id == 2);
            if (scene2 && scene2.objs && scene2.objs.messageC) scene2.objs.messageC.classList.remove("active");

            const scene3 = _self.sceneInfo.find((s) => s.id == 3);
            if (scene3 && scene3.objs && scene3.objs.benefitB) scene3.objs.benefitB.classList.remove("active");

            _self.defaults.currentPosition = anchor;
            _self.addActiveClass(_self.defaults.currentPosition);
            _self.animateScroll();
          }

          //anchor>0 && anchor < _self.defaults.maxPosition ? _self.defaults.header.classList.replace('type01', 'type02') : _self.defaults.header.classList.replace('type02', 'type01');
          const finalSceneId = _self.sceneInfo[anchor] ? _self.sceneInfo[anchor].id : -1;
          if (finalSceneId == 2 || finalSceneId == 4 || finalSceneId == 11) {
            _self.defaults.header.classList.replace("type02", "type01");
          } else {
            _self.defaults.header.classList.replace("type01", "type02");
          }
        }
      }
    };

    this.removeEvents = function () {
      if (document.addEventListener) {
        document.removeEventListener("mousewheel", this.mouseWheelAndKey, false);
        document.removeEventListener("wheel", this.mouseWheelAndKey, false);
        document.removeEventListener("keyup", this.mouseWheelAndKey, false);
        document.removeEventListener("touchstart", this.touchStart, false);
        document.removeEventListener("touchend", this.touchEnd, false);
      } else {
        document.detachEvent("onmousewheel", this.mouseWheelAndKey, false);
        document.detachEvent("onkeyup", this.mouseWheelAndKey, false);
      }

      setTimeout(() => {
        _self.addEvents();
      }, 600);
    };

    this.animateScroll = function () {
      const animateTime = this.defaults.animateTime;
      const animateFunction = this.defaults.animateFunction;
      const position = this.defaults.currentPosition * 100;

      this.defaults.container.style.webkitTransform = "translateY(-" + position + "%)";
      this.defaults.container.style.mozTransform = "translateY(-" + position + "%)";
      this.defaults.container.style.msTransform = "translateY(-" + position + "%)";
      this.defaults.container.style.transform = "translateY(-" + position + "%)";
      this.defaults.container.style.webkitTransition = "all " + animateTime + "s " + animateFunction;
      this.defaults.container.style.mozTransition = "all " + animateTime + "s " + animateFunction;
      this.defaults.container.style.msTransition = "all " + animateTime + "s " + animateFunction;
      this.defaults.container.style.transition = "all " + animateTime + "s " + animateFunction;
      console.log("scroll");
    };

    this.changeCurrentPosition = function (position) {
      if (position !== "") {
        _self.defaults.currentPosition = position;
        location.hash = _self.defaults.currentPosition;
      }
    };

    this.addActiveClass = function (position) {
      if (position !== "") {
        setTimeout(() => {
          //_self.defaults.sections.forEach(section => section.classList.remove(_self.defaults.activeClass));
          _self.defaults.sections[position].classList.add(_self.defaults.activeClass);
        }, 500);
      }
    };

    this.changeActiveClass = function (elements, elem, callback) {
      if (typeof callback === "function") {
        callback();
      } else {
        elements.forEach((el) => el.classList.remove(_self.defaults.activeClass));
        if (elem) elem.classList.add(_self.defaults.activeClass);
      }
    };

    return this;
  };

  // _ui 네임스페이스 정의 방어코드 추가
  window._ui = window._ui || {};
  window._ui.fullScroll = fullScroll;

  // 인스턴스를 생성하여 스크롤 이벤트를 실제로 구동시킵니다.
  new fullScroll();
}
