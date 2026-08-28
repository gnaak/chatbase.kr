import { RefreshCw, AlertTriangle, Check, ExternalLink } from "lucide-react";
import Button from "@/component/dashboard/ui/button";
import Card from "@/component/dashboard/ui/card";
import CodeBlock from "@/component/dashboard/ui/codeBlock";
import { useGet } from "@/hooks/common/useAPI";

interface KakaoConnectionDto {
  skill_url: string;
  secret: string;
  connected: boolean;
  last_message_at: string | null;
}

interface Step {
  title: string;
  body: string;
  /** 해당 단계를 진행할 카카오 사이트. 있으면 바로가기 버튼을 붙인다. */
  link?: { label: string; href: string };
}

const STEPS: Step[] = [
  {
    title: "카카오톡 채널 만들기",
    body:
      "카카오비즈니스 파트너센터에서 채널을 개설합니다. 본인인증이 필요해 대신 만들어 드릴 수 없습니다.\n" +
      "사업자등록증은 없어도 됩니다. 없으면 일반 채널로 개설되고, 나중에 비즈니스 채널로 전환할 수 있습니다.",
    link: { label: "파트너센터 열기", href: "https://business.kakao.com" },
  },
  {
    title: "채널 공개 켜기",
    body:
      "채널 > 채널 정보 > 옵션 설정 으로 이동해 '채널 공개'를 ON으로 바꿉니다.\n" +
      "꺼져 있으면 다음 단계에서 채널을 봇에 연결할 수 없습니다. 같은 화면의 '검색 허용'도 켜두면 카카오톡에서 채널이 검색됩니다.",
  },
  {
    title: "카카오 i 오픈빌더에서 봇 생성",
    body: "챗봇 관리자센터에 로그인해 새 봇을 만듭니다.",
    link: { label: "오픈빌더 열기", href: "https://chatbot.kakao.com" },
  },
  {
    title: "스킬 등록",
    body:
      "좌측 '스킬' 메뉴에서 스킬을 새로 만듭니다. 스킬명은 자유롭게 정하고, 'URL' 칸에 아래 주소를 그대로 붙여넣은 뒤 저장합니다.\n" +
      "설명 · Test URL · 헤더값은 모두 비워두셔도 됩니다. 인증에 쓰는 시크릿이 URL 안에 이미 들어있습니다.",
  },
  {
    title: "폴백 블록에서 스킬 선택",
    body:
      "시나리오 > 폴백 블록으로 이동해, '파라미터 설정' 오른쪽 드롭다운에서 방금 만든 스킬을 고릅니다.\n" +
      "일반 파라미터와 필수 파라미터는 비워둡니다. 따로 매핑할 값이 없습니다.",
  },
  {
    title: "봇 응답을 '스킬데이터형'으로 바꾸기",
    body:
      "같은 화면 아래 '봇 응답'의 응답 유형을 '텍스트형'에서 '스킬데이터형'으로 바꿉니다. 기본으로 들어있는 문구(\"무엇을 원하는지 잘 모르겠어요\" 등)는 지우지 않아도 되고, 유형만 바꾸면 됩니다.\n" +
      "가장 많이 놓치는 단계입니다. 텍스트형인 채로 두면 챗봇이 답을 만들어 보내도 그대로 버려지고, 미리 적힌 기본 문구만 나갑니다.",
  },
  {
    title: "Callback API 켜기 (권장)",
    body:
      "폴백 블록 우측 상단 '⋯' > 'Callback API 설정'에서 활성화합니다. '응답대기 메시지'에는 \"답변을 준비하고 있어요. 잠시만 기다려 주세요\" 처럼 실제로 보여줄 문구를 꼭 적어주세요. 비워두면 아무것도 안 뜹니다.\n" +
      "카카오는 스킬 응답을 5초 안에 받아야 하는데, 파일 학습을 쓰면 이 시간을 넘겨 답이 끊깁니다. 켜두면 방금 입력하신 응답대기 메시지가 먼저 나가고, 완성된 답이 이어서 도착합니다.",
  },
  {
    title: "채널 연결 후 배포",
    body:
      "봇 설정에서 1번에서 만든 채널을 운영 채널로 연결합니다.\n" +
      "마지막으로 '배포'를 누릅니다. 저장과 배포는 다릅니다 — 저장만 하면 시뮬레이터에서만 바뀌고 실제 카카오톡 채널에는 이전 버전이 그대로 답합니다.",
  },
];

