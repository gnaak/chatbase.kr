/** 1:1 문의. 어드민 · 대시보드 · 공개 페이지가 같은 타입을 쓴다. */

export type InquiryCategory =
  | "general"
  | "billing"
  | "technical"
  | "partnership";

export type InquiryStatus = "open" | "answered" | "closed";

export type InquirySender = "user" | "admin";

export interface InquiryMessage {
  id: number;
  sender: InquirySender;
  content: string;
  created_at: string | null;
}

/** 목록·상세 공통 헤더. `email`/`ip`는 어드민 응답에만 실린다. */
export interface Inquiry {
  id: number;
  subject: string;
  category: InquiryCategory;
  status: InquiryStatus;
  name: string;
  user_id: number | null;
  answered_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  email?: string;
  ip?: string | null;
}

export interface InquiryThread extends Inquiry {
  messages: InquiryMessage[];
}

/** 목록 행. 스레드를 통째로 안 받고 요약만 받는다. */
export interface InquiryListItem extends Inquiry {
  message_count: number;
  last_sender: InquirySender | null;
  last_message_at: string | null;
  /** 어드민 목록에만 있다. 마지막 글 앞 120자. */
  preview?: string;
}

export interface AdminInquiryList {
  items: InquiryListItem[];
  total: number;
  limit: number;
  offset: number;
  counts: Record<InquiryStatus, number>;
}

/** 답변 응답. `mail_sent`는 발송 인프라가 붙기 전까지 항상 false다. */
export interface InquiryReplyResult extends InquiryThread {
  mail_sent: boolean;
}

export const CATEGORY_LABEL: Record<InquiryCategory, string> = {
  general: "일반 문의",
  billing: "결제·환불",
  technical: "기술 지원",
  partnership: "제휴·파트너십",
};

export const STATUS_LABEL: Record<InquiryStatus, string> = {
  open: "답변 대기",
  answered: "답변 완료",
  closed: "종료",
};

/** 조치가 필요한 것(답변 대기)만 눈에 띄게. 나머지는 조용히 둔다. */
export const STATUS_CLASS: Record<InquiryStatus, string> = {
  open: "bg-warning-bg text-point-amber",
  answered: "bg-success-bg text-point-green",
  closed: "bg-bg-sub text-text-sub",
};

export const CATEGORY_OPTIONS = (
  Object.keys(CATEGORY_LABEL) as InquiryCategory[]
).map((value) => ({ value, label: CATEGORY_LABEL[value] }));
