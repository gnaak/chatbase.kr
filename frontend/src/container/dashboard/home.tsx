import { useNavigate } from "react-router-dom";
import { Plus, Bot } from "lucide-react";
import Topbar from "@/component/dashboard/layout/topbar";
import Button from "@/component/dashboard/ui/button";
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

  const bots = (data ?? []).map(mapBot);
  const isEmpty = !isLoading && bots.length === 0;

  const goNew = () => navigate("/dashboard/bots/new");
  const goDetail = (bot: BotCardData) => navigate(`/dashboard/bots/${bot.id}`);

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
        {isEmpty ? (
          <EmptyState onCreate={goNew} />
        ) : (
          <BotGrid bots={bots} onSelect={goDetail} />
        )}
      </div>
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
