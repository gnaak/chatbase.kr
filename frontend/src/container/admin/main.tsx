import { Users, Cpu, MessagesSquare, KeyRound } from "lucide-react";
import Skeleton from "@/component/admin/ui/skeleton";
import { useGet } from "@/hooks/common/useAPI";

interface UserDto {
  id: number;
  bot_count: number;
  session_count: number;
  key_providers: string[];
}

interface ModelDto {
  id: number;
  is_active: boolean;
}

const AdminMain = () => {
  const { data: users, isLoading: usersLoading } = useGet<UserDto[]>(
    "api/admin/users",
    ["admin-users"],
  );
  const { data: models, isLoading: modelsLoading } = useGet<ModelDto[]>(
    "api/admin/models",
    ["admin-models"],
  );

  const stats = {
    users: users?.length ?? 0,
    bots: (users ?? []).reduce((s, u) => s + u.bot_count, 0),
    sessions: (users ?? []).reduce((s, u) => s + u.session_count, 0),
    keys: (users ?? []).reduce((s, u) => s + u.key_providers.length, 0),
    activeModels: (models ?? []).filter((m) => m.is_active).length,
    totalModels: models?.length ?? 0,
  };

  return (
    <div className="px-6 md:px-8 py-6">
      <div className="mb-6">
        <h1 className="text-[18px] font-semibold tracking-tight text-text-main">
          대시보드
        </h1>
        <p className="text-[13px] text-text-sub mt-1">
          전체 운영 현황을 한 눈에 확인합니다.
        </p>
      </div>

      {/* 값이 오기 전에 0을 먼저 그리면 실제 수치로 바뀔 때 숫자가 튀는 깜빡임이 된다. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<Users className="w-4 h-4" />}
          label="가입 사용자"
          value={stats.users}
          loading={usersLoading}
        />
        <StatCard
          icon={<Cpu className="w-4 h-4" />}
          label="활성 모델"
          value={`${stats.activeModels} / ${stats.totalModels}`}
          loading={modelsLoading}
        />
        <StatCard
          icon={<MessagesSquare className="w-4 h-4" />}
          label="누적 세션"
          value={stats.sessions.toLocaleString()}
          loading={usersLoading}
        />
        <StatCard
          icon={<KeyRound className="w-4 h-4" />}
          label="등록된 키"
          value={stats.keys}
          loading={usersLoading}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
        <StatCard
          icon={<Cpu className="w-4 h-4" />}
          label="총 챗봇"
          value={stats.bots.toLocaleString()}
          loading={usersLoading}
          large
        />
      </div>
    </div>
  );
};

const StatCard = ({
  icon,
  label,
  value,
  loading,
  large,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  loading?: boolean;
  large?: boolean;
}) => (
  <div className="rounded-comfy bg-bg-card shadow-border px-4 py-3.5 flex flex-col gap-1.5">
    <div className="flex items-center gap-1.5 text-text-sub">
      {icon}
      <span className="text-[11px] font-medium uppercase tracking-tight">
        {label}
      </span>
    </div>
    <div
      className={[
        "font-semibold tracking-tight text-text-main",
        large ? "text-[24px]" : "text-[18px]",
      ].join(" ")}
    >
      {loading ? (
        <Skeleton className={large ? "h-[29px] w-24" : "h-[22px] w-16"} />
      ) : (
        value
      )}
    </div>
  </div>
);

export default AdminMain;
