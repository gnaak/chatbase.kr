/**
 * 채팅창 UI 문구.
 *
 * **DeepL 을 태우지 않는다.** 이건 우리가 가진 고정 문자열이라 번역기에 보낼
 * 이유가 없다 — DB 왕복도, API 한도도, 결과가 매번 달라질 위험도 없어야 한다.
 * 언어를 바꾸는 순간 즉시 바뀌는 것도 이래야 가능하다.
 *
 * 반대로 인사말·FAQ 는 **고객이 쓴 글**이라 여기 없다. 그건
 * `tb_bot_translations` 에 DeepL 결과가 들어간다.
 *
 * 키를 늘릴 때는 4개 언어를 **같이** 채운다. 빠지면 `t()` 가 한국어로 떨어져
 * 그 자리만 한국어가 남는데, 화면에서 잘 안 보이고 고객사가 먼저 발견한다.
 */
export const UI_TEXT = {
  ko: {
    bot: "챗봇",
    online: "온라인",
    inactive: "비활성",
    placeholder: "메시지를 입력하세요",
    waiting: "응답을 기다리는 중...",
    send: "전송",
    reset: "대화 초기화",
    close: "닫기",
    openChat: "채팅 열기",
    closeChat: "채팅 닫기",
    failed: "응답을 받지 못했습니다.",
    language: "언어",
  },
  en: {
    bot: "Chatbot",
    online: "Online",
    inactive: "Inactive",
    placeholder: "Type a message",
    waiting: "Waiting for a reply...",
    send: "Send",
    reset: "Reset conversation",
    close: "Close",
    openChat: "Open chat",
    closeChat: "Close chat",
    failed: "No response received.",
    language: "Language",
  },
  ja: {
    bot: "チャットボット",
    online: "オンライン",
    inactive: "停止中",
    placeholder: "メッセージを入力してください",
    waiting: "応答を待っています...",
    send: "送信",
    reset: "会話をリセット",
    close: "閉じる",
    openChat: "チャットを開く",
    closeChat: "チャットを閉じる",
    failed: "応答がありませんでした。",
    language: "言語",
  },
  zh: {
    bot: "聊天机器人",
    online: "在线",
    inactive: "已停用",
    placeholder: "请输入消息",
    waiting: "正在等待回复...",
    send: "发送",
    reset: "重置对话",
    close: "关闭",
    openChat: "打开聊天",
    closeChat: "关闭聊天",
    failed: "未收到回复。",
    language: "语言",
  },
} as const;

export type UiKey = keyof typeof UI_TEXT.ko;

/**
 * 문구 조회. 모르는 언어나 빠진 키는 한국어로 떨어진다.
 *
 * 화면이 비어 보이는 것보다 한국어가 남는 쪽이 낫다 — 빈 버튼은 고장으로 보이고,
 * 한국어는 "번역이 덜 됐네"로 읽힌다.
 */
export const t = (lang: string, key: UiKey): string => {
  const table = (UI_TEXT as Record<string, Record<string, string>>)[lang];
  return table?.[key] ?? UI_TEXT.ko[key];
};
