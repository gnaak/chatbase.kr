import { type UserInfo } from "./user";

export type AuthContextType = {
  user: UserInfo | null;
  admin: UserInfo | null;
  isLoading: boolean;
  setUser: (user: UserInfo | null) => void;
  setAdmin: (admin: UserInfo | null) => void;
};
