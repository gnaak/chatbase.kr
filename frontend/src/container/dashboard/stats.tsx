import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Loader2,
  MessageCircleQuestion,
  MousePointerClick,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import Topbar from "@/component/dashboard/layout/topbar";
import Card from "@/component/dashboard/ui/card";
import Button from "@/component/dashboard/ui/button";
import Select, { SelectOption } from "@/component/dashboard/ui/select";
import Skeleton from "@/component/dashboard/ui/skeleton";
import LineChart from "@/component/dashboard/ui/lineChart";
import { useGet, usePost } from "@/hooks/common/useAPI";
import { useToast } from "@/hooks/common/useToast";
import type { StatsSummary, StatsTopics } from "@/types/stats";

interface BotDto {
  id: string; // slug
  name: string;
}

/**
 * 단위가 기간까지 결정한다. 둘을 따로 고르게 하면 "일간 × 12개월"처럼
 * 점이 365개 찍히는 조합이 생겨서 읽을 수 없다.
 */
const RANGES = [
  { value: "day", label: "일간", days: 30, unit: "day", desc: "최근 30일" },
  { value: "week", label: "주간", days: 84, unit: "week", desc: "최근 12주" },
  { value: "month", label: "월간", days: 365, unit: "month", desc: "최근 12개월" },
] as const;

/** 축 라벨: 짧게. 전체 날짜는 hover 툴팁에서 보여준다. */
const axisLabel = (bucket: string, unit: string) => {
  const [, m, d] = bucket.split("-");
  if (unit === "month") return `${Number(m)}월`;
  return `${Number(m)}/${Number(d)}`;
};

/** 툴팁: 주간은 "그 주"임을 알 수 있게 표기한다. */
const tooltipLabel = (bucket: string, unit: string) => {
  const [y, m, d] = bucket.split("-");
  if (unit === "month") return `${y}년 ${Number(m)}월`;
  if (unit === "week") return `${Number(m)}/${Number(d)} 주`;
  return `${Number(m)}/${Number(d)}`;
};

