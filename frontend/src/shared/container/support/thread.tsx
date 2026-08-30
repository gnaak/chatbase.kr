import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Bookmark, Check, Copy } from "lucide-react";

import Button from "@shared/ui/button";
import Card from "@shared/ui/card";
import Skeleton from "@shared/ui/skeleton";
import InquiryComposer from "@shared/component/inquiry/composer";
import InquiryThread from "@shared/component/inquiry/thread";
import SupportLayout from "@shared/container/support/layout";
import { useGet, usePost } from "@shared/hooks/common/useAPI";
import { useToast } from "@shared/hooks/common/useToast";
import {
  CATEGORY_LABEL,
  InquiryThread as InquiryThreadDto,
  STATUS_LABEL,
} from "@shared/types/inquiry";

const STATUS_CLASS: Record<string, string> = {
  open: "bg-warning-bg text-point-amber",
  answered: "bg-success-bg text-point-green",
  closed: "bg-bg-sub text-text-sub",
};

const SupportThread = () => {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [resetKey, setResetKey] = useState(0);
  const [copied, setCopied] = useState(false);

  //: 방금 등록하고 넘어온 경우. 이 주소가 스레드로 돌아오는 유일한 길이라
  //: 첫 진입에서 한 번 크게 알려준다.
  const isNew = searchParams.get("new") === "1";

  const queryKey = ["inquiry-token", token ?? ""];
  const {
    data: thread,
    isLoading,
    isError,
  } = useGet<InquiryThreadDto>(
    `api/inquiry/token/${token}`,
    queryKey,
    !!token,
  );

  const send = usePost<{ content: string }, InquiryThreadDto>(
    `api/inquiry/token/${token}/messages`,
  );

  const handleSend = (content: string) => {
    send.mutate(
      { content },
      {
        onSuccess: () => {
          setResetKey((k) => k + 1);
          queryClient.invalidateQueries({ queryKey });
          toast.success("문의가 등록되었습니다.");
        },
        onError: (e) => toast.error(e.message || "등록에 실패했습니다."),
      },
    );
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin + `/support/${token}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("주소 복사에 실패했습니다. 주소창에서 직접 복사해 주세요.");
    }
  };

  if (isError) {
    return (
      <SupportLayout
        title="문의를 찾을 수 없습니다"
        description="주소가 잘못되었거나 문의가 삭제되었을 수 있습니다."
      >
        <Card className="flex flex-col items-center gap-4 py-14 px-6 text-center">
          <p className="text-[13px] text-text-sub">
            링크를 다시 확인해 주세요. 문제가 계속되면 새로 문의해 주시면
            도와드리겠습니다.
          </p>
          <Link to="/support">
            <Button size="sm" pill>
              새 문의하기
            </Button>
          </Link>
        </Card>
      </SupportLayout>
    );
  }

  const closed = thread?.status === "closed";

  return (
    <SupportLayout
      eyebrow={thread ? `문의 #${thread.id}` : "SUPPORT"}
      title={thread?.subject ?? "문의 내역"}
      description={
        thread ? (
          <span className="inline-flex items-center gap-2">
            <span
              className={[
                "inline-flex items-center px-2 h-6 rounded-full text-[11px] font-medium",
                STATUS_CLASS[thread.status],
              ].join(" ")}
            >
              {STATUS_LABEL[thread.status]}
            </span>
            <span>{CATEGORY_LABEL[thread.category]}</span>
          </span>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-5">
        {isNew && (
          <div className="flex items-start gap-3 rounded-comfy bg-info-bg px-4 py-3.5">
            <Bookmark className="w-4 h-4 text-point-blue shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-text-main">
                이 페이지 주소를 저장해 두세요
              </p>
              <p className="text-[12px] text-text-sub mt-0.5 leading-relaxed">
                답변이 등록되면 이 주소에서 확인하고 이어서 질문할 수 있습니다.
                남겨주신 연락처로도 안내드립니다.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              pill
              onClick={handleCopy}
              leftIcon={
                copied ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )
              }
            >
              {copied ? "복사됨" : "주소 복사"}
            </Button>
          </div>
        )}

        <Card className="p-5">
          {isLoading || !thread ? (
            <div className="flex flex-col gap-4">
              <Skeleton className="h-16 w-4/5 rounded-comfy self-end" />
              <Skeleton className="h-20 w-4/5 rounded-comfy" />
            </div>
          ) : (
            <InquiryThread messages={thread.messages} />
          )}
        </Card>

        {thread &&
          (closed ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <p className="text-[13px] text-text-sub">
                종료된 문의입니다. 추가로 궁금한 점이 있으면 새로 문의해 주세요.
              </p>
              <Link to="/support">
                <Button size="sm" pill variant="secondary">
                  새 문의하기
                </Button>
              </Link>
            </div>
          ) : (
            <InquiryComposer
              onSubmit={handleSend}
              pending={send.isPending}
              resetKey={resetKey}
            />
          ))}
      </div>
    </SupportLayout>
  );
};

export default SupportThread;
