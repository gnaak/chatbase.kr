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
    body: "카카오비즈니스 파트너센터에서 채널을 개설합니다. 본인인증이 필요해 대신 만들어 드릴 수 없습니다. 사업자등록증은 없어도 되며, 없으면 일반 채널로 개설됩니다.",
    link: { label: "파트너센터 열기", href: "https://business.kakao.com" },
  },
  {
    title: "채널 홈 공개 켜기",
    body: "파트너센터의 채널 설정에서 '채널 홈 공개'를 켭니다. 꺼져 있으면 다음 단계의 오픈빌더에서 채널을 연결할 수 없습니다.",
  },
  {
    title: "카카오 i 오픈빌더에서 봇 생성",
    body: "챗봇 관리자센터에 로그인해 새 봇을 만듭니다.",
    link: { label: "오픈빌더 열기", href: "https://chatbot.kakao.com" },
  },
  {
    title: "스킬 등록",
    body: "스킬 메뉴에서 새 스킬을 만들고, URL 칸에 아래 주소를 그대로 붙여넣습니다.",
  },
  {
    title: "폴백 블록에 스킬 연결",
    body: "시나리오의 폴백 블록에서 방금 만든 스킬을 선택하고, 응답이 스킬 결과를 쓰도록 설정합니다. 이래야 모든 발화가 챗봇으로 넘어옵니다.",
  },
  {
    title: "채널 연결 후 배포",
    body: "봇 설정에서 1번 채널을 운영 채널로 연결하고 배포합니다. 그다음 카카오톡에서 채널에 말을 걸어보세요.",
  },
];

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
              <p className="text-[12px] text-text-sub mt-0.5 leading-relaxed">
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
          합니다. 학습 자료가 많거나 답이 길면 시간을 넘겨 "다시 여쭤봐 주세요"로
          안내될 수 있습니다. 자주 발생하면 더 빠른 모델로 바꿔보세요.
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
