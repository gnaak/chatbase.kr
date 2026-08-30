import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { MessagesSquare } from "lucide-react";

import Button from "@/component/dashboard/ui/button";
import Card from "@/component/dashboard/ui/card";
import Field from "@/component/dashboard/ui/field";
import Input from "@/component/dashboard/ui/input";
import Select from "@/component/dashboard/ui/select";
import Textarea from "@/component/dashboard/ui/textarea";
import SupportLayout from "@/container/support/layout";
import { usePost } from "@/hooks/common/useAPI";
import { useAuth } from "@/hooks/common/useAuth";
import { useToast } from "@/hooks/common/useToast";
import {
  CATEGORY_LABEL,
  CATEGORY_OPTIONS,
  Inquiry,
  InquiryCategory,
} from "@/types/inquiry";

const NAME_MAX = 50;
const EMAIL_MAX = 100;
const SUBJECT_MAX = 200;
const CONTENT_MAX = 5000;

interface CreateBody {
  name?: string;
  email?: string;
  category: InquiryCategory;
  subject: string;
  content: string;
}

/** 서버와 같은 기준. 정규식으로 RFC를 흉내내지 않고 형식 붕괴만 막는다. */
const looksLikeEmail = (value: string) => {
  if (!value.includes("@") || value.includes(" ")) return false;
  const [local, domain] = value.split("@");
  return !!local && !!domain && domain.includes(".") && !domain.startsWith(".");
};

const isCategory = (value: string | null): value is InquiryCategory =>
  !!value && value in CATEGORY_LABEL;

const SupportForm = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  // 가격표의 "구축 문의하기"가 `/support?category=partnership`으로 들어온다.
  const initialCategory = searchParams.get("category");

  const [category, setCategory] = useState<InquiryCategory>(
    isCategory(initialCategory) ? initialCategory : "general",
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [touched, setTouched] = useState(false);

  const create = usePost<CreateBody, Inquiry & { access_token: string }>(
    "api/inquiry/",
  );

  // 로그인 상태면 서버가 쿠키를 보고 이름·메일을 채운다. 다시 물을 이유가 없다.
  const emailInvalid = !user && touched && !looksLikeEmail(email.trim());
  const nameInvalid = !user && touched && !name.trim();

  const canSubmit =
    !!subject.trim() &&
    !!content.trim() &&
    (!!user || (!!name.trim() && looksLikeEmail(email.trim()))) &&
    !create.isPending;

  const handleSubmit = () => {
    setTouched(true);
    if (!canSubmit) return;

    const body: CreateBody = {
      category,
      subject: subject.trim(),
      content: content.trim(),
    };
    if (!user) {
      body.name = name.trim();
      body.email = email.trim();
    }

    create.mutate(body, {
      onSuccess: (created) => {
        // 회원은 대시보드에 목록이 남으니 그쪽으로, 비회원은 토큰 링크가
        // 스레드로 돌아오는 유일한 길이라 바로 그 주소로 보낸다.
        if (user) {
          navigate(`/dashboard/support/${created.id}`);
        } else {
          navigate(`/support/${created.access_token}?new=1`);
        }
      },
      onError: (e) => toast.error(e.message || "문의 등록에 실패했습니다."),
    });
  };

  return (
    <SupportLayout
      title="문의하기"
      description="서비스에 대해 궁금한 점을 남겨주세요. 보통 영업일 기준 하루 안에 답변드립니다."
      actions={
        user && (
          <Link
            to="/dashboard/support"
            className="inline-flex items-center gap-1.5 text-[13px] text-text-sub hover:text-text-main transition-colors"
          >
            <MessagesSquare className="w-3.5 h-3.5" />내 문의 내역
          </Link>
        )
      }
    >
      <Card className="flex flex-col gap-5 p-6">
        {user ? (
          <p className="text-[13px] text-text-sub bg-bg-sub rounded-comfy px-3.5 py-2.5">
            <span className="text-text-main font-medium">{user.user_nickname}</span>
            님으로 문의합니다. 답변은 대시보드의 문의 내역과 가입하신 이메일로
            함께 보내드립니다.
          </p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="이름" htmlFor="support-name" required error={nameInvalid ? "이름을 입력해 주세요." : undefined}>
              <Input
                id="support-name"
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, NAME_MAX))}
                placeholder="홍길동"
                invalid={nameInvalid}
              />
            </Field>
            <Field
              label="답변받을 이메일"
              htmlFor="support-email"
              required
              error={emailInvalid ? "이메일 주소를 정확히 입력해 주세요." : undefined}
            >
              <Input
                id="support-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value.slice(0, EMAIL_MAX))}
                placeholder="you@example.com"
                invalid={emailInvalid}
              />
            </Field>
          </div>
        )}

        <Field label="유형" htmlFor="support-category">
          <Select
            id="support-category"
            value={category}
            onChange={(v) => setCategory(v as InquiryCategory)}
            options={CATEGORY_OPTIONS}
          />
        </Field>

        <Field
          label="제목"
          htmlFor="support-subject"
          required
          count={subject.length}
          max={SUBJECT_MAX}
        >
          <Input
            id="support-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value.slice(0, SUBJECT_MAX))}
            placeholder="어떤 점이 궁금하신가요?"
          />
        </Field>

        <Field
          label="내용"
          htmlFor="support-content"
          required
          description="사용 중인 사이트 주소나 화면을 함께 알려주시면 더 빠르게 확인할 수 있습니다."
          count={content.length}
          max={CONTENT_MAX}
        >
          <Textarea
            id="support-content"
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, CONTENT_MAX))}
            placeholder="문의 내용을 자세히 적어주세요."
            rows={8}
          />
        </Field>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[11px] text-text-sub">
            문의 내용과 연락처는 답변 목적으로만 사용합니다.{" "}
            <Link to="/privacy" className="underline underline-offset-2">
              개인정보처리방침
            </Link>
          </p>
          <Button
            size="md"
            pill
            disabled={create.isPending}
            onClick={handleSubmit}
          >
            {create.isPending ? "등록 중..." : "문의 등록"}
          </Button>
        </div>
      </Card>
    </SupportLayout>
  );
};

export default SupportForm;
