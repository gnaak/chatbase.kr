import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { MailIcon, PhoneIcon, SearchIcon } from "lucide-react";

import Table, { type Column } from "@/admin/component/ui/table/table";
import Pagination from "@/admin/component/ui/pagination";
import FormModal from "@/admin/component/ui/feedback/formModal";
import InputBox from "@/admin/component/ui/form/inputbox";
import TextareaBox from "@/admin/component/ui/form/textareaBox";
import Button from "@/admin/component/ui/form/button";
import Skeleton from "@/admin/component/ui/skeleton";
import { formatDateTime } from "@/utils/format/date";
import InquiryThread from "@/admin/component/inquiry/thread";
import { useGet, usePatch, usePost } from "@/hooks/common/useAPI";
import { useToast } from "@/hooks/common/useToast";
import {
  type AdminInquiryList,
  CATEGORY_LABEL,
  type InquiryListItem,
  type InquiryReplyResult,
  type InquiryStatus,
  type InquiryThread as InquiryThreadDto,
  STATUS_CLASS,
  STATUS_LABEL,
} from "@/types/inquiry";

const PAGE_SIZE = 20;

type StatusFilter = InquiryStatus | "all";

/** 답변 대기를 기본으로 연다 — 이 화면에 오는 이유가 그거다. */
const DEFAULT_FILTER: StatusFilter = "open";

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "open", label: STATUS_LABEL.open },
  { value: "answered", label: STATUS_LABEL.answered },
  { value: "closed", label: STATUS_LABEL.closed },
];

/** 이메일과 전화 중 있는 것만. 둘 중 하나만 남기는 문의가 있다. */
const contactText = (i: { email?: string | null; phone?: string | null }) =>
  [i.email, i.phone].filter(Boolean).join(" · ") || "-";

/**
 * 목록용 시각. `toLocaleString("ko-KR")`은 "2026. 8. 30. 14:23:11"처럼 월·일을
 * 채우지 않아 값마다 폭이 달라진다. 가운데 정렬한 열에서는 그게 그대로 들쭉날쭉함이
 * 되므로, 자리수가 고정된 formatDateTime(YYYY-MM-DD HH:mm)을 쓴다.
 * 초는 목록에서 볼 일이 없어 뺀다 — 상세를 열면 나온다.
 */
const formatStamp = (iso: string | null) => {
  if (!iso) return "-";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "-" : formatDateTime(d);
};

