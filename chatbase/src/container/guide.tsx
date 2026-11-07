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
import Topbar from "@/component/layout/topbar";
import Card from "@/ui/card";
import Button from "@/ui/button";

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

/**
 * 순서가 곧 메시지다. 한때 1단계가 "API 키 등록 (BYOK)"이었는데, 2026-09-12부터
 * OpenAI 키를 기본 제공하면서 키는 **선택**이 됐다. 그런데 가이드가 키부터 시키니
 * 가입한 사람이 "키를 만들어야 쓸 수 있나" 하고 OpenAI 콘솔 앞에서 멈췄다.
 * 그래서 만들기 → 내걸기 → (선택) 내 키 순서로 둔다.
 */
const SECTIONS: GuideSection[] = [
  {
    icon: Bot,
    title: "챗봇 만들기",
    tagline: "가입하면 API 키 없이 바로 만듭니다. 이름만 넣어도 저장됩니다.",
    steps: [
      {
        title: "새 챗봇 만들기",
        body: "대시보드에서 새 챗봇을 만듭니다.",
        link: { label: "새 챗봇 만들기", to: "/dashboard/bots/new" },
      },
      {
        title: "기본 정보",
        body:
          "챗봇 이름 · (선택) 로고와 위젯 아이콘.\n" +
          "모델은 무료 제공 모델로 자동으로 정해집니다. 고를 필요가 없습니다.",
      },
      {
        title: "학습 데이터",
        body:
          "안내문·공지·자주 묻는 질문을 텍스트로 붙여넣거나, 홈페이지 주소로 불러옵니다.\n" +
          "봇은 여기 넣은 내용을 근거로 답합니다.",
      },
      {
        title: "대화 설정 (선택)",
        body: "인사 메시지 · 시스템 프롬프트(톤, 역할, 금지사항) · 모를 때 안내할 연락처(Fallback).",
      },
      {
        title: "말 걸어보기",
        body: "PC 화면 오른쪽 미리보기에서 저장 전에도 바로 말을 걸어볼 수 있습니다.",
      },
    ],
  },
  {
    icon: Code2,
    title: "손님에게 내걸기",
    tagline: "홈페이지에는 코드 한 줄, 홈페이지가 없으면 QR 한 장이면 됩니다.",
    steps: [
      {
        title: "저장한 챗봇 열기",
        body: "저장하면 챗봇 페이지 아래에 '임베드 코드'와 'QR 코드'가 나타납니다.",
      },
      {
        title: "홈페이지가 있으면 — Script",
        body:
          "한 줄을 복사해 사이트의 </body> 직전에 붙여넣습니다.\n" +
          "사이트 우측 하단에 채팅 버블이 자동으로 뜹니다.",
      },
      {
        title: "홈페이지가 없으면 — QR",
        body:
          "QR 이미지를 내려받아 카운터·안내문에 인쇄해 두면 됩니다.\n" +
          "같은 주소를 카톡·문자로 보내도 그대로 채팅창이 열립니다.",
      },
    ],
    note: {
      variant: "info",
      text: "Script는 카페24 · 아임웹 · 워드프레스 · 노션처럼 HTML 삽입을 지원하는 빌더에서 모두 동작합니다. 특정 위치에 넣고 싶으면 iframe을 쓰세요.",
    },
  },
  {
    icon: KeyRound,
    title: "내 API 키 (선택)",
    tagline: "필수가 아닙니다. 다른 모델이나 파일 학습을 쓰고 싶을 때만 등록하세요.",
    steps: [
      {
        title: "무엇이 달라지나",
        body:
          "내 키를 등록하면 모델을 직접 고르고(OpenAI · Anthropic · Google),\n" +
          "파일 학습·웹 검색을 쓰며, 월 대화 건수 제한이 없어집니다.\n" +
          "그 대화의 모델 사용료는 본인 계정에 청구됩니다.",
      },
      {
        title: "등록하기",
        body:
          "API 키 메뉴에서 쓸 제공자 옆 '키 등록'을 누르고, 발급한 키를 붙여넣어 저장합니다.\n" +
          "키는 암호화해 저장하며, 체크 하나로 무료 제공 키와 오갈 수 있습니다.",
        link: { label: "API 키 열기", to: "/dashboard/keys" },
      },
    ],
    note: {
      variant: "warning",
      text:
        "파일 업로드(PDF·DOCX·TXT 자동 검색)는 유료 플랜 + 내 OpenAI 키 + OpenAI 모델 조합에서만 됩니다. Anthropic · Gemini 모델은 학습 텍스트에 넣은 내용만 사용합니다.",
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
