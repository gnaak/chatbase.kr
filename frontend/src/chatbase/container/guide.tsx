import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Code2,
  ExternalLink,
  Info,
  KeyRound,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import Topbar from "@chatbase/component/layout/topbar";
import Card from "@shared/ui/card";
import Button from "@shared/ui/button";

/**
 * 가이드 화면 — 카카오톡 연결 가이드(`component/dashboard/bot/kakaoConnect.tsx`)와
 * 같은 형태를 쓴다. 작은 번호 원 + 12px 본문 + 링크는 작은 pill 버튼.
 *
 * 문장 안에 링크를 심지 않고 단계마다 버튼 하나로 뺀 이유: 본문을 문자열로 두면
 * 줄바꿈(\n)만으로 단계를 늘릴 수 있고, 눌러야 할 곳이 한 군데로 모인다.
 */

interface GuideStep {
  title: string;
  body: string;
  /** 내부 경로는 `to`, 외부는 `href`. */
  link?: { label: string; to?: string; href?: string };
}

interface GuideSection {
  icon: LucideIcon;
  title: string;
  tagline: string;
  steps: GuideStep[];
  note?: { variant: "info" | "warning"; text: string };
}

const SECTIONS: GuideSection[] = [
  {
    icon: KeyRound,
    title: "API 키 등록 (BYOK)",
    tagline: "OpenAI · Anthropic · Google 중 쓸 곳의 키만 등록하면 됩니다.",
    steps: [
      {
        title: "API 키 메뉴 열기",
        body:
          "chatbase.kr은 키를 보관하지 않고 직접 발급한 키로 호출합니다.\n" +
          "사용량은 그대로 본인 계정에 청구되고 별도 마진은 없습니다.",
        link: { label: "API 키 열기", to: "/dashboard/keys" },
      },
      {
        title: "제공자 선택",
        body: "사용할 제공자(OpenAI / Anthropic / Google) 옆 '키 등록'을 누릅니다.",
      },
      {
        title: "키 발급 후 붙여넣기",
        body:
          "키 발급처 링크에서 새 키를 발급해 복사한 뒤, 입력창에 붙여넣고 저장합니다.",
      },
    ],
    note: {
      variant: "info",
      text: "한 제공자만 등록해도 동작합니다. 여러 모델을 비교하려면 둘 이상 등록하면 됩니다.",
    },
  },
  {
    icon: Bot,
    title: "챗봇 만들기",
    tagline: "이름, 인사말, 학습 데이터를 넣고 저장하면 끝입니다.",
    steps: [
      {
        title: "새 챗봇 만들기",
        body: "대시보드에서 새 챗봇을 만듭니다.",
        link: { label: "새 챗봇 만들기", to: "/dashboard/bots/new" },
      },
      {
        title: "기본 정보",
        body:
          "챗봇 이름 · 모델 선택 · (선택) 로고와 위젯 아이콘.\n" +
          "모델은 등록한 키의 제공자 것만 활성화됩니다.",
      },
      {
        title: "대화 설정",
        body: "인사 메시지 · 시스템 프롬프트(톤, 역할, 금지사항) · Fallback 메시지.",
      },
      {
        title: "학습 데이터",
        body:
          "텍스트로 직접 입력하거나, OpenAI 모델이면 파일 업로드도 쓸 수 있습니다.",
      },
      {
        title: "저장 후 테스트",
        body: "저장하면 미리보기 위젯에서 바로 말을 걸어볼 수 있습니다.",
      },
    ],
    note: {
      variant: "warning",
      text:
        "파일 업로드(벡터 스토어)는 OpenAI 모델 전용입니다. PDF·DOCX·TXT 같은 긴 문서를 자동으로 검색해 답변하려면 OpenAI 키 + OpenAI 모델 조합이어야 합니다. Anthropic · Gemini 모델은 학습 텍스트에 직접 넣은 내용만 사용합니다.",
    },
  },
  {
    icon: Code2,
    title: "사이트에 임베드",
    tagline: "복사한 한 줄을 사이트에 붙여넣기만 하면 됩니다.",
    steps: [
      {
        title: "임베드 코드 열기",
        body: "저장된 챗봇 페이지 하단 '임베드 코드' 섹션을 엽니다.",
      },
      {
        title: "Script (권장)",
        body:
          "한 줄을 복사해 사이트의 </body> 직전에 붙여넣습니다.\n" +
          "사이트 우측 하단에 채팅 버블이 자동으로 뜹니다.",
      },
      {
        title: "iframe",
        body: "페이지 안 특정 위치에 채팅창을 넣고 싶을 때 사용합니다.",
      },
    ],
    note: {
      variant: "info",
      text: "카페24 · 아임웹 · 워드프레스 · 노션처럼 HTML 삽입을 지원하는 빌더에서 모두 동작합니다.",
    },
  },
];