/**
 * 경고 배너가 가리킬 Callback 단계 번호. STEPS에서 찾아 쓴다.
 * 하드코딩하면 단계를 끼워 넣을 때 조용히 다른 단계를 가리키게 된다.
 */
const CALLBACK_STEP_NO =
  STEPS.findIndex((s) => s.title.startsWith("Callback API")) + 1;

const formatDateTime = (iso: string | null): string => {
  if (!iso) return "";
  return new Date(iso).toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const KakaoConnect = ({ botId }: { botId: string }) => {
  const { data, isLoading, isFetching, refetch } = useGet<KakaoConnectionDto>(
    `api/kakao/connection/${botId}`,
    ["kakao-connection", botId],
  );

  if (isLoading || !data) {
    return (
      <p className="text-[13px] text-text-sub">연결 정보를 불러오는 중...</p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card variant="outline" className="p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={[
              "w-2 h-2 rounded-full shrink-0",
              data.connected ? "bg-success" : "bg-text-disabled",
            ].join(" ")}
          />
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-text-main">
              {data.connected
                ? "카카오톡에서 대화가 들어오고 있습니다"
                : "아직 카카오에서 요청이 온 적이 없습니다"}
            </p>
            <p className="text-[12px] text-text-sub mt-0.5 leading-relaxed">
              {data.connected
                ? `마지막 대화 ${formatDateTime(data.last_message_at)}`
                : "아래 순서대로 등록한 뒤 채널에 말을 걸어보세요."}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => refetch()}
          disabled={isFetching}
          leftIcon={
            <RefreshCw
              className={["w-3.5 h-3.5", isFetching ? "animate-spin" : ""].join(" ")}
            />
          }
        >
          새로고침
        </Button>
      </Card>

      <CodeBlock code={data.skill_url} language="skill url" />

      <ol className="flex flex-col gap-3">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex items-start gap-3">
            <span className="w-5 h-5 rounded-full bg-bg-sub shadow-border shrink-0 flex items-center justify-center font-mono text-[11px] text-text-sub mt-0.5">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-text-main">{step.title}</p>
              {/* body의 \n을 줄바꿈으로 살린다. 한 단계에 조건이 둘 이상이면
                  한 문단에 몰아넣는 것보다 줄을 나누는 쪽이 훨씬 잘 읽힌다. */}
              <p className="text-[12px] text-text-sub mt-0.5 leading-relaxed whitespace-pre-line">
                {step.body}
              </p>
              {step.link && (
                <a
                  href={step.link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-2"
                >
                  <Button
                    size="sm"
                    pill
                    variant="secondary"
                    rightIcon={<ExternalLink className="w-3 h-3" />}
                  >
                    {step.link.label}
                  </Button>
                </a>
              )}
            </div>
          </li>
        ))}
      </ol>

      <div className="flex items-start gap-2 px-3 py-2.5 rounded-comfy bg-warning-bg">
        <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
        <p className="text-[12px] text-text-main leading-relaxed">
          카카오는 스킬 응답을 <span className="font-mono">5초</span> 안에 받아야
          합니다. 특히 <strong>파일 학습을 쓰면 거의 항상 이 시간을 넘깁니다.</strong>{" "}
          위 {CALLBACK_STEP_NO}번의 <strong>Callback API</strong>를 꼭 켜주세요.
          켜지 않으면 답이 완성되기 전에 끊겨 "다시 여쭤봐 주세요"만 반복됩니다.
        </p>
      </div>

      <div className="flex items-start gap-2 px-3 py-2.5 rounded-comfy bg-bg-sub shadow-border">
        <Check className="w-3.5 h-3.5 text-text-sub shrink-0 mt-0.5" />
        <p className="text-[12px] text-text-sub leading-relaxed">
          시크릿이 URL에 포함돼 있습니다. 외부에 공유하지 마세요. 카카오에서 온
          대화는 대화 로그에서 방문자 ID가{" "}
          <span className="font-mono text-text-main">kakao:</span> 로 시작합니다.
          카카오 화면 구성과 메뉴 이름은 개편에 따라 조금씩 달라질 수 있습니다.
        </p>
      </div>
    </div>
  );
};

export default KakaoConnect;
