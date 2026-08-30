import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, MessagesSquare, Plus, X } from "lucide-react";

import Topbar from "@/component/dashboard/layout/topbar";
import Button from "@/component/dashboard/ui/button";
import Card from "@/component/dashboard/ui/card";
import Field from "@/component/dashboard/ui/field";
import Input from "@/component/dashboard/ui/input";
import Select from "@/component/dashboard/ui/select";
import Skeleton from "@/component/dashboard/ui/skeleton";
import Textarea from "@/component/dashboard/ui/textarea";
import { useGet, usePost } from "@/hooks/common/useAPI";
import { useToast } from "@/hooks/common/useToast";
import {
  CATEGORY_LABEL,
  CATEGORY_OPTIONS,
  Inquiry,
  InquiryCategory,
  InquiryListItem,
  STATUS_LABEL,
} from "@/types/inquiry";

const LIST_KEY = ["my-inquiries"];

const SUBJECT_MAX = 200;
const CONTENT_MAX = 5000;

/** 상태 점 색. 답변이 왔다는 신호만 눈에 띄면 된다. */
const STATUS_DOT: Record<string, string> = {
  open: "bg-point-amber",
  answered: "bg-point-green",
  closed: "bg-text-disabled",
};

const formatStamp = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleString("ko-KR", { hour12: false });
};

const Support = () => {
  const navigate = useNavigate();
  const [composing, setComposing] = useState(false);

  const { data: inquiries, isLoading } = useGet<InquiryListItem[]>(
    "api/inquiry/me",
    LIST_KEY,
  );

  return (
    <>
      <Topbar
        title="문의"
        description="1:1로 문의하면 답변을 이 화면과 메일로 함께 보내드립니다."
        actions={
          !composing && (
            <Button
              size="sm"
              pill
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setComposing(true)}
            >
              새 문의
            </Button>
          )
        }
      />

      <div className="flex-1 overflow-y-auto px-8 md:px-12 py-8">
        <div className="flex flex-col gap-4 max-w-3xl mx-auto">
          {composing && <NewInquiryForm onClose={() => setComposing(false)} />}

          {isLoading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-[76px] rounded-comfy" />
              ))}
            </div>
          ) : !inquiries || inquiries.length === 0 ? (
            !composing && (
              <Card className="flex flex-col items-center gap-3 py-14 px-6 text-center">
                <MessagesSquare className="w-6 h-6 text-text-disabled" />
                <div>
                  <p className="text-[14px] font-medium text-text-main">
                    아직 문의 내역이 없습니다
                  </p>
                  <p className="text-[13px] text-text-sub mt-1">
                    궁금한 점이 있으면 언제든 물어보세요. 보통 영업일 기준 하루 안에
                    답변드립니다.
                  </p>
                </div>
                <Button size="sm" pill onClick={() => setComposing(true)}>
                  문의하기
                </Button>
              </Card>
            )
          ) : (
            <div className="flex flex-col gap-2">
              {inquiries.map((item) => (
                <Card
                  key={item.id}
                  interactive
                  onClick={() => navigate(`/dashboard/support/${item.id}`)}
                  className="flex items-center gap-3 px-4 py-3.5"
                >
                  <span
                    className={[
                      "shrink-0 w-1.5 h-1.5 rounded-full",
                      STATUS_DOT[item.status],
                    ].join(" ")}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-text-main truncate">
                        {item.subject}
                      </span>
                      {/* 마지막 글이 관리자면 아직 안 읽었을 가능성이 높다. */}
                      {item.last_sender === "admin" && (
                        <span className="shrink-0 text-[10px] font-medium px-1.5 h-4 inline-flex items-center rounded-full bg-success-bg text-point-green">
                          답변
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-text-sub mt-0.5 truncate">
                      {CATEGORY_LABEL[item.category]} ·{" "}
                      {STATUS_LABEL[item.status]} · 글 {item.message_count}개 ·{" "}
                      {formatStamp(item.last_message_at ?? item.updated_at)}
                    </div>
                  </div>
                  <ChevronRight className="shrink-0 w-4 h-4 text-text-disabled" />
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

interface NewInquiryFormProps {
  onClose: () => void;
}

const NewInquiryForm = ({ onClose }: NewInquiryFormProps) => {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [category, setCategory] = useState<InquiryCategory>("general");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");

  const create = usePost<
    { category: InquiryCategory; subject: string; content: string },
    Inquiry
  >("api/inquiry/");

  const canSubmit = !!subject.trim() && !!content.trim() && !create.isPending;

  const handleSubmit = () => {
    if (!canSubmit) return;
    create.mutate(
      { category, subject: subject.trim(), content: content.trim() },
      {
        onSuccess: (created) => {
          queryClient.invalidateQueries({ queryKey: LIST_KEY });
          toast.success("문의가 접수되었습니다.");
          navigate(`/dashboard/support/${created.id}`);
        },
        onError: (e) => toast.error(e.message || "문의 등록에 실패했습니다."),
      },
    );
  };

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[14px] font-semibold text-text-main">새 문의</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="
            inline-flex items-center justify-center w-7 h-7 rounded-full
            text-text-sub hover:text-text-main hover:bg-bg-hover transition-colors
          "
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <Field label="유형" htmlFor="inquiry-category">
        <Select
          id="inquiry-category"
          value={category}
          onChange={(v) => setCategory(v as InquiryCategory)}
          options={CATEGORY_OPTIONS}
        />
      </Field>

      <Field
        label="제목"
        htmlFor="inquiry-subject"
        required
        count={subject.length}
        max={SUBJECT_MAX}
      >
        <Input
          id="inquiry-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value.slice(0, SUBJECT_MAX))}
          placeholder="어떤 점이 궁금하신가요?"
        />
      </Field>

      <Field
        label="내용"
        htmlFor="inquiry-content"
        required
        description="사용 중인 봇 이름이나 화면을 함께 알려주시면 더 빠르게 확인할 수 있습니다."
        count={content.length}
        max={CONTENT_MAX}
      >
        <Textarea
          id="inquiry-content"
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, CONTENT_MAX))}
          placeholder="문의 내용을 자세히 적어주세요."
          rows={7}
        />
      </Field>

      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          취소
        </Button>
        <Button size="sm" pill disabled={!canSubmit} onClick={handleSubmit}>
          {create.isPending ? "등록 중..." : "문의 등록"}
        </Button>
      </div>
    </Card>
  );
};

export default Support;
