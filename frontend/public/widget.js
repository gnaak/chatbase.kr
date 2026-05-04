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
  var style = document.createElement("style");
  style.textContent =
    "*{box-sizing:border-box;margin:0;padding:0}" +
    ".wrap{position:fixed;bottom:" + MARGIN + "px;right:" + MARGIN + "px;display:flex;flex-direction:column;align-items:flex-end;gap:" + GAP + "px;pointer-events:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Pretendard','Apple SD Gothic Neo',sans-serif}" +
    ".bubble{pointer-events:auto;width:" + BUBBLE + "px;height:" + BUBBLE + "px;border-radius:9999px;background:#171717;color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(0,0,0,0.18),0 0 0 1px rgba(0,0,0,0.06);transition:transform .15s ease}" +
    ".bubble:hover{transform:scale(1.05)}" +
    ".bubble:active{transform:scale(.96)}" +
    ".bubble svg{width:20px;height:20px;display:block}" +
    ".panel{pointer-events:auto;width:" + WIDTH + "px;height:" + HEIGHT + "px;max-width:calc(100vw - " + (MARGIN * 2) + "px);max-height:calc(100vh - " + (MARGIN * 2 + BUBBLE + GAP) + "px);border-radius:12px;overflow:hidden;background:#fff;box-shadow:0 24px 60px rgba(0,0,0,.18),0 0 0 1px rgba(0,0,0,.06);transform-origin:bottom right;animation:cb-pop .15s ease-out}" +
    ".panel iframe{width:100%;height:100%;border:0;display:block}" +
    "@keyframes cb-pop{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}" +
    "@media(max-width:480px){.panel{width:calc(100vw - " + (MARGIN * 2) + "px);height:calc(100vh - " + (MARGIN * 2 + BUBBLE + GAP) + "px)}}";
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
  iframe.src = baseURL + "/embed/" + encodeURIComponent(botId);
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
  var setOpen = function (next) {
    open = next;
    panel.style.display = open ? "block" : "none";
    bubble.setAttribute("aria-label", open ? "채팅 닫기" : "채팅 열기");
  };

  bubble.addEventListener("click", function () {
    setOpen(!open);
  });

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