const AdminInquiries = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState<StatusFilter>(DEFAULT_FILTER);
  const [keyword, setKeyword] = useState("");
  //: 실제 요청에 나가는 검색어. 입력할 때마다 치면 타이핑 한 글자에 쿼리가 한 번씩 돈다.
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // 관리자 알림 메일의 링크가 `/admin/inquiries?id=123` 형태로 들어온다.
  const selectedId = searchParams.get("id")
    ? Number(searchParams.get("id"))
    : null;

  const openDetail = (id: number) => {
    searchParams.set("id", String(id));
    setSearchParams(searchParams, { replace: true });
  };
  const closeDetail = () => {
    searchParams.delete("id");
    setSearchParams(searchParams, { replace: true });
  };

  const query = useMemo(() => {
    const params = new URLSearchParams({
      status,
      limit: String(PAGE_SIZE),
      offset: String((page - 1) * PAGE_SIZE),
    });
    if (search) params.set("q", search);
    return `api/admin/inquiries?${params.toString()}`;
  }, [status, search, page]);

  const { data, isLoading } = useGet<AdminInquiryList>(query, [
    "admin-inquiries",
    status,
    search,
    page,
  ]);

  // 필터·검색어가 바뀌면 3페이지에 머물러 있을 이유가 없다.
  useEffect(() => {
    setPage(1);
  }, [status, search]);

  const handleSearch = () => setSearch(keyword.trim());

  const columns: Column[] = useMemo(
    () => [
      { key: "id", header: "번호", width: "64px", align: "center" },
      {
        key: "status",
        header: "상태",
        width: "92px",
        align: "center",
        render: (r: InquiryListItem) => (
          <span
            className={[
              "inline-flex items-center px-1.5 h-5 rounded text-[11px] font-medium",
              STATUS_CLASS[r.status],
            ].join(" ")}
          >
            {STATUS_LABEL[r.status]}
          </span>
        ),
      },
      {
        key: "category",
        header: "유형",
        width: "104px",
        align: "center",
        render: (r: InquiryListItem) => (
          <span className="text-[11px] text-text-sub">
            {CATEGORY_LABEL[r.category]}
          </span>
        ),
      },
      {
        key: "subject",
        header: "제목",
        width: "200px",
        align: "left",
        render: (r: InquiryListItem) => (
          <div
            className="text-[13px] text-text-main truncate"
            title={r.subject}
          >
            {r.subject}
          </div>
        ),
      },
      {
        // width를 주지 않은 유일한 컬럼이라 남는 가로 폭을 전부 받는다.
        // 본문은 첫 글이라, 답장을 보낸 뒤에도 "무엇을 물었나"가 그대로 남는다.
        // truncate가 white-space:nowrap이라 본문의 줄바꿈은 공백으로 눕는다.
        key: "content",
        header: "내용",
        align: "left",
        render: (r: InquiryListItem) => (
          <div
            className="text-[12px] text-text-sub truncate"
            title={r.content || undefined}
          >
            {r.content || "-"}
          </div>
        ),
      },
      {
        key: "name",
        header: "작성자",
        width: "132px",
        align: "left",
        render: (r: InquiryListItem) => (
          <div className="text-[12px] text-text-main truncate" title={r.name}>
            {r.name}
            {!r.user_id && (
              <span className="ml-1 text-[10px] text-text-disabled">비회원</span>
            )}
          </div>
        ),
      },
      {
        // 이름 아래 붙어 있던 줄을 따로 뺐다. 답장할 주소를 눈으로 훑는 일이
        // 잦은데, 같은 칸에 있으면 이름 길이에 따라 시작 위치가 들쭉날쭉했다.
        key: "email",
        header: "연락처",
        width: "180px",
        align: "left",
        render: (r: InquiryListItem) => (
          <div
            className="font-mono text-[11px] text-text-sub truncate"
            title={contactText(r)}
          >
            {contactText(r)}
          </div>
        ),
      },
      {
        key: "message_count",
        header: "글",
        width: "52px",
        align: "center",
        render: (r: InquiryListItem) => (
          <span className="font-mono text-[12px]">{r.message_count}</span>
        ),
      },
      {
        key: "updated_at",
        header: "최근 활동",
        width: "160px",
        align: "center",
        render: (r: InquiryListItem) => (
          <span className="font-mono text-[11px] text-text-sub">
            {formatStamp(r.last_message_at ?? r.updated_at)}
          </span>
        ),
      },
    ],
    [],
  );

  const counts = data?.counts;

  return (
    <div className="px-6 md:px-8 py-6 flex flex-col gap-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-semibold tracking-tight text-text-main">
            문의 관리
          </h1>
          <p className="text-[13px] text-text-sub mt-1">
            1:1 문의 · 답변은 사용자 화면과 메일 양쪽으로 전달됩니다
          </p>
        </div>
        {data && (
          <span className="text-[12px] text-text-sub">
            총{" "}
            <span className="font-semibold text-text-main">{data.total}</span>건
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {FILTERS.map((f) => {
            const active = status === f.value;
            const count =
              f.value === "all"
                ? counts
                  ? Object.values(counts).reduce((a, b) => a + b, 0)
                  : undefined
                : counts?.[f.value];
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => setStatus(f.value)}
                className={[
                  "inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium transition-colors",
                  active
                    ? "bg-main text-white"
                    : "bg-bg-sub text-text-sub hover:bg-bg-hover",
                ].join(" ")}
              >
                {f.label}
                {count !== undefined && (
                  <span
                    className={[
                      "font-mono text-[11px]",
                      active ? "text-white/70" : "text-text-disabled",
                    ].join(" ")}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <InputBox
            value={keyword}
            onChange={setKeyword}
            placeholder="제목 · 이름 · 이메일 검색"
            size="sm"
            width={240}
            leftIcon={<SearchIcon />}
          />
          <Button variant="sub2" size="sm" onClick={handleSearch}>
            검색
          </Button>
        </div>
      </div>

      <Table
        columns={columns}
        data={data?.items ?? []}
        size="sm"
        loading={isLoading}
        onRowClick={(r: InquiryListItem) => openDetail(r.id)}
      />

      {data && data.total > PAGE_SIZE && (
        <Pagination
          page={page}
          total={data.total}
          pageSize={PAGE_SIZE}
          onChange={setPage}
          className="self-center"
        />
      )}

      {selectedId !== null && (
        <InquiryDetail id={selectedId} onClose={closeDetail} />
      )}
    </div>
  );
};

interface InquiryDetailProps {
  id: number;
  onClose: () => void;
}

/**
 * 스레드 + 답변 작성. `id`가 확정된 뒤에만 마운트되므로 훅 안에서
 * URL을 조건 없이 만들 수 있다.
 */
const InquiryDetail = ({ id, onClose }: InquiryDetailProps) => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");

  const { data: thread, isLoading } = useGet<InquiryThreadDto>(
    `api/admin/inquiries/${id}`,
    ["admin-inquiry", id],
  );

  const reply = usePost<
    { content: string; close?: boolean },
    InquiryReplyResult
  >(`api/admin/inquiries/${id}/reply`);
  const changeStatus = usePatch<InquiryThreadDto, { status: InquiryStatus }>(
    `api/admin/inquiries/${id}/status`,
  );

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-inquiry", id] });
    queryClient.invalidateQueries({ queryKey: ["admin-inquiries"] });
  };

  const handleReply = (close: boolean) => {
    const text = content.trim();
    if (!text) return;

    reply.mutate(
      { content: text, close },
      {
        onSuccess: (result) => {
          setContent("");
          refresh();
          // 메일이 실제로 나갔는지 그대로 말해준다. 발송 인프라가 붙기 전까지는
          // 항상 false라, "답변했으니 메일도 갔겠지"라는 오해를 막아야 한다.
          if (result.mail_sent) {
            toast.success("답변을 등록하고 메일을 보냈습니다.");
          } else {
            toast.warning(
              "답변을 등록했습니다. 메일 발송은 아직 연결되지 않아 사용자 화면에만 표시됩니다.",
            );
          }
        },
        onError: (e) => toast.error(e.message || "답변 등록에 실패했습니다."),
      },
    );
  };

  const handleStatus = (status: InquiryStatus) => {
    changeStatus.mutate(
      { status },
      {
        onSuccess: () => {
          refresh();
          toast.success(`${STATUS_LABEL[status]}(으)로 변경했습니다.`);
        },
        onError: (e) => toast.error(e.message || "상태 변경에 실패했습니다."),
      },
    );
  };

  return (
    <FormModal
      open
      onClose={onClose}
      headerType="left"
      size="lg"
      title={thread?.subject ?? "문의"}
      description={
        thread
          ? `#${thread.id} · ${CATEGORY_LABEL[thread.category]} · ${thread.name} · ${contactText(thread)}`
          : undefined
      }
      footerType={0}
    >
      {isLoading || !thread ? (
        // Loading은 화면 전체를 덮는 오버레이라 모달 안에서 쓰면 모달을 가린다.
        <div className="flex flex-col gap-3 py-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-16 w-4/5 rounded-lg" />
          <Skeleton className="h-16 w-4/5 rounded-lg self-end" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <span
              className={[
                "inline-flex items-center px-1.5 h-5 rounded text-[11px] font-medium",
                STATUS_CLASS[thread.status],
              ].join(" ")}
            >
              {STATUS_LABEL[thread.status]}
            </span>
            <div className="flex items-center gap-1.5">
              {thread.status === "closed" ? (
                <Button
                  variant="sub2"
                  size="sm"
                  onClick={() => handleStatus("open")}
                  disabled={changeStatus.isPending}
                >
                  다시 열기
                </Button>
              ) : (
                <Button
                  variant="sub2"
                  size="sm"
                  onClick={() => handleStatus("closed")}
                  disabled={changeStatus.isPending}
                >
                  종료 처리
                </Button>
              )}
            </div>
          </div>

          <InquiryThread messages={thread.messages} name={thread.name} />

          {thread.status === "closed" ? (
            <p className="text-[12px] text-gray-500 border-t pt-3">
              종료된 문의입니다. 답변하려면 먼저 다시 열어주세요.
            </p>
          ) : (
            <div className="flex flex-col gap-2 border-t pt-3">
              <TextareaBox
                value={content}
                onChange={setContent}
                placeholder={
                  thread.email
                    ? "답변을 입력하세요. 사용자 화면과 메일로 함께 전달됩니다."
                    : "답변을 입력하세요. 사용자 화면에 남습니다 — 문자는 직접 보내주세요."
                }
                rows={5}
                size="sm"
              />
              <div className="flex items-center justify-between gap-2">
                {thread.email ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
                    <MailIcon className="w-3 h-3" />
                    {thread.email}
                  </span>
                ) : (
                  // 메일 주소가 없으면 답변을 등록해도 알림이 나가지 않는다.
                  // 운영자가 직접 문자를 보내야 하므로 번호를 바로 옆에 띄운다.
                  <span className="inline-flex items-center gap-1 text-[11px] text-point-amber">
                    <PhoneIcon className="w-3 h-3" />
                    {thread.phone} · 이메일이 없어 문자로 안내해야 합니다
                  </span>
                )}
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="sub2"
                    size="sm"
                    onClick={() => handleReply(true)}
                    disabled={reply.isPending || !content.trim()}
                  >
                    답변 후 종료
                  </Button>
                  <Button
                    variant="main"
                    size="sm"
                    onClick={() => handleReply(false)}
                    disabled={reply.isPending || !content.trim()}
                  >
                    {reply.isPending ? "등록 중..." : "답변 등록"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </FormModal>
  );
};

export default AdminInquiries;
