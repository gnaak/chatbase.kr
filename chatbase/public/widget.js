// chatbase.kr 임베드 위젯 로더
// 사용법:
//   <script src="https://chatbase.kr/widget.js" data-bot-id="123" defer></script>
//
// 외부 사이트의 우측 하단에 버블을 띄우고, 클릭 시 iframe으로 채팅창을 펼칩니다.
// 모든 채팅 호출은 iframe 내부(같은 origin)에서 발생하므로 CORS 영향 없음.
(function () {
  if (window.__chatbase_loaded) return;
  window.__chatbase_loaded = true;

  var script = document.currentScript;
  if (!script) {
    var scripts = document.getElementsByTagName("script");
    for (var i = scripts.length - 1; i >= 0; i--) {
      if (scripts[i].src && scripts[i].src.indexOf("widget.js") !== -1) {
        script = scripts[i];
        break;
      }
    }
  }
  if (!script) return;

  var botId = script.getAttribute("data-bot-id");
  if (!botId) {
    console.warn("[chatbase] data-bot-id 속성이 필요합니다.");
    return;
  }

  // widget.js의 origin (예: https://chatbase.kr)
  var baseURL;
  try {
    baseURL = new URL(script.src).origin;
  } catch (e) {
    baseURL = window.location.origin;
  }

  var WIDTH = 460;
  var HEIGHT = 700;
  var BUBBLE = 48;
  var GAP = 12;
  var MARGIN = 20;
  // 이 폭 이하에서는 패널을 전체화면으로 띄운다.
  var MOBILE_MAX = 640;
  // 데스크톱 패널이 버블·여백을 뺀 뒤 쓸 수 있는 높이
  var RESERVED = MARGIN * 2 + BUBBLE + GAP;

  // ── 호스트 컨테이너 (Shadow DOM으로 호스트 사이트 CSS 격리)
  var host = document.createElement("div");
  host.id = "chatbase-widget-host";
  host.style.position = "fixed";
  host.style.bottom = "0";
  host.style.right = "0";
  host.style.zIndex = "2147483600";
  host.style.pointerEvents = "none";

  var shadow = host.attachShadow({ mode: "open" });

  // ── 스타일 (Shadow DOM 내부 한정)
  //
  // 모바일 주의: 100vh는 "주소창이 접힌 상태"의 큰 뷰포트 높이라 실제로 보이는
  // 높이보다 크다. 하단(bottom) 기준으로 세운 패널에 100vh 기반 높이를 주면
  // 그 차이만큼 패널 윗부분(헤더)이 화면 위로 잘려 올라간다. 그래서 모바일에서는
  // 전체화면(.full)으로 띄우고, 정확한 크기는 아래 syncPanel()이 visualViewport로
  // 직접 맞춘다. dvh는 그 JS가 돌기 전/못 도는 브라우저를 위한 근사값.
  var style = document.createElement("style");
  style.textContent =
    "*{box-sizing:border-box;margin:0;padding:0}" +
    ".wrap{position:fixed;bottom:" + MARGIN + "px;right:" + MARGIN + "px;display:flex;flex-direction:column;align-items:flex-end;gap:" + GAP + "px;pointer-events:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Pretendard','Apple SD Gothic Neo',sans-serif}" +
    ".bubble{pointer-events:auto;width:" + BUBBLE + "px;height:" + BUBBLE + "px;border-radius:9999px;background:#171717;color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(0,0,0,0.18),0 0 0 1px rgba(0,0,0,0.06);transition:transform .15s ease}" +
    ".bubble:hover{transform:scale(1.05)}" +
    ".bubble:active{transform:scale(.96)}" +
    ".bubble svg{width:20px;height:20px;display:block}" +
    ".panel{pointer-events:auto;width:" + WIDTH + "px;height:" + HEIGHT + "px;max-width:calc(100vw - " + (MARGIN * 2) + "px);max-height:calc(100vh - " + RESERVED + "px);max-height:calc(100dvh - " + RESERVED + "px);border-radius:12px;overflow:hidden;background:#fff;box-shadow:0 24px 60px rgba(0,0,0,.18),0 0 0 1px rgba(0,0,0,.06);transform-origin:bottom right;animation:cb-pop .15s ease-out}" +
    ".panel iframe{width:100%;height:100%;border:0;display:block}" +
    ".panel.full{position:fixed;top:0;left:0;width:100vw;height:100vh;height:100dvh;max-width:none;max-height:none;border-radius:0;box-shadow:none;transform-origin:center bottom;animation:cb-rise .18s ease-out;overscroll-behavior:contain}" +
    ".wrap.full .bubble{display:none}" +
    "@keyframes cb-pop{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}" +
    "@keyframes cb-rise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}";
  shadow.appendChild(style);

  // ── 마크업
  var wrap = document.createElement("div");
  wrap.className = "wrap";

  var panel = document.createElement("div");
  panel.className = "panel";
  panel.style.display = "none";

  var iframe = document.createElement("iframe");
  iframe.title = "Chat";
  iframe.allow = "clipboard-write";
  iframe.src = baseURL + "/embed/" + encodeURIComponent(botId) + "?mode=widget";
  panel.appendChild(iframe);

  var bubble = document.createElement("button");
  bubble.className = "bubble";
  bubble.type = "button";
  bubble.setAttribute("aria-label", "채팅 열기");

  // lucide MessageCircle — 대시보드 미리보기 버블과 동일한 SVG
  var ICON_DEFAULT =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>';

  var customIcon = null;
  var renderBubble = function () {
    if (customIcon) {
      bubble.innerHTML =
        '<img src="' +
        customIcon +
        '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:9999px;display:block" />';
      bubble.style.padding = "0";
      bubble.style.overflow = "hidden";
    } else {
      bubble.innerHTML = ICON_DEFAULT;
      bubble.style.padding = "";
      bubble.style.overflow = "";
    }
  };

  renderBubble();

  var open = false;

  var isMobile = function () {
    return window.matchMedia("(max-width:" + MOBILE_MAX + "px)").matches;
  };

  // 전체화면일 때 패널을 "실제로 보이는 영역"에 맞춘다.
  // visualViewport는 주소창이 접히거나 키보드가 올라온 뒤의 크기·위치를 알려주므로
  // 이 값으로 맞추면 패널이 화면 위아래로 튀어나가지 않는다.
  var syncPanel = function () {
    if (!open || !isMobile()) return;
    var vv = window.visualViewport;
    panel.style.width = (vv ? vv.width : window.innerWidth) + "px";
    panel.style.height = (vv ? vv.height : window.innerHeight) + "px";
    panel.style.top = (vv ? vv.offsetTop : 0) + "px";
    panel.style.left = (vv ? vv.offsetLeft : 0) + "px";
  };

  var resetPanelSize = function () {
    panel.style.width = "";
    panel.style.height = "";
    panel.style.top = "";
    panel.style.left = "";
  };

  // 전체화면 동안 호스트 페이지 스크롤 잠금. 닫을 때 원래 값으로 되돌린다.
  var lock = null;
  var lockScroll = function () {
    if (lock) return;
    var html = document.documentElement;
    var body = document.body;
    lock = { html: html.style.overflow, body: body.style.overflow };
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
  };
  var unlockScroll = function () {
    if (!lock) return;
    document.documentElement.style.overflow = lock.html;
    document.body.style.overflow = lock.body;
    lock = null;
  };

  var applyLayout = function () {
    var full = open && isMobile();
    wrap.classList.toggle("full", full);
    panel.classList.toggle("full", full);
    if (full) {
      lockScroll();
      syncPanel();
    } else {
      unlockScroll();
      resetPanelSize();
    }
  };

  var setOpen = function (next) {
    open = next;
    panel.style.display = open ? "block" : "none";
    bubble.setAttribute("aria-label", open ? "채팅 닫기" : "채팅 열기");
    applyLayout();
  };

  bubble.addEventListener("click", function () {
    setOpen(!open);
  });

  // 전체화면에서는 버블이 가려지므로 iframe 안의 닫기 버튼이 부모에게 알린다.
  // e.source 검사로 우리 iframe이 보낸 메시지만 받는다.
  window.addEventListener("message", function (e) {
    if (e.source !== iframe.contentWindow) return;
    var data = e.data;
    if (data && data.source === "chatbase-widget" && data.type === "close") setOpen(false);
  });

  window.addEventListener("resize", applyLayout);
  window.addEventListener("orientationchange", applyLayout);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", syncPanel);
    window.visualViewport.addEventListener("scroll", syncPanel);
  }

  // 봇 메타 fetch — widget_icon 적용. 실패해도 기본 SVG로 표시.
  fetch(baseURL + "/api/bot/public/" + encodeURIComponent(botId))
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (json) {
      if (json && json.success && json.data && json.data.widget_icon) {
        customIcon = json.data.widget_icon;
        renderBubble();
      }
    })
    .catch(function () {});

  wrap.appendChild(panel);
  wrap.appendChild(bubble);
  shadow.appendChild(wrap);

  document.body.appendChild(host);
})();
