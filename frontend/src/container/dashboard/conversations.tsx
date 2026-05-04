import { useMemo, useState } from "react";
import { Search, Bot, User, MessagesSquare, Filter } from "lucide-react";
import Topbar from "@/component/dashboard/layout/topbar";
import Input from "@/component/dashboard/ui/input";
import Select, { SelectOption } from "@/component/dashboard/ui/select";
import { useGet } from "@/hooks/common/useAPI";

interface BotDto {
  id: string; // slug
  name: string;
}

interface SessionDto {
  id: number;
  bot_id: string; // slug
  visitor_id: string;
  started_at: string | null;
  last_message_at: string | null;
  preview: string | null;
}

interface MessageDto {
  id: number;
  role: "user" | "bot";
  content: string;
  created_at: string | null;
}

interface SessionDetailDto {
  session: SessionDto;
  messages: MessageDto[];
}

const formatRelative = (iso: string | null): string => {
  if (!iso) return "";
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

const formatTime = (iso: string | null): string => {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const Conversations = () => {
  const [botFilter, setBotFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | undefined>();

  const { data: bots } = useGet<BotDto[]>("api/bot/", ["bots"]);
  const sessionsUrl =
    botFilter === "all"
      ? "api/chat/sessions"
      : `api/chat/sessions?bot_id=${botFilter}`;
  const { data: sessions } = useGet<SessionDto[]>(sessionsUrl, [
    "sessions",
    botFilter,
  ]);

  const { data: detail } = useGet<SessionDetailDto>(
    `api/chat/sessions/${selectedId}`,
    ["session", String(selectedId ?? "")],
    !!selectedId,
  );

  const botFilterOptions: SelectOption[] = useMemo(() => {
    const opts: SelectOption[] = [{ value: "all", label: "모든 챗봇" }];
    (bots ?? []).forEach((b) => opts.push({ value: b.id, label: b.name }));
    return opts;
  }, [bots]);

  const botNameMap = useMemo(() => {
    const map = new Map<string, string>();
    (bots ?? []).forEach((b) => map.set(b.id, b.name));
    return map;
  }, [bots]);

  const filteredSessions = useMemo(() => {
    if (!sessions) return [];
    if (!search.trim()) return sessions;
    const q = search.trim().toLowerCase();
    return sessions.filter((s) => {
      const hay = `${s.visitor_id} ${s.preview ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [sessions, search]);

  const selected = filteredSessions.find((s) => s.id === selectedId);

  return (
    <>
      <Topbar
        title="대화 로그"
        description="챗봇별 대화 세션을 확인합니다."
        actions={
          <div className="hidden md:flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-text-sub" />
            <Select
              value={botFilter}
              onChange={setBotFilter}
              options={botFilterOptions}
              className="w-44"
            />
          </div>
        }
      />

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(320px,380px)_minmax(0,1fr)] min-h-0">
        {/* 좌측: 세션 리스트 */}
        <aside className="flex flex-col border-r border-line min-h-0">
          <div className="px-4 py-3 border-b border-line shrink-0">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="방문자 ID, 메시지 검색"
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-visible">
            {filteredSessions.length === 0 ? (
              <EmptyList />
            ) : (
              <ul>
                {filteredSessions.map((s) => (
                  <li key={s.id}>
                    <SessionRow
                      session={s}
                      botName={botNameMap.get(s.bot_id) ?? "봇"}
                      active={s.id === selectedId}
                      onClick={() => setSelectedId(s.id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* 우측: 선택된 세션 디테일 */}
        <section className="flex flex-col min-h-0 bg-bg-sub/30">
          {selected && detail ? (
            <SessionDetail
              detail={detail}
              botName={botNameMap.get(selected.bot_id) ?? "봇"}
            />
          ) : (
            <NoSelection />
          )}
        </section>
      </div>
    </>
  );
};

const SessionRow = ({
  session,
  botName,
  active,
  onClick,
}: {
  session: SessionDto;
  botName: string;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={[
      "w-full text-left px-4 py-3 flex flex-col gap-1.5 border-b border-line transition-colors",
      active ? "bg-bg-hover" : "hover:bg-bg-hover/60",
    ].join(" ")}
  >
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-6 h-6 rounded-full bg-bg-sub shadow-border flex items-center justify-center shrink-0">
          <Bot className="w-3 h-3 text-text-sub" />
        </div>
        <span className="text-[12px] font-medium text-text-main truncate">
          {botName}
        </span>
      </div>
      <span className="text-[11px] text-text-sub shrink-0 font-mono">
        {formatRelative(session.last_message_at)}
      </span>
    </div>
    <p className="text-[13px] text-text-main line-clamp-2 leading-relaxed">
      {session.preview ?? "(메시지 없음)"}
    </p>
    <span className="font-mono text-[11px] text-text-sub">{session.visitor_id}</span>
  </button>
);

const SessionDetail = ({
  detail,
  botName,
}: {
  detail: SessionDetailDto;
  botName: string;
}) => {
  const { session, messages } = detail;
  return (
    <>
      <header className="shrink-0 flex items-center justify-between gap-4 px-6 py-3 border-b border-line bg-bg">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-bg-sub shadow-border flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-text-sub" />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-text-main truncate">
              방문자{" "}
              <span className="font-mono text-text-sub">{session.visitor_id}</span>
            </div>
            <div className="text-[11px] text-text-sub">
              {botName} · 시작 {formatRelative(session.started_at)}
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-visible px-6 py-6 space-y-3">
        {messages.length === 0 ? (
          <p className="text-[13px] text-text-sub text-center py-12">
            메시지가 없습니다.
          </p>
        ) : (
          messages.map((msg) => <MessageRow key={msg.id} message={msg} />)
        )}
      </div>
    </>
  );
};

const MessageRow = ({ message }: { message: MessageDto }) => {
  const isBot = message.role === "bot";
  const at = formatTime(message.created_at);

  if (isBot) {
    return (
      <div className="flex items-start gap-2">
        <div className="w-7 h-7 rounded-full bg-bg-sub shadow-border flex items-center justify-center shrink-0">
          <Bot className="w-3.5 h-3.5 text-text-sub" />
        </div>
        <div className="flex flex-col gap-1 max-w-[70%]">
          <div className="px-3 py-2 rounded-comfy bg-bg-card shadow-border text-[13px] leading-relaxed text-text-main whitespace-pre-wrap">
            {message.content}
          </div>
          <span className="text-[10px] font-mono text-text-sub px-1">{at}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-end">
      <div className="flex flex-col gap-1 max-w-[70%] items-end">
        <div className="px-3 py-2 rounded-comfy bg-text-main text-text-inverse text-[13px] leading-relaxed whitespace-pre-wrap">
          {message.content}
        </div>
        <span className="text-[10px] font-mono text-text-sub px-1">{at}</span>
      </div>
    </div>
  );
};

const EmptyList = () => (
  <div className="flex flex-col items-center justify-center h-full py-16 text-center px-6">
    <div className="w-10 h-10 rounded-DEFAULT bg-bg-sub shadow-border flex items-center justify-center mb-3">
      <Search className="w-4 h-4 text-text-sub" />
    </div>
    <p className="text-[13px] font-medium text-text-main mb-1">결과 없음</p>
    <p className="text-[12px] text-text-sub">
      아직 대화 세션이 없거나 검색어가 일치하지 않습니다.
    </p>
  </div>
);

const NoSelection = () => (
  <div className="flex flex-col items-center justify-center h-full text-center px-6">
    <div className="w-12 h-12 rounded-DEFAULT bg-bg-sub shadow-border flex items-center justify-center mb-4">
      <MessagesSquare className="w-5 h-5 text-text-sub" />
    </div>
    <p className="text-[14px] font-semibold text-text-main mb-1">대화를 선택하세요</p>
    <p className="text-[12px] text-text-sub max-w-xs leading-relaxed">
      좌측 리스트에서 세션을 클릭하면 전체 대화 내용이 표시됩니다.
    </p>
  </div>
);

export default Conversations;
