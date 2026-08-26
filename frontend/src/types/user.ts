// user_info 쿠키 타입 (backend session_info와 동일한 키)
export interface UserInfo {
  auth_type: "user" | "admin";
  id: number;
  user_nickname: string;
  created_at: string | null;
}

// /me 호출 시 넘어오는 데이터 
export interface UserDetail {
  name: string;
  profile_image: string;
}