const Note = ({
  variant,
  children,
}: {
  variant: "info" | "warning";
  children: React.ReactNode;
}) => (
  <div
    className={[
      "flex items-start gap-2 px-3 py-2.5 rounded-comfy",
      variant === "warning" ? "bg-warning-bg" : "bg-bg-sub shadow-border",
    ].join(" ")}
  >
    {variant === "warning" ? (
      <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
    ) : (
      <Info className="w-3.5 h-3.5 text-text-sub shrink-0 mt-0.5" />
    )}
    <p
      className={[
        "text-[12px] leading-relaxed",
        variant === "warning" ? "text-text-main" : "text-text-sub",
      ].join(" ")}
    >
      {children}
    </p>
  </div>
);

const StepLink = ({ link }: { link: NonNullable<GuideStep["link"]> }) => {
  const button = (
    <Button
      size="sm"
      pill
      variant="secondary"
      rightIcon={
        link.to ? (
          <ArrowRight className="w-3 h-3" />
        ) : (
          <ExternalLink className="w-3 h-3" />
        )
      }
    >
      {link.label}
    </Button>
  );

  return link.to ? (
    <Link to={link.to} className="inline-block mt-2">
      {button}
    </Link>
  ) : (
    <a
      href={link.href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-block mt-2"
    >
      {button}
    </a>
  );
};

const Section = ({ section }: { section: GuideSection }) => {
  const { icon: Icon, title, tagline, steps, note } = section;

  return (
    <Card variant="outline" className="p-4 flex flex-col gap-3.5">
      <div className="flex items-start gap-2.5">
        <span className="w-7 h-7 rounded-DEFAULT bg-bg-sub shadow-border flex items-center justify-center shrink-0 text-text-sub">
          <Icon className="w-3.5 h-3.5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-[13px] font-medium text-text-main">{title}</h2>
          <p className="text-[12px] text-text-sub mt-0.5 leading-relaxed">
            {tagline}
          </p>
        </div>
      </div>

      <ol className="flex flex-col gap-3">
        {steps.map((step, i) => (
          <li key={step.title} className="flex items-start gap-3">
            <span className="w-5 h-5 rounded-full bg-bg-sub shadow-border shrink-0 flex items-center justify-center font-mono text-[11px] text-text-sub mt-0.5">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-text-main">
                {step.title}
              </p>
              {/* body의 \n을 줄바꿈으로 살린다 — 조건이 둘 이상이면 줄을 나누는 쪽이 잘 읽힌다. */}
              <p className="text-[12px] text-text-sub mt-0.5 leading-relaxed whitespace-pre-line">
                {step.body}
              </p>
              {step.link && <StepLink link={step.link} />}
            </div>
          </li>
        ))}
      </ol>

      {note && <Note variant={note.variant}>{note.text}</Note>}
    </Card>
  );
};

const Guide = () => {
  return (
    <>
      <Topbar
        title="가이드"
        description="챗봇을 만들고 사이트에 붙이기까지 순서대로 안내합니다."
      />

      <div className="flex-1 overflow-y-auto px-8 md:px-12 py-8">
        <div className="flex flex-col gap-4 max-w-3xl mx-auto">
          {/* 전체 흐름을 먼저 한 줄로 보여준다. 세 단계뿐이라는 게 먼저 읽혀야 한다. */}
          <div className="flex items-center gap-2 flex-wrap text-[12px] text-text-sub">
            {SECTIONS.map((s, i) => (
              <span key={s.title} className="flex items-center gap-2">
                {i > 0 && <ArrowRight className="w-3 h-3 text-text-disabled" />}
                <span className="inline-flex items-center gap-1.5 px-2.5 h-6 rounded-full bg-bg-sub shadow-border">
                  <s.icon className="w-3 h-3" />
                  {s.title.split(" (")[0]}
                </span>
              </span>
            ))}
          </div>

          {SECTIONS.map((section) => (
            <Section key={section.title} section={section} />
          ))}

          <Card variant="outline" className="p-4 flex flex-col gap-3">
            <div className="flex items-start gap-2.5">
              <span className="w-7 h-7 rounded-DEFAULT bg-bg-sub shadow-border flex items-center justify-center shrink-0 text-text-sub">
                <ShieldCheck className="w-3.5 h-3.5" />
              </span>
              <div className="min-w-0">
                <h2 className="text-[13px] font-medium text-text-main">
                  한 가지 더
                </h2>
                <p className="text-[12px] text-text-sub mt-0.5 leading-relaxed">
                  주고받은 대화는 전부 대화 로그에서 확인할 수 있습니다. 봇
                  응답이 어색하면 시스템 프롬프트 보강 → 학습 텍스트 추가 → 모델
                  변경 순서로 손보면 빠르게 개선됩니다.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Link to="/dashboard/conversations">
                <Button
                  size="sm"
                  pill
                  variant="secondary"
                  rightIcon={<ArrowRight className="w-3 h-3" />}
                >
                  대화 로그
                </Button>
              </Link>
              <Link to="/dashboard/keys">
                <Button
                  size="sm"
                  pill
                  rightIcon={<ArrowRight className="w-3 h-3" />}
                >
                  지금 시작하기
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
};

export default Guide;