const Stats = () => {
  const toast = useToast();
  const [rangeKey, setRangeKey] = useState<string>("day");
  const [botId, setBotId] = useState("");

  const range = RANGES.find((r) => r.value === rangeKey) ?? RANGES[0];

  const { data: bots } = useGet<BotDto[]>("api/bot/", ["bots"]);

  const query = `days=${range.days}&unit=${range.unit}${
    botId ? `&bot_id=${botId}` : ""
  }`;
  const { data, isLoading } = useGet<StatsSummary>(`api/stats/?${query}`, [
    "stats",
    rangeKey,
    botId,
  ]);

  // 주제 묶기는 사용자 API 키로 LLM을 호출한다. 화면 진입이 아니라 버튼으로만.
  const [topics, setTopics] = useState<StatsTopics | null>(null);
  const topicsMutation = usePost<
    { bot_id?: string; days: number },
    StatsTopics
  >("api/stats/topics");

  const botOptions: SelectOption[] = useMemo(
    () => [
      { value: "", label: "전체 챗봇" },
      ...(bots ?? []).map((b) => ({ value: b.id, label: b.name })),
    ],
    [bots],
  );

  const handleAnalyze = () => {
    topicsMutation.mutate(
      { bot_id: botId || undefined, days: Number(days) },
      {
        onSuccess: (res) => setTopics(res),
        onError: (err) => toast.error(err.message || "분석에 실패했습니다."),
      },
    );
  };

  const kakao = data?.channels.find((c) => c.channel === "kakao")?.sessions ?? 0;
  const widget =
    data?.channels.find((c) => c.channel === "widget")?.sessions ?? 0;

  return (
    <>
      <Topbar
        title="통계"
        description="방문자가 무엇을 묻고, 챗봇이 무엇을 답하지 못했는지 확인합니다."
        actions={
          <div className="flex items-center gap-2">
            <Select
              value={botId}
              onChange={setBotId}
              options={botOptions}
              className="w-36"
            />
            {/* 단위는 3개뿐이라 드롭다운보다 pill이 낫다 — 한 번에 다 보이고
                현재 선택이 눈에 들어온다. */}
            <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-bg-sub shadow-border">
              {RANGES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRangeKey(r.value)}
                  title={r.desc}
                  className={[
                    "px-3 h-7 rounded-full text-[12px] font-medium transition-colors",
                    rangeKey === r.value
                      ? "bg-bg-card text-text-main shadow-border"
                      : "text-text-sub hover:text-text-main",
                  ].join(" ")}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto px-8 md:px-12 py-8">
        <div className="flex flex-col gap-4 max-w-4xl mx-auto">
          {isLoading || !data ? (
            <StatsSkeleton />
          ) : (
            <>
              {data.truncated && (
                <Note>
                  대화량이 많아 최근 일부만 집계했습니다. 기간을 좁히면 정확한
                  수치를 볼 수 있습니다.
                </Note>
              )}

              {/* 요약 타일 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Tile
                  icon={<Users className="w-3.5 h-3.5" />}
                  label="대화한 방문자"
                  value={data.sessions.toLocaleString()}
                  unit="명"
                />
                <Tile
                  icon={<MessageCircleQuestion className="w-3.5 h-3.5" />}
                  label="받은 질문"
                  value={data.questions.toLocaleString()}
                  unit="건"
                />
                <Tile
                  icon={<AlertTriangle className="w-3.5 h-3.5" />}
                  label="답변 못 함"
                  value={`${data.unanswered_rate}`}
                  unit="%"
                  warn={data.unanswered_rate >= 20}
                />
                <Tile
                  icon={<Users className="w-3.5 h-3.5" />}
                  label="한 번 묻고 떠남"
                  value={data.one_shot_sessions.toLocaleString()}
                  unit="명"
                />
              </div>

              {/* 답변 못 한 질문 — 이 화면의 핵심 */}
              <Card variant="outline" className="p-5">
                <SectionTitle
                  icon={<AlertTriangle className="w-4 h-4 text-warning" />}
                  title="답변하지 못한 질문"
                  desc="학습 자료에 추가하면 다음부터 답할 수 있습니다."
                  count={data.unanswered_count}
                />

                {data.fallback_measurable_bots === 0 ? (
                  <Note>
                    이 지표는 챗봇에 <strong>Fallback 메시지</strong>가 설정되어
                    있어야 측정됩니다. 비어 있으면 챗봇이 웹 검색으로 답해서
                    "모른다"고 말하지 않기 때문입니다.{" "}
                    <Link
                      to="/dashboard"
                      className="underline text-text-main hover:opacity-80"
                    >
                      챗봇 설정으로 이동
                    </Link>
                  </Note>
                ) : data.unanswered.length === 0 ? (
                  <p className="text-[13px] text-text-sub py-4 text-center">
                    답변하지 못한 질문이 없습니다. 자료가 잘 준비돼 있네요.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1.5 mt-4">
                    {data.unanswered.map((u, i) => (
                      <li
                        key={`${u.at}-${i}`}
                        className="flex items-start justify-between gap-3 px-3 py-2 rounded-DEFAULT bg-bg-sub/40"
                      >
                        <span className="text-[13px] text-text-main flex-1 min-w-0">
                          {u.question}
                        </span>
                        <span className="text-[11px] font-mono text-text-sub shrink-0">
                          {u.bot_name}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              {/* 질문 주제 묶기 (LLM) */}
              <Card variant="outline" className="p-5">
                <SectionTitle
                  icon={<Sparkles className="w-4 h-4 text-text-sub" />}
                  title="질문 주제 묶기"
                  desc="비슷한 질문을 AI가 주제별로 묶어줍니다. 등록한 API 키로 호출됩니다."
                />

                {topics ? (
                  topics.topics.length === 0 ? (
                    <p className="text-[13px] text-text-sub py-4 text-center">
                      묶을 만큼 질문이 모이지 않았습니다. (분석 {topics.analyzed}건)
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-2 mt-4">
                      {topics.topics.map((t) => (
                        <li
                          key={t.name}
                          className="px-3 py-2.5 rounded-DEFAULT bg-bg-sub/40"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[13px] font-medium text-text-main">
                              {t.name}
                            </span>
                            <span className="text-[12px] font-mono text-text-sub shrink-0">
                              {t.count}건
                            </span>
                          </div>
                          {t.examples.length > 0 && (
                            <p className="text-[12px] text-text-sub mt-1 leading-relaxed">
                              {t.examples.join(" · ")}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )
                ) : (
                  <div className="pt-4 flex justify-center">
                    <Button
                      size="sm"
                      pill
                      onClick={handleAnalyze}
                      disabled={topicsMutation.isPending || data.questions < 5}
                      leftIcon={
                        topicsMutation.isPending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )
                      }
                    >
                      {topicsMutation.isPending
                        ? "분석 중..."
                        : data.questions < 5
                          ? "질문 5건 이상 필요"
                          : "주제별로 묶어보기"}
                    </Button>
                  </div>
                )}
              </Card>

              {/* 질문 수 추이 */}
              <Card variant="outline" className="p-5">
                <SectionTitle
                  icon={<TrendingUp className="w-4 h-4 text-text-sub" />}
                  title="질문 수 추이"
                  desc={`${range.desc} · ${
                    data.unit === "month"
                      ? "각 점은 그 달 전체"
                      : data.unit === "week"
                        ? "각 점은 그 주 전체(월요일 시작)"
                        : "각 점은 하루"
                  }`}
                />
                <LineChart
                  className="mt-4"
                  points={data.series.map((s) => ({
                    label: axisLabel(s.bucket, data.unit),
                    title: tooltipLabel(s.bucket, data.unit),
                    value: s.count,
                  }))}
                />
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 채널 */}
                <Card variant="outline" className="p-5">
                  <SectionTitle title="유입 채널" />
                  <div className="flex flex-col gap-2 mt-4">
                    <ChannelRow label="홈페이지 위젯" value={widget} />
                    <ChannelRow label="카카오톡" value={kakao} />
                  </div>
                </Card>

                {/* FAQ 클릭 */}
                <Card variant="outline" className="p-5">
                  <SectionTitle
                    icon={<MousePointerClick className="w-4 h-4 text-text-sub" />}
                    title="많이 눌린 FAQ 버튼"
                  />
                  {data.faq_clicks.length === 0 ? (
                    <p className="text-[12px] text-text-sub py-4 text-center">
                      아직 눌린 FAQ 버튼이 없습니다.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-1.5 mt-4">
                      {data.faq_clicks.map((f) => (
                        <li
                          key={f.question}
                          className="flex items-center justify-between gap-3"
                        >
                          <span className="text-[12.5px] text-text-main truncate">
                            {f.question}
                          </span>
                          <span className="text-[11px] font-mono text-text-sub shrink-0">
                            {f.count}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

/* ── 조각들 ───────────────────────────────── */

const Tile = ({
  icon,
  label,
  value,
  unit,
  warn,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
  warn?: boolean;
}) => (
  <Card variant="outline" className="p-4">
    <div className="flex items-center gap-1.5 text-text-sub mb-2">
      {icon}
      <span className="text-[11px] font-medium">{label}</span>
    </div>
    <div className="flex items-baseline gap-1">
      <span
        className={[
          "text-[22px] font-semibold tracking-display",
          warn ? "text-warning" : "text-text-main",
        ].join(" ")}
      >
        {value}
      </span>
      <span className="text-[12px] text-text-sub">{unit}</span>
    </div>
  </Card>
);

const SectionTitle = ({
  icon,
  title,
  desc,
  count,
}: {
  icon?: React.ReactNode;
  title: string;
  desc?: string;
  count?: number;
}) => (
  <div className="flex items-start justify-between gap-3">
    <div className="flex items-start gap-2 min-w-0">
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0">
        <h2 className="text-[14px] font-semibold tracking-tight text-text-main">
          {title}
        </h2>
        {desc && (
          <p className="text-[12px] text-text-sub mt-0.5 leading-relaxed">
            {desc}
          </p>
        )}
      </div>
    </div>
    {count !== undefined && (
      <span className="shrink-0 text-[12px] font-mono text-text-sub">
        {count}건
      </span>
    )}
  </div>
);

const ChannelRow = ({ label, value }: { label: string; value: number }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-[12.5px] text-text-main">{label}</span>
    <span className="text-[12px] font-mono text-text-sub">{value}명</span>
  </div>
);

const Note = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-start gap-2 px-3 py-2.5 rounded-comfy bg-bg-sub shadow-border mt-4">
    <AlertTriangle className="w-3.5 h-3.5 text-text-sub shrink-0 mt-0.5" />
    <p className="text-[12px] text-text-sub leading-relaxed">{children}</p>
  </div>
);

const StatsSkeleton = () => (
  <div className="flex flex-col gap-4">
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-[88px] rounded-comfy" />
      ))}
    </div>
    <Skeleton className="h-48 rounded-comfy" />
    <Skeleton className="h-32 rounded-comfy" />
  </div>
);

export default Stats;
