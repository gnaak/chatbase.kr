import { useState } from "react";
import { SendHorizonal } from "lucide-react";

import Button from "@shared/ui/button";
import Textarea from "@shared/ui/textarea";

interface InquiryComposerProps {
  /** 전송 버튼을 눌렀을 때. 성공 여부는 호출 측이 판단한다. */
  onSubmit: (content: string) => void;
  pending?: boolean;
  placeholder?: string;
  /** 전송 성공 후 호출 측이 이 값을 바꿔 입력을 비운다. */
  resetKey?: number;
}

const MAX = 5000;

/**
 * 스레드 하단 입력창. 대시보드 문의 상세와 공개 문의 페이지가 같이 쓴다.
 *
 * 서버가 5000자에서 자르므로 여기서도 같은 상한을 걸어둔다 —
 * 넘겨 보내고 조용히 잘리는 것보다 입력 단계에서 막는 쪽이 낫다.
 */
const InquiryComposer = ({
  onSubmit,
  pending,
  placeholder = "추가로 궁금한 점을 입력하세요.",
  resetKey = 0,
}: InquiryComposerProps) => {
  const [content, setContent] = useState("");
  const [lastReset, setLastReset] = useState(resetKey);

  // 부모가 resetKey를 올리면 입력을 비운다. useEffect 없이 렌더 중에 처리한다.
  if (resetKey !== lastReset) {
    setLastReset(resetKey);
    setContent("");
  }

  const text = content.trim();

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value.slice(0, MAX))}
        placeholder={placeholder}
        rows={4}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-text-sub">
          {content.length.toLocaleString()} / {MAX.toLocaleString()}
        </span>
        <Button
          size="sm"
          pill
          disabled={!text || pending}
          onClick={() => onSubmit(text)}
          rightIcon={<SendHorizonal className="w-3.5 h-3.5" />}
        >
          {pending ? "등록 중..." : "등록"}
        </Button>
      </div>
    </div>
  );
};

export default InquiryComposer;
