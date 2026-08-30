// src/context/AuthProvider.tsx

import { useEffect, useState, ReactNode } from "react";
import { parseUserInfo } from "@shared/hooks/common/getCookie";
import { AuthContext } from "@shared/hooks/common/useAuth";
import { UserInfo } from "@shared/types/user";

/**
 * 쿠키에 저장된 사용자 정보를 읽어서
 * 현재 로그인한 유저(user) / 관리자(admin)와 로딩 상태(isLoading)를 전역 Context로 제공.
 *
 * user_ 와 admin_ 쿠키는 서로 독립적이므로 두 세션은 동시에 존재할 수 있다.
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [admin, setAdmin] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    try {
      setUser(parseUserInfo("user"));
      setAdmin(parseUserInfo("admin"));
    } catch {
      setUser(null);
      setAdmin(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, admin, isLoading, setUser, setAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};
