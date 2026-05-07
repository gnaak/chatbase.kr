const STORAGE_KEY = "chatbase_visitor_id";

const generate = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().slice(0, 12);
  }
  return Math.random().toString(36).slice(2, 14);
};

export const getVisitorId = (): string => {
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const next = `v_${generate()}`;
    window.localStorage.setItem(STORAGE_KEY, next);
    return next;
  } catch {
    // localStorage 차단된 환경 (시크릿 모드 등) — 세션 단위로 임시 발급
    return `v_anon_${generate()}`;
  }
};
