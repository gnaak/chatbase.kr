import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, Bot, User, MessagesSquare, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import Topbar from "@/component/layout/topbar";
import Calendar, { DateRange } from "@/ui/calendar";
import Card from "@/ui/card";
import Input from "@/ui/input";
import Pagination from "@/ui/pagination";
import Select, { SelectOption } from "@/ui/select";
import Skeleton from "@/ui/skeleton";
import { useGet } from "@/hooks/common/useAPI";
import { remarkGfmKo } from "@/utils/format/markdown";

/**
 * 대화 로그 — 세션 목록(표) + 전체를 덮는 상세 모달.
 *
 * 예전에는 좌우 2단(목록 380px + 상세)이었는데, 좁은 화면에서 `grid-cols-1`로
 * 접히면서 목록과 상세가 한 칸에 위아래로 겹쳐 쌓여 둘 다 못 보는 상태가 됐다.
 * 그리고 넓은 화면에서도 380px 칸에 말줄임으로 미리보기를 욱여넣느라 정작
 * "누가 무엇을 물었나"가 안 보였다.
 *
 * 표로 펼치면 봇·질문·방문자·시각이 한 줄에 다 들어오고, 대화 전문은 모달이
 * 화면을 덮고 보여준다. 목록과 상세가 폭을 나눠 가질 이유가 없어진다.
 */

interface BotDto {
  id: string; // slug
  name: string;
}

