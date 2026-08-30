import { UserInfo } from "@shared/types/user";

export type AuthType = "user" | "admin";

const cookiePrefix = (authType: AuthType) =>
  authType === "admin" ? "admin_" : "user_";

const getCookie = (name: string): string | undefined => {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]*)`));
  return match ? match[2].trim() : undefined;
};

export const parseUserInfo = (authType: AuthType = "user"): UserInfo | null => {
  const cookie = getCookie(`${cookiePrefix(authType)}user_info`);
  if (!cookie) return null;

  try {
    const binary = atob(cookie.replace(/^"|"$/g, ""));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const decoded = new TextDecoder("utf-8").decode(bytes);
    return JSON.parse(decoded) as UserInfo;
  } catch (e) {
    console.error("쿠키 파싱 실패:", e);
    return null;
  }
};

/**
 * refresh_exp 쿠키 존재 여부.
 * user_info(1시간)가 만료돼도 refresh_token(6시간)이 살아있는지 판단하는 힌트.
 */
export const refreshExp = (authType: AuthType = "user"): boolean =>
  getCookie(`${cookiePrefix(authType)}refresh_exp`) !== undefined;
