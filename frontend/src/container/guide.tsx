import { Link } from "react-router-dom";
import {
  ArrowRight,
  KeyRound,
  Bot,
  Code2,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import Topbar from "@/component/dashboard/layout/topbar";

const Guide = () => {
  return (
    <>
      <Topbar
        title="가이드"
        description="API 키 등록 → 챗봇 만들기 → 사이트 임베드, 3분이면 끝납니다."
      />

      <div className="flex-1 overflow-y-auto px-8 md:px-12 py-8">
        <div className="flex flex-col gap-6 max-w-3xl mx-auto">
          <Step
            n={1}
            icon={<KeyRound className="w-5 h-5" />}
            title="API 키 등록 (BYOK)"
            tagline="OpenAI · Anthropic · Google 중 사용할 곳의 키를 등록합니다."
          >
            <p>
              chatbase.kr은 키를 보관하지 않고, 직접 발급한 키로 호출합니다.{" "}
              <strong className="text-text-main">
                사용량은 그대로 본인 계정에 청구
              </strong>
              되고 별도 마진은 없습니다.
            </p>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>
                대시보드 →{" "}
                <Link
                  to="/dashboard/keys"
                  className="underline text-text-main hover:opacity-80"
                >
                  API 키
                </Link>{" "}
                메뉴 진입
              </li>
              <li>
                사용할 제공자(OpenAI / Anthropic / Google) 옆 "키 등록" 클릭
              </li>
              <li>
                키 발급처 링크에서 새 키 발급 → 복사 → 입력창에 붙여넣고 저장
              </li>
            </ol>
            <Note variant="info">
              한 제공자만 등록해도 동작합니다. 여러 모델을 비교하려면 둘 이상
              등록하면 됩니다.
            </Note>
          </Step>

          <Step
            n={2}
            icon={<Bot className="w-5 h-5" />}
            title="챗봇 만들기"
            tagline="이름, 인사말, 학습 데이터를 입력하고 저장하면 끝."
          >
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>
                대시보드 →{" "}
                <Link
                  to="/dashboard/bots/new"
                  className="underline text-text-main hover:opacity-80"
                >
                  새 챗봇 만들기
                </Link>
              </li>
              <li>
                <strong className="text-text-main">기본 정보</strong>: 챗봇
                이름 · 모델 선택 (등록한 키의 제공자 모델만 활성화됨) · (선택)
                로고와 위젯 아이콘
              </li>
              <li>
                <strong className="text-text-main">대화 설정</strong>: 인사
                메시지 · 시스템 프롬프트(톤, 역할, 금지사항) · Fallback 메시지
              </li>
              <li>
                <strong className="text-text-main">학습 데이터</strong>:
                텍스트로 직접 입력하거나, OpenAI 모델일 때는 파일 업로드도
                가능 (아래 설명)
              </li>
              <li>저장 → 미리보기 위젯에서 바로 테스트</li>
            </ol>
            <Note variant="warning">
              <strong>파일 업로드(벡터 스토어)는 OpenAI 모델 전용</strong>
              입니다. PDF/DOCX/TXT 같은 긴 문서를 자동으로 검색해 답변하려면
              OpenAI 키 + OpenAI 모델 조합이어야 합니다. Anthropic / Gemini
              모델은 학습 텍스트(textarea)에 직접 입력한 내용만 사용합니다.
            </Note>
          </Step>

          <Step
            n={3}
            icon={<Code2 className="w-5 h-5" />}
            title="사이트에 임베드"
            tagline="대시보드에서 복사한 한 줄을 사이트에 붙여넣기만 하면 됩니다."
          >
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>저장된 챗봇 페이지 하단 "임베드 코드" 섹션</li>
              <li>
                <strong className="text-text-main">Script (권장)</strong>:
                사이트 우측 하단에 채팅 버블이 자동으로 떠요. 한 줄 복사 →
                사이트의{" "}
                <code className="font-mono text-[12px] px-1 py-0.5 rounded bg-bg-sub">
                  &lt;/body&gt;
                </code>{" "}
                직전에 붙여넣기
              </li>
              <li>
                <strong className="text-text-main">iframe</strong>: 페이지 안의
                특정 위치에 채팅창을 박고 싶을 때 사용
              </li>
            </ol>
            <Note variant="info">
              카페24·아임웹·워드프레스·노션 등 HTML 코드 삽입을 지원하는 모든
              빌더에서 동작합니다. 운영 중인 사이트의 사이드바, 푸터, 본문
              위젯 영역 어디든 가능.
            </Note>
          </Step>

          {/* Tail */}
          <div className="rounded-comfy bg-bg-card shadow-border p-6 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-text-main" />
              <h3 className="text-[14px] font-semibold tracking-tight text-text-main">
                한 가지 더
              </h3>
            </div>
            <p className="text-[13px] text-text-sub leading-relaxed">
              대화 로그는{" "}
              <Link
                to="/dashboard/conversations"
                className="underline text-text-main hover:opacity-80"
              >
                대화 내역
              </Link>{" "}
              메뉴에서 모두 확인할 수 있습니다. 봇 응답이 어색하면 시스템
              프롬프트 보강 → 학습 텍스트 추가 → 모델 변경 순서로 손보면 빠르게
              개선됩니다.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Link
                to="/dashboard/keys"
                className="
                  inline-flex items-center gap-1.5 h-9 px-4 rounded-full
                  bg-text-main text-text-inverse text-[13px] font-medium
                  hover:bg-text-main/90 transition-colors
                "
              >
                지금 시작하기
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

interface StepProps {
  n: number;
  icon: React.ReactNode;
  title: string;
  tagline: string;
  children: React.ReactNode;
}

const Step = ({ n, icon, title, tagline, children }: StepProps) => (
  <section className="relative pl-14">
    {/* number badge */}
    <div className="absolute left-0 top-0 w-9 h-9 rounded-full bg-text-main text-text-inverse flex items-center justify-center text-[13px] font-semibold ring-4 ring-bg">
      {n}
    </div>

    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-DEFAULT bg-bg-sub text-text-sub">
          {icon}
        </span>
        <h2 className="text-[16px] font-semibold tracking-tight text-text-main">
          {title}
        </h2>
      </div>
      <p className="text-[13px] text-text-sub leading-relaxed -mt-1">
        {tagline}
      </p>
      <div className="flex flex-col gap-3 text-[13px] text-text-main leading-relaxed">
        {children}
      </div>
    </div>
  </section>
);

interface NoteProps {
  variant: "info" | "warning";
  children: React.ReactNode;
}

const Note = ({ variant, children }: NoteProps) => {
  const tone =
    variant === "warning"
      ? "bg-amber-50 text-amber-900 ring-amber-200"
      : "bg-bg-sub text-text-main ring-line";
  return (
    <div
      className={[
        "rounded-DEFAULT ring-1 px-3.5 py-3 flex items-start gap-2 text-[12.5px] leading-relaxed",
        tone,
      ].join(" ")}
    >
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 opacity-80" />
      <div className="flex-1">{children}</div>
    </div>
  );
};

export default Guide;
