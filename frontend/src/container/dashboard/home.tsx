import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Bot, KeyRound } from "lucide-react";
import Topbar from "@/component/dashboard/layout/topbar";
import Button from "@/component/dashboard/ui/button";
import ConfirmModal from "@/component/dashboard/ui/confirmModal";
import BotCard, { BotCardData } from "@/component/dashboard/bot/botCard";
import Card from "@/component/dashboard/ui/card";
import Skeleton from "@/component/dashboard/ui/skeleton";
import { useGet } from "@/hooks/common/useAPI";
import type { UsageSummary } from "@/types/usage";

interface BotDto {
  id: string; // slug
  name: string;
  model: string;
  system_prompt: string | null;
  greeting: string | null;
  active: boolean;
  updated_at: string | null;
  created_at: string | null;
}

const formatRelative = (iso: string | null): string | undefined => {
  if (!iso) return undefined;
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diffMs < minute) return "방금";
  if (diffMs < hour) return `${Math.floor(diffMs / minute)}분 전`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}시간 전`;
  if (diffMs < 7 * day) return `${Math.floor(diffMs / day)}일 전`;
  return date.toLocaleDateString("ko-KR");
};

const mapBot = (bot: BotDto): BotCardData => {
  const firstLine = bot.system_prompt?.split("\n")[0]?.trim();
  return {
    id: bot.id, // slug
    name: bot.name,
    description: firstLine || bot.greeting || undefined,
    model: bot.model,
    updatedAt: formatRelative(bot.updated_at),
    active: bot.active,
  };
};

const DashboardHome = () => {
  const navigate = useNavigate();
  const { data, isLoading } = useGet<BotDto[]>("api/bot/", ["bots"]);
  const { data: apiKeys, isLoading: keysLoading } = useGet<{ provider: string }[]>("api/api-key/", ["api-keys"]);

  const { data: usage } = useGet<UsageSummary>("api/usage/", ["usage"]);

  const [showKeyModal, setShowKeyModal] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);

  // 봇 목록과 키 유무를 둘 다 알기 전에는 그리드/빈 상태 중 무엇을 그릴지 결정할 수 없다.
  // 하나라도 안 왔으면 스켈레톤을 유지해야 "빈 그리드 → 카드", "빈 그리드 → 키 없음 안내" 전환이 안 생긴다.
  const loading = isLoading || keysLoading;
  const bots = (data ?? []).map(mapBot);
  const isEmpty = !isLoading && bots.length === 0;
  const hasNoKeys = !keysLoading && apiKeys !== undefined && apiKeys.length === 0;

  // 개수 제한은 켜져 있는 봇만 센다(비활성은 자리를 차지하지 않는다).
  const activeCount = bots.filter((bot) => bot.active).length;
  const botsLimit = usage?.bots_limit ?? null;
  const atBotLimit = botsLimit !== null && activeCount >= botsLimit;
  const currentPlanLabel = (usage?.plan ?? "free").toUpperCase();
  // 빈 상태(챗봇 없음 / API 키 없음)는 콘텐츠 영역 중앙에 배치한다
  const isCentered = !loading && (hasNoKeys || isEmpty);

  // API 키가 없으면 챗봇 생성 페이지로 보내지 않고 안내 모달을 띄운다
  const goNew = () => {
    if (hasNoKeys) {
      setShowKeyModal(true);
      return;
    }
    // 폼을 다 채운 뒤 저장에서 403을 맞는 걸 막기 위해 진입 전에 알린다.
    if (atBotLimit) {
      setShowLimitModal(true);
      return;
    }
    navigate("/dashboard/bots/new");
  };
  const goDetail = (bot: BotCardData) => navigate(`/dashboard/bots/${bot.id}`);
  const goKeys = () => navigate("/dashboard/keys");

  return (
    <>
      <Topbar
        title="챗봇"
        description="자기 사이트에 임베드할 챗봇을 만들고 관리합니다."
        actions={
          <Button
            size="sm"
            pill
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={goNew}
            // 키 유무/개수 제한을 모르는 상태에서 누르면 잘못된 화면으로 보낸다.
            disabled={loading}
          >
            새 챗봇
          </Button>
        }
      />

      <div
        className={`flex-1 overflow-y-auto px-8 md:px-12 py-8${
          isCentered ? " flex items-center justify-center" : ""
        }`}
      >
        {loading ? (
          <BotGridSkeleton />
        ) : hasNoKeys ? (
          <NoApiKeyState onGoKeys={goKeys} />
        ) : isEmpty ? (
          <EmptyState onCreate={goNew} />
        ) : (
          <BotGrid bots={bots} onSelect={goDetail} />
        )}
      </div>

      <ConfirmModal
        open={showKeyModal}
        icon={<KeyRound className="w-4 h-4" />}
        title="API 키 등록이 필요해요"
        description="챗봇을 만들려면 AI 모델 API 키가 먼저 필요해요."
        confirmLabel="키 등록하기"
        cancelLabel="닫기"
        onConfirm={() => {
          setShowKeyModal(false);
          goKeys();
        }}
        onCancel={() => setShowKeyModal(false)}
      />

      <ConfirmModal
        open={showLimitModal}
        icon={<Bot className="w-4 h-4" />}
        title={`${currentPlanLabel} 플랜은 챗봇 ${botsLimit}개까지예요`}
        description={
          <>
            사용하지 않는 챗봇을 비활성화 하면 자리가 비어요.
            <br />
            더 필요하시면 플랜을 업그레이드 해주세요.
          </>
        }
        confirmLabel="업그레이드"
        cancelLabel="닫기"
        onConfirm={() => {
          setShowLimitModal(false);
          navigate("/dashboard/billing");
        }}
        onCancel={() => setShowLimitModal(false)}
      />
    </>
  );
};

const BotGrid = ({
  bots,
  onSelect,
}: {
  bots: BotCardData[];
  onSelect: (bot: BotCardData) => void;
}) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
    {bots.map((bot) => (
      <BotCard key={bot.id} bot={bot} onClick={onSelect} />
    ))}
  </div>
);

/** BotCard와 같은 구조·높이로 자리를 잡아 카드가 들어올 때 그리드가 튀지 않게 한다. */
const BotCardSkeleton = () => (
  <Card variant="outline" className="p-5 flex flex-col gap-4">
    <div className="flex items-center gap-3">
      <Skeleton className="w-9 h-9 rounded-DEFAULT shrink-0" />
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <Skeleton className="h-3.5 w-1/2" />
        <Skeleton className="h-2.5 w-1/3" />
      </div>
    </div>
    <div className="flex flex-col gap-2">
      <Skeleton className="h-[17px] w-full" />
      <Skeleton className="h-[17px] w-4/5" />
    </div>
    <div className="flex items-center justify-between mt-auto pt-1">
      <Skeleton className="h-5 w-14 rounded-full" />
      <Skeleton className="h-3 w-16" />
    </div>
  </Card>
);

const BotGridSkeleton = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
    {[0, 1, 2].map((i) => (
      <BotCardSkeleton key={i} />
    ))}
  </div>
);

const NoApiKeyState = ({ onGoKeys }: { onGoKeys: () => void }) => (
  <div className="flex flex-col items-center justify-center text-center">
    <div className="w-12 h-12 rounded-DEFAULT bg-bg-sub shadow-border flex items-center justify-center mb-5">
      <KeyRound className="w-5 h-5 text-text-sub" />
    </div>
    <h2 className="text-[18px] font-semibold tracking-tight text-text-main mb-1.5">
      API 키가 없습니다
    </h2>
    <p className="text-[13px] text-text-sub max-w-sm mb-6">
      챗봇을 만들려면 먼저 AI 모델 API 키를 등록해야 합니다.
    </p>
    <Button pill leftIcon={<KeyRound className="w-4 h-4" />} onClick={onGoKeys}>
      API 키 등록하러 가기
    </Button>
  </div>
);

const EmptyState = ({ onCreate }: { onCreate: () => void }) => (
  <div className="flex flex-col items-center justify-center text-center">
    <div className="w-12 h-12 rounded-DEFAULT bg-bg-sub shadow-border flex items-center justify-center mb-5">
      <Bot className="w-5 h-5 text-text-sub" />
    </div>
    <h2 className="text-[18px] font-semibold tracking-tight text-text-main mb-1.5">
      아직 챗봇이 없습니다
    </h2>
    <p className="text-[13px] text-text-sub max-w-sm mb-6">
      이름과 시스템 프롬프트, 학습 데이터만 입력하면 30초 만에 임베드 가능한
      챗봇을 만들 수 있습니다.
    </p>
    <Button pill leftIcon={<Plus className="w-4 h-4" />} onClick={onCreate}>
      첫 챗봇 만들기
    </Button>
  </div>
);

export default DashboardHome;
