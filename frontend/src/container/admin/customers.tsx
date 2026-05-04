import { useMemo } from "react";
import Table, { Column } from "@/component/admin/ui/table/table";
import { useGet } from "@/hooks/common/useAPI";

interface UserDto {
  id: number;
  email: string;
  name: string;
  active: boolean;
  workspace_name: string | null;
  created_at: string | null;
  last_login_at: string | null;
  bot_count: number;
  key_providers: string[];
  session_count: number;
}

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("ko-KR", { hour12: false }) : "—";

const AdminCustomers = () => {
  const { data: users } = useGet<UserDto[]>("api/admin/users", [
    "admin-users",
  ]);

  const columns: Column[] = useMemo(
    () => [
      { key: "id", header: "ID", width: "60px", align: "center" },
      {
        key: "email",
        header: "이메일",
        render: (r: UserDto) => (
          <span className="font-mono text-[12px] text-text-main">{r.email}</span>
        ),
      },
      { key: "name", header: "이름", width: "100px" },
      {
        key: "workspace_name",
        header: "워크스페이스",
        render: (r: UserDto) => (
          <span className="text-[12px] text-text-sub">
            {r.workspace_name || "—"}
          </span>
        ),
      },
      {
        key: "key_providers",
        header: "등록 키",
        width: "200px",
        render: (r: UserDto) =>
          r.key_providers.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {r.key_providers.map((p) => (
                <span
                  key={p}
                  className="inline-flex items-center px-1.5 h-5 rounded-DEFAULT bg-bg-sub text-[11px] font-medium text-text-main"
                >
                  {p}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-text-sub text-[11px]">—</span>
          ),
      },
      {
        key: "bot_count",
        header: "봇",
        width: "60px",
        align: "right",
        render: (r: UserDto) => (
          <span className="font-mono text-[12px]">{r.bot_count}</span>
        ),
      },
      {
        key: "session_count",
        header: "세션",
        width: "70px",
        align: "right",
        render: (r: UserDto) => (
          <span className="font-mono text-[12px]">{r.session_count}</span>
        ),
      },
      {
        key: "active",
        header: "상태",
        width: "70px",
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
        width: "160px",
        render: (r: UserDto) => (
          <span className="text-[11px] text-text-sub">
            {formatDate(r.created_at)}
          </span>
        ),
      },
      {
        key: "last_login_at",
        header: "최근 로그인",
        width: "160px",
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
      <div>
        <h1 className="text-[18px] font-semibold tracking-tight text-text-main">
          고객 관리
        </h1>
        <p className="text-[13px] text-text-sub mt-1">
          전체 사용자 · 봇 수 · 등록 키 provider · 누적 세션 수
        </p>
      </div>

      <div className="rounded-comfy bg-bg-card shadow-border overflow-hidden">
        <Table columns={columns} data={users ?? []} size="sm" striped />
      </div>
    </div>
  );
};

export default AdminCustomers;
