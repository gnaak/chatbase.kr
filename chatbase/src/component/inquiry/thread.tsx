import { type InquiryMessage } from "@/types/inquiry";

interface InquiryThreadProps {
  messages: InquiryMessage[];
}

const formatStamp = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("ko-KR", { hour12: false });
};

/**
 * 문의자 시점의 스레드. 내 글이 오른쪽, chatbase.kr 답변이 왼쪽.
 *
 * 어드민 쪽(`component/admin/inquiry/thread.tsx`)과 좌우가 반대다 —
 * 보는 사람이 다르니 "내 말풍선"의 위치도 달라야 한다.
 * 대시보드와 공개 문의 페이지가 이 컴포넌트를 같이 쓴다.
 */
const InquiryThread = ({ messages }: InquiryThreadProps) => {
  return (
    <div className="flex flex-col gap-4">
      {messages.map((m) => {
        const isMine = m.sender === "user";
        return (
          <div
            key={m.id}
            className={[
              "flex flex-col gap-1.5",
              isMine ? "items-end" : "items-start",
            ].join(" ")}
          >
            <span className="text-[11px] text-text-sub px-1">
              {isMine ? "나" : "chatbase.kr"} · {formatStamp(m.created_at)}
            </span>
            <div
              className={[
                "max-w-[85%] rounded-comfy px-3.5 py-2.5",
                "text-[13px] leading-relaxed whitespace-pre-wrap break-words",
                isMine
                  ? "bg-text-main text-text-inverse"
                  : "bg-bg-sub text-text-main",
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
