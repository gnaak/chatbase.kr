import { useMemo } from "react";
import Table, { Column } from "@/component/admin/ui/table/table";
import { useGet } from "@/hooks/common/useAPI";

interface UserDto {
  id: number;
  email: string;
  name: string;
  active: boolean;
  /** 게이팅이 보는 실제 권한. 구독 상태와의 대조는 결제 관리 화면에서 한다. */
  plan: string;
  created_at: string | null;
  last_login_at: string | null;
  bot_count: number;
  key_providers: string[];
  session_count: number;
}

/** 유료 플랜만 색을 준다. FREE가 대다수라 전부 칠하면 표가 시끄러워진다. */
const PLAN_CLASS: Record<string, string> = {
  premium: "bg-info-bg text-point-blue",
  standard: "bg-success-bg text-point-green",
};

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("ko-KR", { hour12: false }) : "-";

const AdminCustomers = () => {
  const { data: users, isLoading } = useGet<UserDto[]>("api/admin/users", [
    "admin-users",
  ]);

  const columns: Column[] = useMemo(
    () => [
      { key: "id", header: "ID", width: "56px", align: "center" },
      { key: "name", header: "이름", width: "120px", align: "center" },
      {
        key: "email",
        header: "이메일",
        width: "240px",
        align: "center",
        render: (r: UserDto) => (
          <span
            className="font-mono text-[12px] text-text-main truncate block"
            title={r.email}
          >
            {r.email}
          </span>
        ),
      },
      {
        key: "plan",
        header: "플랜",
        width: "100px",
        align: "center",
        render: (r: UserDto) => (
          <span
            className={[
              "inline-flex items-center px-1.5 h-5 rounded text-[11px] font-medium",
              PLAN_CLASS[r.plan] ?? "bg-bg-sub text-text-sub",
            ].join(" ")}
          >
            {(r.plan ?? "free").toUpperCase()}
          </span>
        ),
      },
      {
        key: "key_providers",
        header: "등록 키",
        width: "180px",
        align: "center",
        render: (r: UserDto) =>
          r.key_providers.length > 0 ? (
            <div className="flex flex-wrap justify-center gap-1">
              {r.key_providers.map((p) => (
                <span
                  key={p}
                  className="inline-flex items-center px-1.5 h-5 rounded bg-bg-sub text-[11px] font-medium text-text-sub"
                >
                  {p}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-text-disabled text-[11px]">-</span>
          ),
      },
      {
        key: "bot_count",
        header: "봇",
        width: "60px",
        align: "center",
        render: (r: UserDto) => (
          <span className="font-mono text-[12px]">{r.bot_count}</span>
        ),
      },
      {
        key: "session_count",
        header: "세션",
        width: "72px",
        align: "center",
        render: (r: UserDto) => (
          <span className="font-mono text-[12px]">{r.session_count}</span>
        ),
      },
      {
        key: "active",
        header: "상태",
        width: "84px",
        align: "center",
        render: (r: UserDto) => (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-text-sub">
            <span
              className={[
                "w-1.5 h-1.5 rounded-full",
                r.active ? "bg-point-green" : "bg-text-disabled",
              ].join(" ")}
            />
            {r.active ? "활성" : "비활성"}
          </span>
        ),
      },
      {
        key: "created_at",
        header: "가입",
        width: "150px",
        align: "center",
        render: (r: UserDto) => (
          <span className="text-[11px] text-text-sub">
            {formatDate(r.created_at)}
          </span>
        ),
      },
      {
        key: "last_login_at",
        header: "최근 로그인",
        width: "150px",
        align: "center",
        render: (r: UserDto) => (
          <span className="text-[11px] text-text-sub">
            {formatDate(r.last_login_at)}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="px-6 md:px-8 py-6 flex flex-col gap-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-semibold tracking-tight text-text-main">
            고객 관리
          </h1>
          <p className="text-[13px] text-text-sub mt-1">
            전체 사용자 · 플랜 · 봇 수 · 등록 키 provider · 누적 세션 수
          </p>
        </div>
        {users && (
          <span className="text-[12px] text-text-sub">
            총 <span className="font-semibold text-text-main">{users.length}</span>명
          </span>
        )}
      </div>

      <Table
        columns={columns}
        data={users ?? []}
        size="sm"
        loading={isLoading}
      />
    </div>
  );
};

export default AdminCustomers;