interface SessionDto {
  id: number;
  bot_id: string; // slug
  visitor_id: string;
  /**
   * 방문자가 고른 언어. `null`인 경우가 둘이고 **구분할 방법이 없다** —
   * 컬럼이 생기기 전(2026-08-31)에 쌓인 세션과, 언어 pill이 없는 봇
   * (= 다국어 OFF)에서 들어온 세션. 그래서 "한국어"로 단정하지 않고 "-"로 둔다.
   */
  lang: string | null;
  started_at: string | null;
  last_message_at: string | null;
  /** 세션의 마지막 메시지 */
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

/**
 * 표의 칸 나눔과 좌우 여백. 헤더와 각 행이 **반드시 같은 값을 써야** 세로줄이 맞는다.
 * 한쪽만 고치면 헤더와 내용이 어긋난 표가 되므로 한 상수로 묶어둔다.
 *
 * 칸: 챗봇 / 마지막 대화 / 언어 / 채널 / 시각
 *
 * 원래 `방문자` 칸에 `v_8f3a2b1c` 같은 난수를 그대로 띄웠는데, 그 값으로는
 * 누군지도 알 수 없고 40줄을 눈으로 대조해 같은 값을 찾는 사람도 없다.
 * 토큰은 버리고 거기서 뽑아낼 수 있는 **채널**만 남겼다.
 * 원본 ID는 필요할 때 모달 헤더에서 본다.
 *
 * `언어`는 GLOBAL을 파는 근거다 — 외국인 손님이 실제로 왔는지를 봇 주인이
 * 확인할 수 있는 유일한 자리라, 채널 옆에 붙여 한눈에 세어지게 둔다.
 */
const COLS = "md:grid-cols-[150px_minmax(0,1fr)_76px_76px_88px]";
const ROW_PADDING = "px-5 md:px-6";

/** 카카오 유입 세션의 visitor_id 접두사. 백엔드 `KAKAO_PREFIX`와 같아야 한다. */
const KAKAO_PREFIX = "kakao:";

/**
 * 언어 코드 → 표에 쓸 짧은 이름.
 *
 * `component/bot/langPill.tsx`의 `LANGS`와 같은 집합이어야 한다. 거기서 직접
 * import하지 않는 이유는 그쪽이 국기 이모지 + 원어 표기(`日本語`)라 목록용이고,
 * 여기는 76px 칸에 들어가야 해서 표기 규칙이 다르기 때문이다.
 */
const LANG_LABEL: Record<string, string> = {
  ko: "한국어",
  en: "English",
  ja: "日本語",
  zh: "中文",
};

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

/**
 * 한 쪽에 몇 줄. 전부 그리면 스크롤이 길어지고, 많으면 표 아래 페이지네이션이
 * 화면 밖으로 밀려 "다음 쪽이 있다"는 걸 스크롤해야 알게 된다.
 * 13줄이면 머리말·페이지네이션까지 한 화면에 들어온다.
 */
const PAGE_SIZE = 13;

/** 그날 00:00:00 */
const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** 그날 23:59:59.999 — 종료일을 포함하려면 하루 끝까지 열어야 한다 */
const endOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();

const Conversations = () => {
  const [botFilter, setBotFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<DateRange>({ start: null, end: null });
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | undefined>();

  const { data: bots } = useGet<BotDto[]>("api/bot/", ["bots"]);
  const sessionsUrl =
    botFilter === "all"
      ? "api/chat/sessions"
      : `api/chat/sessions?bot_id=${botFilter}`;
  const { data: sessions, isLoading: sessionsLoading } = useGet<SessionDto[]>(
    sessionsUrl,
    ["sessions", botFilter],
  );

  const { data: detail } = useGet<SessionDetailDto>(
    `api/chat/sessions/${selectedId}`,
    ["session", String(selectedId ?? "")],
    !!selectedId,
  );

  // 세션을 바꾸면 새 응답이 오기 전까지 이전 세션의 대화가 캐시에 남아 있다.
  // 그대로 그리면 헤더는 새 방문자, 메시지는 이전 방문자인 화면이 한 번 보인다.
  const detailReady = !!detail && detail.session.id === selectedId;

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
    const q = search.trim().toLowerCase();
    // 기간은 `last_message_at`(= 목록 정렬 기준)으로 본다. 시작 시각으로 걸면
    // 어제 시작해 오늘까지 이어진 대화가 "오늘"에서 사라진다.
    const from = range.start ? startOfDay(range.start) : null;
    const to = range.end ? endOfDay(range.end) : null;

    return sessions.filter((s) => {
      if (q) {
        const hay = `${s.visitor_id} ${s.preview ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (from !== null || to !== null) {
        const at = s.last_message_at ?? s.started_at;
        if (!at) return false;
        const t = new Date(at).getTime();
        if (from !== null && t < from) return false;
        if (to !== null && t > to) return false;
      }
      return true;
    });
  }, [sessions, search, range]);

  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / PAGE_SIZE));

  // 필터를 좁혀 페이지 수가 줄면 현재 페이지가 범위 밖으로 나가 빈 표가 보인다.
  // 상태를 따로 되돌리지 않고 그릴 때 좁혀서, 필터와 페이지가 어긋나는 순간 자체를 없앤다.
  const safePage = Math.min(page, totalPages);

  const pagedSessions = useMemo(
    () => filteredSessions.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filteredSessions, safePage],
  );

  // 모달은 페이지 밖 세션도 열려 있을 수 있으므로 전체에서 찾는다.
  const selected = filteredSessions.find((s) => s.id === selectedId);

  return (
    <>
      <Topbar
        title="대화 로그"
        description="방문자가 챗봇과 나눈 대화를 확인합니다."
      />

      {/*
        페이지네이션을 하단에 고정하려고 한 겹 더 쌌다.

        스크롤 컨테이너 **안에** absolute 로 두면 컨테이너의 패딩 박스를 기준으로
        잡혀서 내용과 같이 스크롤된다 — 화면에 붙어 있지 않다. 그래서 스크롤을
        안쪽 div 에 주고, 고정 바를 그 **형제**로 둔 뒤 바깥에 relative 를 건다.
        바깥은 `main`(h-svh flex-col)의 flex 자식이라 높이가 화면에 묶여 있고,
        `min-h-0` 이 없으면 flex 자식이 내용만큼 부풀어 스크롤이 안 생긴다.
      */}
      <div className="flex-1 min-h-0 relative">
        <div className="h-full overflow-y-auto px-8 md:px-12 pt-8 pb-24">
          <div className="flex flex-col gap-4 max-w-6xl mx-auto">
            {/*
              봇 필터가 예전에는 Topbar 안에 `hidden md:flex`로 있어서 모바일에서는
              아예 사라졌다 — 필터링 자체가 불가능했다. 검색창 옆으로 내려 두 화면
              모두에서 쓸 수 있게 한다.

              배치: **챗봇 왼쪽 / 기간·검색 오른쪽.** 왼쪽은 "무엇을 보는가"(대상),
              오른쪽은 "그 안에서 좁히기"(도구)라 성격이 갈린다. 셋을 한 줄에 균등하게
              늘어놓으면 어느 게 대상이고 어느 게 도구인지 안 읽힌다.
              검색창은 고정폭으로 줄였다 — `flex-1`로 두면 넓은 화면에서 혼자 늘어나
              빈 입력칸이 줄의 절반을 먹는다.
            */}
            <div className="flex items-center gap-2 flex-wrap">
              <Select
                value={botFilter}
                onChange={(v) => {
                  setBotFilter(v);
                  setPage(1);
                }}
                options={botFilterOptions}
                className="w-40"
              />

              <div className="flex items-center gap-2 ml-auto">
                <Calendar
                  value={range}
                  onChange={(v) => {
                    setRange(v);
                    setPage(1);
                  }}
                  className="w-[188px]"
                />
                <Input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="방문자 ID, 메시지 검색"
                  leftIcon={<Search className="w-4 h-4" />}
                  className="w-[220px]"
                />
              </div>
            </div>

            <Card variant="outline" className="overflow-hidden">
              {/* 칸 이름은 넓은 화면에서만. 모바일은 행 자체가 쌓이는 형태라 머리말이 의미 없다. */}
              <div
                className={[
                  "hidden md:grid gap-x-4 h-10 items-center border-b border-line bg-bg-sub/50",
                  "text-[11px] font-medium tracking-tight text-text-sub",
                  ROW_PADDING,
                  COLS,
                ].join(" ")}
              >
                <span className="text-center">챗봇</span>
                <span className="text-center">마지막 대화</span>
                <span className="text-center">언어</span>
                <span className="text-center">채널</span>
                <span className="text-center">시각</span>
              </div>

              {sessionsLoading ? (
                <SessionTableSkeleton />
              ) : filteredSessions.length === 0 ? (
                <EmptyRow hasSessions={!!sessions && sessions.length > 0} />
              ) : (
                pagedSessions.map((s) => (
                  <SessionRow
                    key={s.id}
                    session={s}
                    botName={botNameMap.get(s.bot_id) ?? "봇"}
                    onClick={() => setSelectedId(s.id)}
                  />
                ))
              )}
            </Card>
          </div>
        </div>

        {/*
          하단 고정 바. 페이지가 하나여도 자리를 지킨다 — 나타났다 사라지면
          표 아래 여백이 페이지마다 널뛴다.

          `pointer-events-none` 은 바탕용이다. 그라데이션 띠가 표 위를 덮고 있어서
          그대로 두면 그 아래 행을 못 누른다. 실제로 눌러야 하는 것들만 auto 로 되돌린다.
        */}
        {!sessionsLoading && filteredSessions.length > 0 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 pt-10 pb-5 bg-gradient-to-t from-bg via-bg to-transparent">
            <div className="relative flex items-center max-w-6xl mx-auto px-8 md:px-12">
              <span className="pointer-events-auto text-[12px] text-text-sub tabular-nums">
                {filteredSessions.length.toLocaleString()}건
                {filteredSessions.length !== (sessions?.length ?? 0) &&
                  ` / 전체 ${(sessions?.length ?? 0).toLocaleString()}건`}
              </span>
              <Pagination
                page={safePage}
                total={filteredSessions.length}
                pageSize={PAGE_SIZE}
                onChange={setPage}
                className="pointer-events-auto absolute left-1/2 -translate-x-1/2"
              />
            </div>
          </div>
        )}
      </div>

      {selected && (
        <SessionModal
          session={selected}
          detail={detailReady ? detail : undefined}
          botName={botNameMap.get(selected.bot_id) ?? "봇"}
          onClose={() => setSelectedId(undefined)}
        />
      )}
    </>
  );
};

/**
 * 표의 한 행.
 *
 * 마크업은 하나고 `md:order-*`로 순서만 바꾼다. 모바일/데스크톱용 마크업을
 * 두 벌 두면 한쪽에만 칸을 추가하는 사고가 난다.
 *
 *   모바일 (2칸)                데스크톱 (4칸)
 *   ┌──────────────┬────────┐   ┌────┬────────┬────┬────┐
 *   │ 봇           │  시각  │   │ 봇 │ 마지막 │채널│시각│
 *   ├──────────────┴────────┤   └────┴────────┴────┴────┘
 *   │ 마지막 대화            │
 *   │ 위젯                   │
 *   └───────────────────────┘
 *
 * 정렬: 데스크톱은 네 칸 모두 가운데. 모바일은 좌측 정렬 그대로 둔다 —
 * 위아래로 쌓인 줄을 가운데로 모으면 왼쪽 시작점이 사라져 읽는 눈이 헤맨다.
 */
const SessionRow = ({
  session,
  botName,
  onClick,
}: {
  session: SessionDto;
  botName: string;
  onClick: () => void;
}) => {
  const isKakao = session.visitor_id.startsWith(KAKAO_PREFIX);

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full text-left py-3 md:py-3.5 border-b border-line last:border-b-0",
        "hover:bg-bg-hover transition-colors",
        "grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 md:gap-y-0 items-center",
        ROW_PADDING,
        COLS,
      ].join(" ")}
    >
      <span className="md:order-1 flex items-center gap-2 min-w-0 md:justify-center">
        <span className="w-5 h-5 rounded-full bg-bg-sub flex items-center justify-center shrink-0">
          <Bot className="w-3 h-3 text-text-sub" />
        </span>
        <span className="text-[13px] font-medium text-text-main truncate">
          {botName}
        </span>
      </span>

      {/* 모바일에서는 첫 줄 오른쪽 끝, 데스크톱에서는 마지막 칸 가운데.
          tabular-nums로 자릿수를 고정해야 "3분 전 / 12분 전"이 섞여도 안 흔들린다. */}
      <span className="md:order-5 shrink-0 text-[11px] tabular-nums text-text-sub text-right md:text-center">
        {formatRelative(session.last_message_at)}
      </span>

      <p className="col-span-2 md:col-span-1 md:order-2 md:text-center text-[13px] text-text-main leading-relaxed line-clamp-2 md:line-clamp-1">
        {session.preview ?? "(메시지 없음)"}
      </p>

      {/* 모바일에서는 언어·채널을 한 줄에 나란히 둔다. 좁은 화면에서 줄을
          하나 더 쓰면 행이 4줄이 되어 목록을 훑는 리듬이 깨진다. */}
      <span className="col-span-2 md:col-span-1 md:order-3 md:text-center text-[11px] text-text-sub">
        <LangTag lang={session.lang} />
      </span>

      <span className="col-span-2 md:col-span-1 md:order-4 md:text-center text-[11px] text-text-sub">
        {isKakao ? "카카오" : "위젯"}
      </span>
    </button>
  );
};

/**
 * 언어 한 칸.
 *
 * 한국어는 **일부러 흐리게** 둔다. 대부분의 봇이 한국어뿐이라 이 칸이 전부
 * 같은 값이면 아무 정보도 아니고, 반대로 외국어 한 줄이 섞였을 때 그게 눈에
 * 띄어야 한다. GLOBAL을 유지할 이유가 보이는 자리가 여기다.
 */
const LangTag = ({ lang }: { lang: string | null }) => {
  if (!lang) return <span className="text-text-disabled">-</span>;
  const label = LANG_LABEL[lang] ?? lang.toUpperCase();
  if (lang === "ko") return <span className="text-text-sub">{label}</span>;
  return (
    <span className="inline-flex items-center px-2 h-5 rounded-full bg-info-bg text-info text-[10px] font-medium">
      {label}
    </span>
  );
};

/**
 * 대화 전문 모달.
 *
 * 모바일은 화면을 통째로 덮고, 데스크톱은 가운데 띄운다 — 27인치에서까지
 * 전체화면으로 덮으면 대화 몇 줄 보려고 화면을 다 잃는다.
 *
 * body로 포탈을 쏘는 이유는 [`mobileNav.tsx`]와 같다: Topbar의 `backdrop-blur`가
 * fixed 자식의 containing block이 되기 때문에, 그 영향권 밖에서 그려야 한다.
 */
const SessionModal = ({
  session,
  detail,
  botName,
  onClose,
}: {
  session: SessionDto;
  /** 아직 안 왔으면 undefined — 헤더는 목록이 이미 아는 값으로 먼저 그린다. */
  detail?: SessionDetailDto;
  botName: string;
  onClose: () => void;
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // 대화는 아래가 최신이라 열자마자 끝으로 보낸다.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [detail]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex md:items-center md:justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="대화 내용"
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label="닫기"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 animate-fade-in motion-reduce:animate-none"
      />

      <div
        className="
          relative flex flex-col overflow-hidden bg-bg-card
          w-full h-full
          md:w-[min(720px,90vw)] md:h-[min(85vh,720px)]
          md:rounded-comfy md:shadow-[0_24px_60px_rgba(0,0,0,0.18)]
          animate-fade-slide motion-reduce:animate-none
        "
      >
        <header className="shrink-0 flex items-center justify-between gap-3 px-5 h-14 border-b border-line">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-8 h-8 rounded-full bg-bg-sub shadow-border flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-text-sub" />
            </span>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-text-main truncate">
                방문자{" "}
                <span className="font-mono text-text-sub">
                  {session.visitor_id}
                </span>
              </div>
              <div className="text-[11px] text-text-sub truncate">
                {botName} · 시작 {formatRelative(session.started_at)}
                {session.lang && ` · ${LANG_LABEL[session.lang] ?? session.lang}`}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="
              shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full
              text-text-sub hover:text-text-main hover:bg-bg-hover active:bg-bg-active
              transition-colors duration-150
              focus:outline-none focus-visible:shadow-focus
            "
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto scrollbar-hide px-5 py-5 space-y-3 bg-bg-sub/30"
        >
          {!detail ? (
            <MessagesSkeleton />
          ) : detail.messages.length === 0 ? (
            <p className="text-[13px] text-text-sub text-center py-12">
              메시지가 없습니다.
            </p>
          ) : (
            detail.messages.map((msg) => (
              <MessageRow key={msg.id} message={msg} />
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
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
        <div className="flex flex-col gap-1 max-w-[80%] md:max-w-[70%]">
          <div className="px-3 py-2 rounded-comfy bg-bg-card shadow-border text-[13px] leading-relaxed text-text-main break-words">
            <Markdown text={message.content} />
          </div>
          <span className="text-[10px] font-mono text-text-sub px-1">{at}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-end">
      <div className="flex flex-col gap-1 max-w-[80%] md:max-w-[70%] items-end">
        <div className="px-3 py-2 rounded-comfy bg-text-main text-text-inverse text-[13px] leading-relaxed whitespace-pre-wrap break-words">
          {message.content}
        </div>
        <span className="text-[10px] font-mono text-text-sub px-1">{at}</span>
      </div>
    </div>
  );
};

const Markdown = ({ text }: { text: string }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfmKo]}
    components={{
      p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
      strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
      em: ({ children }) => <em className="italic">{children}</em>,
      ul: ({ children }) => <ul className="list-disc pl-4 my-1 space-y-0.5">{children}</ul>,
      ol: ({ children }) => <ol className="list-decimal pl-4 my-1 space-y-0.5">{children}</ol>,
      li: ({ children }) => <li>{children}</li>,
      a: ({ href, children }) => (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="underline text-text-main hover:opacity-80"
        >
          {children}
        </a>
      ),
      code: ({ children }) => (
        <code className="px-1 py-0.5 rounded bg-bg-sub text-[12px] font-mono break-all">
          {children}
        </code>
      ),
      pre: ({ children }) => (
        <pre className="px-2 py-1.5 my-1 rounded bg-bg-sub text-[12px] font-mono whitespace-pre-wrap break-all">
          {children}
        </pre>
      ),
      h1: ({ children }) => <h3 className="text-[14px] font-semibold mt-1 mb-0.5">{children}</h3>,
      h2: ({ children }) => <h3 className="text-[14px] font-semibold mt-1 mb-0.5">{children}</h3>,
      h3: ({ children }) => <h3 className="text-[13px] font-semibold mt-1 mb-0.5">{children}</h3>,
      table: ({ children }) => (
        <div className="my-2 overflow-x-auto rounded-DEFAULT shadow-border">
          <table className="w-full text-[12px] border-collapse">{children}</table>
        </div>
      ),
      thead: ({ children }) => <thead className="bg-bg-sub">{children}</thead>,
      tbody: ({ children }) => <tbody>{children}</tbody>,
      tr: ({ children }) => <tr className="border-b border-line last:border-b-0">{children}</tr>,
      th: ({ children }) => (
        <th className="px-2.5 py-1.5 text-left font-semibold text-text-main">{children}</th>
      ),
      td: ({ children }) => (
        <td className="px-2.5 py-1.5 align-top text-text-main">{children}</td>
      ),
      hr: () => <hr className="my-2 border-line" />,
    }}
  >
    {text}
  </ReactMarkdown>
);

/** SessionRow와 같은 골격의 로딩 행. 표가 들어올 때 높이가 튀지 않게 맞춘다. */
const SessionTableSkeleton = () => (
  <>
    {[0, 1, 2, 3, 4].map((i) => (
      <div
        key={i}
        className={[
          "py-3 md:py-3.5 border-b border-line last:border-b-0",
          "grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 md:gap-y-0 items-center",
          ROW_PADDING,
          COLS,
        ].join(" ")}
      >
        <div className="md:order-1 flex items-center gap-2 md:justify-center">
          <Skeleton className="w-5 h-5 rounded-full shrink-0" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="md:order-5 h-2.5 w-10 ml-auto md:mx-auto" />
        <Skeleton className="col-span-2 md:col-span-1 md:order-2 h-[17px] w-full" />
        <Skeleton className="col-span-2 md:col-span-1 md:order-3 h-2.5 w-10 md:mx-auto" />
        <Skeleton className="col-span-2 md:col-span-1 md:order-4 h-2.5 w-8 md:mx-auto" />
      </div>
    ))}
  </>
);

/** 모달이 열린 직후, 대화가 오기 전. 버블 골격을 그대로 흉내 낸다. */
const MessagesSkeleton = () => (
  <>
    <div className="flex items-start gap-2">
      <Skeleton className="w-7 h-7 rounded-full shrink-0" />
      <Skeleton className="h-14 w-1/2 rounded-comfy" />
    </div>
    <div className="flex justify-end">
      <Skeleton className="h-10 w-2/5 rounded-comfy" />
    </div>
    <div className="flex items-start gap-2">
      <Skeleton className="w-7 h-7 rounded-full shrink-0" />
      <Skeleton className="h-20 w-3/5 rounded-comfy" />
    </div>
  </>
);

/**
 * 대화가 하나도 없는 것과 검색 결과가 없는 것은 다른 상황이다.
 * 같은 문구를 쓰면 "검색어를 지우면 나온다"는 사실을 못 알아챈다.
 */
const EmptyRow = ({ hasSessions }: { hasSessions: boolean }) => (
  <div className="flex flex-col items-center justify-center text-center px-6 py-16">
    <div className="w-12 h-12 rounded-DEFAULT bg-bg-sub shadow-border flex items-center justify-center mb-4">
      {hasSessions ? (
        <Search className="w-5 h-5 text-text-sub" />
      ) : (
        <MessagesSquare className="w-5 h-5 text-text-sub" />
      )}
    </div>
    <p className="text-[14px] font-semibold text-text-main mb-1">
      {hasSessions ? "결과 없음" : "아직 대화가 없습니다"}
    </p>
    <p className="text-[12px] text-text-sub max-w-xs leading-relaxed">
      {hasSessions
        ? "조건에 맞는 대화가 없습니다. 챗봇·기간·검색어를 바꿔보세요."
        : "방문자가 챗봇과 대화하면 여기에 쌓입니다."}
    </p>
  </div>
);

export default Conversations;
