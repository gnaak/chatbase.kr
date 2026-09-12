import { type InquiryMessage } from "@/types/inquiry";

interface InquiryThreadProps {
  messages: InquiryMessage[];
  /** 문의자 이름. 말풍선 위 라벨에 쓴다. */
  name: string;
}

const formatStamp = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("ko-KR", { hour12: false });
};

/**
 * 문의 스레드 말풍선. 문의자는 왼쪽, 관리자 답변은 오른쪽.
 *
 * 줄바꿈은 `whitespace-pre-wrap`으로 살린다 — 문의 본문은 사용자가 엔터로
 * 문단을 나눠 쓰기 때문에 한 덩어리로 뭉치면 읽기 어렵다.
 */
const InquiryThread = ({ messages, name }: InquiryThreadProps) => {
  return (
    <div className="flex flex-col gap-3">
      {messages.map((m) => {
        const isAdmin = m.sender === "admin";
        return (
          <div
            key={m.id}
            className={[
              "flex flex-col gap-1",
              isAdmin ? "items-end" : "items-start",
            ].join(" ")}
          >
            <span className="text-[11px] text-gray-500 px-1">
              {isAdmin ? "관리자" : name} · {formatStamp(m.created_at)}
            </span>
            <div
              className={[
                "max-w-[85%] rounded-lg px-3 py-2 text-[13px] leading-relaxed",
                "whitespace-pre-wrap break-words",
                isAdmin
                  ? "bg-main text-white"
                  : "bg-gray-100 text-gray-900",
              ].join(" ")}
            >
              {m.content}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default InquiryThread;
