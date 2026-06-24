import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Bot, KeyRound } from "lucide-react";
import Topbar from "@/component/dashboard/layout/topbar";
import Button from "@/component/dashboard/ui/button";
import ConfirmModal from "@/component/dashboard/ui/confirmModal";
import BotCard, { BotCardData } from "@/component/dashboard/bot/botCard";
import { useGet } from "@/hooks/common/useAPI";

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

  const [showKeyModal, setShowKeyModal] = useState(false);

  const bots = (data ?? []).map(mapBot);
  const isEmpty = !isLoading && bots.length === 0;
  const hasNoKeys = !keysLoading && apiKeys !== undefined && apiKeys.length === 0;

  // API 키가 없으면 챗봇 생성 페이지로 보내지 않고 안내 모달을 띄운다
  const goNew = () => {
    if (hasNoKeys) {
      setShowKeyModal(true);
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
          >
            새 챗봇
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto px-8 md:px-12 py-8">
        {hasNoKeys ? (
          <NoApiKeyState onGoKeys={goKeys} />
        ) : isEmpty ? (
          <EmptyState onCreate={goNew} />
        ) : (
          <BotGrid bots={bots} onSelect={goDetail} />
        )}
      </div>

      <ConfirmModal
        open={showKeyModal}
        title="API 키 등록이 필요합니다"
        description="챗봇을 만들려면 먼저 AI 모델 API 키를 등록해야 합니다. 지금 등록하러 가시겠어요?"
        confirmLabel="API 키 등록하러 가기"
        cancelLabel="닫기"
        onConfirm={() => {
          setShowKeyModal(false);
          goKeys();
        }}
        onCancel={() => setShowKeyModal(false)}
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

const NoApiKeyState = ({ onGoKeys }: { onGoKeys: () => void }) => (
  <div className="flex flex-col items-center justify-center py-24 text-center">
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
  <div className="flex flex-col items-center justify-center py-24 text-center">
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
