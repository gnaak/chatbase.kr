import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import Topbar from "@/component/layout/topbar";
import Card from "@/ui/card";
import Skeleton from "@/ui/skeleton";
import InquiryComposer from "@/component/inquiry/composer";
import InquiryThread from "@/component/inquiry/thread";
import { useGet, usePost } from "@/hooks/common/useAPI";
import { useToast } from "@/hooks/common/useToast";
import {
  CATEGORY_LABEL,
  InquiryThread as InquiryThreadDto,
  STATUS_LABEL,
} from "@/types/inquiry";

const STATUS_CLASS: Record<string, string> = {
  open: "bg-warning-bg text-point-amber",
  answered: "bg-success-bg text-point-green",
  closed: "bg-bg-sub text-text-sub",
};

const SupportDetail = () => {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [resetKey, setResetKey] = useState(0);

  const { data: thread, isLoading } = useGet<InquiryThreadDto>(
    `api/inquiry/me/${id}`,
    ["my-inquiry", id ?? ""],
    !!id,
    "/dashboard/support",
  );

  const send = usePost<{ content: string }, InquiryThreadDto>(
    `api/inquiry/me/${id}/messages`,
  );

  const handleSend = (content: string) => {
    send.mutate(
      { content },
      {
        onSuccess: () => {
          setResetKey((k) => k + 1);
          queryClient.invalidateQueries({ queryKey: ["my-inquiry", id ?? ""] });
          queryClient.invalidateQueries({ queryKey: ["my-inquiries"] });
          toast.success("문의가 등록되었습니다.");
        },
        onError: (e) => toast.error(e.message || "등록에 실패했습니다."),
      },
    );
  };

  const closed = thread?.status === "closed";

  return (
    <>
      <Topbar
        title={
          thread ? (
            thread.subject
          ) : (
            <Skeleton className="h-4 w-48 rounded-full" />
          )
        }
        description={
          thread
            ? `${CATEGORY_LABEL[thread.category]} · 문의 #${thread.id}`
            : undefined
        }
        backTo="/dashboard/support"
        actions={
          thread && (
            <span
              className={[
                "inline-flex items-center px-2 h-6 rounded-full text-[11px] font-medium",
                STATUS_CLASS[thread.status],
              ].join(" ")}
            >
              {STATUS_LABEL[thread.status]}
            </span>
          )
        }
      />

      <div className="flex-1 overflow-y-auto px-8 md:px-12 py-8">
        <div className="flex flex-col gap-5 max-w-3xl mx-auto">
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
              <p className="text-[13px] text-text-sub text-center">
                종료된 문의입니다. 추가로 궁금한 점이 있으면 새 문의를 등록해 주세요.
              </p>
            ) : (
              <InquiryComposer
                onSubmit={handleSend}
                pending={send.isPending}
                resetKey={resetKey}
              />
            ))}
        </div>
      </div>
    </>
  );
};

export default SupportDetail;
