/**
 * 유입 출처(UTM) 수집.
 *
 * 주소의 `utm_*`을 잡아 두었다가 **가입 요청에 실어 보낸다.** 서버는 그 값을
 * `tb_users`에 박고, 어드민이 "어느 채널이 결제까지 갔나"를 집계한다.
 *
 * GA4만으로는 안 되는 이유: GA4는 "cafe_apsa에서 34명 방문"까지만 알고
 * 우리 결제 데이터를 모른다. 둘을 잇는 값이 여기서 나온다.
 *
 * 값 규칙과 예시는 `SALES.md` §6.
 */

const KEY = "chatbase_utm";

/**
 * 30일. 반년 전 방문의 꼬리표가 오늘 가입에 붙으면 그건 신호가 아니라 노이즈다.
 */
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** 서버의 `UTM_FIELDS`(app/core/utils/utm.py)와 같아야 한다. */
const FIELDS = ["utm_source", "utm_medium", "utm_campaign"] as const;

/** `tb_users.utm_*` 이 String(100)이다. 서버도 자르지만 보내기 전에 맞춘다. */
const MAX_LEN = 100;

export type Utm = Partial<Record<(typeof FIELDS)[number], string>>;

interface Stored {
  v: Utm;
  /** 저장 시각(ms). 만료 판정용. */
  t: number;
}

/**
 * localStorage 는 시크릿 모드·저장소 차단에서 **접근 자체가 던진다.**
 * 유입 측정 때문에 가입이 막히면 안 되므로 전부 삼키고 없는 셈 친다.
 */
const load = (): Stored | null => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    if (!parsed?.t || Date.now() - parsed.t > MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
};

/**
 * 주소에 `utm_*`이 있으면 저장한다. 앱이 뜰 때 한 번 부른다.
 *
 * **먼저 들어온 것을 유지한다(first-touch).** 알고 싶은 건 "누가 데려왔나"지
 * "마지막에 뭘 눌렀나"가 아니다. 카페 글을 보고 왔다가 며칠 뒤 검색으로 다시
 * 들어와 가입했다면, 공은 카페 글에 있다.
 *
 * `utm_source`가 없으면 아무것도 안 한다 — 집계 기준이 source라서
 * medium·campaign만 있는 건 쓸 데가 없다.
 */
export const captureUtm = (): void => {
  const query = new URLSearchParams(window.location.search);

  const found: Utm = {};
  for (const field of FIELDS) {
    const value = query.get(field);
    if (value) found[field] = value.slice(0, MAX_LEN);
  }

  if (!found.utm_source) return;
  if (load()) return; // first-touch — 이미 있으면 덮지 않는다

  try {
    localStorage.setItem(KEY, JSON.stringify({ v: found, t: Date.now() }));
  } catch {
    // 저장 못 해도 가입은 되어야 한다
  }
};

/**
 * 저장된 값. 없으면 빈 객체라 요청 바디에 그대로 펼쳐 넣어도 안전하다.
 *
 * ```ts
 * mutate({ email, password, ...readUtm() })
 * ```
 */
export const readUtm = (): Utm => load()?.v ?? {};
