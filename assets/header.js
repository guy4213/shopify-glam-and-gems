if (!window.Eurus.loadedScript.has('header.js')) {
  window.Eurus.loadedScript.add('header.js');
  requestAnimationFrame(() => {
    document.addEventListener('alpine:init', () => {
      Alpine.store('xHeaderMenu', {
        headerObserver: null,
        isSticky: false,
        stickyCalulating: false,
        openHamburgerMenu: false,
        isTouch: ('ontouchstart' in window) || window.DocumentTouch && window.document instanceof DocumentTouch || window.navigator.maxTouchPoints || window.navigator.msMaxTouchPoints ? true : false,
        sectionId: '',
        stickyType: 'none',
        lastScrollTop: 0,
        themeModeChanged: false,
        scrollY: 0,
        stickyOffsetHeight: 0,
        announcementOffsetHeight: 0,
        toolbarOffsetHeight: 0,
        mobileHeaderLayout: '',
        show: null,
        subShow: new Map(),
        overlay: false,
        initIndex: new Set(),
        scrollDir: '',
        isMenuOpen: false,
        initialized: false,
        passTop: false,
        passBottom: false,
        announcementBeforeHeader: false,
        isTransparent: false,
        heightHeaderEls: [],
        stickyTimeout: null,
        reset() {
          this.headerObserver.disconnect();
          if (document.getElementById('x-header-sentinel-top')) document.getElementById('x-header-sentinel-top').remove();
          if (document.getElementById('x-header-sentinel-bottom')) document.getElementById('x-header-sentinel-bottom').remove();
          Alpine.store('xHelper').cancelEvent(`eurus:header-scroll-event`);
          this.isSticky = false;
          this.isTransparent = false;
          this.stickyCalulating = false;
          this.openHamburgerMenu = false;
          this.isTouch = ('ontouchstart' in window) || window.DocumentTouch && window.document instanceof DocumentTouch || window.navigator.maxTouchPoints || window.navigator.msMaxTouchPoints ? true : false;
          this.sectionId = '';
          this.stickyType = 'none';
          this.lastScrollTop = 0;
          this.themeModeChanged = false;
          this.scrollY = 0;
          this.stickyOffsetHeight = 0;
          this.announcementOffsetHeight = 0;
          this.mobileHeaderLayout = '';
          this.show = null;
          this.subShow = new Map();
          this.overlay = false;
          this.initIndex = new Set();
          this.scrollDir = '';
          this.isMenuOpen = false;
          this.initialized = false;
          this.passTop = false;
          this.passBottom = false;
          this.announcementBeforeHeader = false;
        },
        debounce(func, wait) {
          let timeout;
          return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
          };
        },
        initSticky(headerContainer, stickyType, transparent = false) {
          setTimeout(() => {
            if (stickyType === 'none') {
              const announcement = document.getElementById("x-announcement");
              if (announcement?.dataset.isSticky === 'true') {
                this.announcementOffsetHeight = announcement?.offsetHeight;
                this.initHeaderHeightEvent();

                requestAnimationFrame(() => {
                  document.dispatchEvent(new CustomEvent("eurus:sticky-header-moved", { detail: { heightHeader: this.announcementOffsetHeight } }))
                })
              }
              return;
            }

            this.isTransparent = transparent;
            const header = document.getElementById(`shopify-section-${this.sectionId}`);
            const announcement = document.getElementById("x-announcement");
            const toolBar = document.getElementById('header-toolbar');

            if (header && announcement) {
              if (Shopify.designMode) {
                let annoucementIndex = 0, headerIndex = 0;
                headerContainer.closest('.main-container')?.querySelectorAll('.shopify-section').forEach((el, index) => {
                  if (el.classList.contains('section-announcement')) annoucementIndex = index;
                  if (el.classList.contains('section-header')) headerIndex = index;
                })
                this.announcementBeforeHeader = headerIndex > annoucementIndex;
              } else {
                this.announcementBeforeHeader = headerContainer?.dataset.sectionIndex > announcement?.dataset.sectionIndex;
              }
            }

            const sentinelTop = document.createElement('div');
            sentinelTop.id = "x-header-sentinel-top"
            const sentinelBottom = document.createElement('div');
            sentinelBottom.id = "x-header-sentinel-bottom"
            header.before(sentinelTop);
            header.after(sentinelBottom);

            this.headerObserver = new IntersectionObserver((entries) => {
              entries.forEach(entry => {
                if (entry.target === header) {
                  if (!this.initialized) {
                    const rect = entry.boundingClientRect;
                    if (transparent) {
                      this.stickyOffsetHeight = document.getElementById('sticky-header-content').offsetHeight;
                    } else {
                      this.stickyOffsetHeight = rect.height;
                    }

                    if (announcement?.dataset.isSticky === 'true') {
                      if (this.announcementBeforeHeader)
                        this.announcementOffsetHeight = announcement?.offsetHeight;
                      else {
                        this.announcementOffsetHeight = 0;
                      }
                    }

                    if (toolBar?.classList.contains('js-hide-toolbar')) this.toolbarOffsetHeight = toolBar?.offsetHeight;

                    this.initVariable(header, headerContainer, stickyType, announcement);
                    this.initScrollEvent(header, headerContainer, stickyType, announcement);
                    this.initHeaderHeightEvent();

                    this.initialized = true;
                  }
                } else if (entry.target === sentinelTop) {
                  this.passTop = !entry.isIntersecting;
                } else {
                  this.passBottom = !entry.isIntersecting;
                }
              })
            })

            this.headerObserver.observe(header);
            this.headerObserver.observe(sentinelTop);
            this.headerObserver.observe(sentinelBottom);
          }, 0)
        },
        initVariable(header, headerContainer, stickyType, announcement) {
          const headerStickyTransform = 0 - this.announcementOffsetHeight - this.stickyOffsetHeight;
          const headerTopOffset = this.announcementOffsetHeight - this.toolbarOffsetHeight;
          const headerStickyHeight = this.stickyOffsetHeight - this.toolbarOffsetHeight;
          requestAnimationFrame(() => {
            header.style.setProperty('--announcement-height', headerTopOffset + "px");
            header.style.setProperty('--header-sticky-transform', `${headerStickyTransform}px`);
            if (!this.announcementBeforeHeader && announcement?.dataset.isSticky === 'true') {
              announcement?.parentElement.style.setProperty('--header-height', `${headerStickyHeight}px`);
              announcement?.parentElement.style.setProperty('--annoucement-z', '40');
            }
            if (this.passBottom) {
              if (stickyType === 'on-scroll-up') {
                header.classList.add('is-sticky', 'is-scrolled');
                this.isSticky = true;
              } else {
                headerContainer.classList.add('is-sticky', 'is-scrolled');
                this.isSticky = true;
              } 
            }
          });
          this.handleStickyScrolling(header, headerContainer, announcement, stickyType);
        },
        initScrollEvent(header, headerContainer, stickyType, announcement) {
          let scrollDebounce = null;
          const onScroll = () => {
            clearTimeout(scrollDebounce);
            scrollDebounce = setTimeout(() => {
              let scrollPos = window.scrollY || document.documentElement.scrollTop;
              this.handleStickyScrolling(header, headerContainer, announcement, stickyType, scrollPos);
            }, 10);
          };
          const headerScrollController = new AbortController();
          Alpine.store('xHelper').eventControllers.set(`eurus:header-scroll-event`, headerScrollController);
          window.addEventListener('scroll', onScroll, { passive: true, signal: headerScrollController.signal });
        },
        handleStickyScrolling(header, headerContainer, announcement, stickyType, scrollPos) {
          const dir = this.scrollY < scrollPos;
          this.scrollY = scrollPos;
          requestAnimationFrame(() => {
            if (stickyType === 'always') {
              if (!this.announcementBeforeHeader && announcement?.dataset.isSticky === 'true') announcement?.parentElement.classList.add('top-header');
              this.setVariableHeightHeader(true);
              if (this.passBottom) {
                headerContainer.classList.add('is-sticky', 'is-scrolled');
                this.isSticky = true;
              } else {
                headerContainer.classList.remove('is-sticky', 'is-scrolled');
                this.isSticky = false;
              }
            } else if (stickyType === 'reduce-logo-size') {
              if (!this.announcementBeforeHeader && announcement?.dataset.isSticky === 'true') announcement?.parentElement.classList.add('top-header');
              this.setVariableHeightHeader(true);
              if (this.passBottom) {
                headerContainer.classList.add('reduce-logo-size', 'is-sticky', 'is-scrolled');
                this.isSticky = true;
              } else {
                headerContainer.classList.remove('reduce-logo-size', 'is-sticky', 'is-scrolled');
                this.isSticky = false;
              }
            } else {
              if (!this.passTop) {
                header.classList.remove('is-sticky', 'is-scrolled');
                this.isSticky = false;
              }
              if (!this.passBottom && !dir) {
                headerContainer.style.transition = 'transform 0.1s ease-in';
                headerContainer.classList.remove('on-scroll-up-animation');
                if (!this.announcementBeforeHeader && announcement?.dataset.isSticky === 'true') announcement?.parentElement.classList.add('top-header');
                this.setVariableHeightHeader(true);
                clearTimeout(this.stickyTimeout);
                this.stickyTimeout = null;
                return;
              } else {
                headerContainer.style.transition = '';
              }
              if (this.passBottom && dir) {
                if (!this.stickyTimeout) {
                  this.stickyTimeout = setTimeout(() => {
                    header.classList.add('is-sticky', 'is-scrolled');
                    this.isSticky = true;
                    this.stickyTimeout = null;
                  }, 550);
                }
                headerContainer.classList.add('on-scroll-up-animation');
                if (!this.announcementBeforeHeader && announcement?.dataset.isSticky === 'true') announcement?.parentElement.classList.remove('top-header');
                this.setVariableHeightHeader(false);
              } else {
                headerContainer.classList.remove('on-scroll-up-animation');
                if (!this.announcementBeforeHeader && announcement?.dataset.isSticky === 'true') announcement?.parentElement.classList.add('top-header');
                this.setVariableHeightHeader(true);
              }
            }
          });
        },
        initHeaderHeightEvent() {
          this.heightHeaderEls = Array.from(document.querySelectorAll('[class*="--height-header"], [\\:class*="--height-header"]'));
          document.addEventListener('eurus:sticky-header-moved', (e) => {
            this.heightHeaderEls.forEach(el => {
              el.style.setProperty('--height-header', e.detail.heightHeader + "px");
            });
          })
        },
        setVariableHeightHeader(isSticky) {
          const heightHeader = (isSticky && !Alpine.store('xMobileDock')?.showDock) ? this.announcementOffsetHeight + this.stickyOffsetHeight - this.toolbarOffsetHeight : this.announcementOffsetHeight;
          document.dispatchEvent(new CustomEvent("eurus:sticky-header-moved", { detail: { heightHeader: heightHeader } }))
        },
        renderAjax(el, id, element) {
          fetch(
            `${window.location.pathname}?sections=${id}`
          ).then(response => response.json())
          .then(response => {
            let html = getSectionInnerHTML(response[id], element);
            if (el?.closest('[data-breakpoint="tablet"]')) {
              html = html?.replace('id="search-in-modal"', 'id="search-in-modal-mobile"');
            }
            el.innerHTML = html;
          }).finally(() => {
            this.heightHeaderEls.push(el);
            this.setVariableHeightHeader(true);
          });
        },
        setPosition(el, level, hamburger=false) {
          if (!hamburger) {
            level = level - 1;
          } else {
            level = level - 0.5;
          }
          requestAnimationFrame(() => {
            const elm = el.closest(".tree-menu");

            const widthEl = elm.getElementsByClassName("toggle-menu")[0];
            const widthElWitdth = widthEl.offsetWidth;
            const viewWidth = window.xViewport.innerWidth || document.documentElement.clientWidth

            const elRect = elm.getBoundingClientRect();

            const left = (elRect.left - (widthElWitdth * level)) < 100;
            const right = (elRect.right + (widthElWitdth * level)) > (viewWidth - 100);

            const isRtl = document.querySelector('body').classList.contains('rtl');

            requestAnimationFrame(() => {
              if (isRtl) {
                if (left) {
                  el.classList.add('right-0');
                  widthEl.classList.add('left-0');
                  elm.classList.remove('position-left');
                } else {
                  el.classList.add('left-0');
                  widthEl.classList.add('right-0');
                  elm.classList.add('position-left');
                }
              } else { 
                if (right) {
                  el.classList.add('left-0');
                  widthEl.classList.add('right-0');
                  elm.classList.add('position-left');
                } else {
                  el.classList.add('right-0');
                  widthEl.classList.add('left-0');
                  elm.classList.remove('position-left');
                }
              }  
            })
          })
        },
        resizeWindow(el,level, hamburger=false) {
          const onResize = this.debounce(() => {
            this.setPosition(el, level, hamburger);
          }, 100);

          addEventListener("resize", onResize);
        },
        toggleMenu(index) {
          this.initIndex.add(index);
          this.show = this.show === index ? 0 : index;
          this.overlay = (this.show !== 0);
        },
        openMenu(index, hasMenu) {
          this.initIndex.add(index);
          this.show = index;
          this.overlay = hasMenu;
        },
        closeMenu() {
          this.show = 0;
          this.overlay = false;
        },
        openSubMenu(key, index) {
          this.subShow.set(key, index);
        },
        updateHeight(el, containerId) {
          const container = document.getElementById(containerId);
          let currentAnimation = null;
          let previousHeight = null;
          
          const observer = new ResizeObserver((entries) => {
            for (let entry of entries) {
              const newHeight = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
              
              if (previousHeight !== null && Math.abs(previousHeight - newHeight) >= 1) {
                currentAnimation?.cancel();
                
                currentAnimation = container.animate([
                  { height: `${previousHeight}px` },
                  { height: `${newHeight}px` }
                ], { duration: 300, easing: 'ease-in-out' });
              }
              
              container.style.height = newHeight + 'px';
              previousHeight = newHeight;
            }
          });

          observer.observe(el);
        },
        touchItem(el, isSub = false) {
          const touchClass = isSub ? 'touched-sub' : 'touched';

          el.addEventListener("touchend", (e) => {
            if (el.classList.contains(touchClass)) {
              window.location.replace(el.getAttribute('href'));
            } else {
              e.preventDefault(); 
              var dropdown = document.getElementsByClassName(`${touchClass}`);
              for (var i = 0; i < dropdown.length; i++) { 
                dropdown[i].classList.remove(touchClass); 
              }

              el.classList.add(touchClass);
              this.selectItem(el.closest('.has-dropdown'), isSub);
            }
          });
        },
      });
    });
  });
}