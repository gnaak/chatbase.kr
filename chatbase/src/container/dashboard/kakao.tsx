import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ChevronDown, MessageCircle, Sparkles } from "lucide-react";
import Topbar from "@/component/layout/topbar";
import Card from "@/ui/card";
import Button from "@/ui/button";
import KakaoConnect from "@/component/bot/kakaoConnect";
import { useGet } from "@/hooks/common/useAPI";
import type { UsageSummary } from "@/types/usage";

interface BotDto {
  id: string; // slug
  name: string;
  active: boolean;
}

/** 목록에서 연결 여부만 보여주기 위한 최소 조회. 상세는 KakaoConnect가 직접 가져온다. */
interface KakaoConnectionDto {
  connected: boolean;
  last_message_at: string | null;
}

const Kakao = () => {
  const { data: bots, isLoading } = useGet<BotDto[]>("api/bot/", ["bots"]);
  const { data: usage } = useGet<UsageSummary>("api/usage/", ["usage"]);
  const [openSlug, setOpenSlug] = useState<string | null>(null);

  // 플랜을 못 불러온 동안은 보수적으로 미포함 취급.
  const included = usage?.kakao_channel === true;
  const blocked = !included;
  // 처음부터 안 쓴 사람과 쓰다가 끊긴 사람은 안내가 달라야 한다.
  // 후자는 이미 오픈빌더에 URL을 등록해둬서, 지금 채널이 죽어 있는 상태다.
  const interrupted = blocked && !!usage?.kakao_in_use;

  return (
    <>
      <Topbar
        title="카카오톡"
        description="카카오 i 오픈빌더 스킬 서버로 챗봇을 연결합니다."
      />

      <div className="flex-1 overflow-y-auto px-8 md:px-12 py-8">
        <div className="flex flex-col gap-4 max-w-3xl mx-auto">
          {!included && (
            <Card
              variant="outline"
              className={[
                "p-5 flex items-start justify-between gap-4 flex-wrap",
                // 쓰다가 끊긴 경우는 지금 문제가 생긴 상태라 경고색으로 구분한다.
                interrupted ? "bg-warning-bg" : "",
              ].join(" ")}
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-8 h-8 rounded-DEFAULT bg-bg-sub shadow-border flex items-center justify-center shrink-0">
                  {interrupted ? (
                    <AlertTriangle className="w-4 h-4 text-warning" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-text-sub" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-text-main">
                    {interrupted
                      ? "카카오톡 채널 연동이 중단되었습니다"
                      : "카카오톡 채널 연동은 PREMIUM 플랜 기능입니다"}
                  </div>
                  <p className="text-[12px] text-text-sub mt-0.5 leading-relaxed">
                    {interrupted ? (
                      <>
                        현재 플랜에 카카오톡이 포함되지 않아,{" "}
                        <strong className="text-text-main">
                          오픈빌더에 등록해두신 챗봇이 응답하지 않습니다.
                        </strong>{" "}
                        방문자에게는 대신 fallback 메시지가 나갑니다. PREMIUM으로
                        올리면 재설정 없이 바로 다시 동작합니다.
                      </>
                    ) : (
                      "플랜을 올리면 카카오톡 채널에서도 같은 챗봇이 답합니다."
                    )}
                  </p>
                </div>
              </div>
              {/* flex-wrap으로 아래 줄에 떨어질 때 justify-between이 단독 아이템을
                  왼쪽에 붙여버린다. ml-auto로 어느 줄에 놓이든 오른쪽 끝에 세운다. */}
              <Link to="/dashboard/billing" className="shrink-0 ml-auto">
                <Button size="sm" pill variant="primary">
                  {interrupted ? "PREMIUM으로 올리기" : "플랜 보기"}
                </Button>
              </Link>
            </Card>
          )}

          {blocked ? null : isLoading ? (
            <p className="text-[13px] text-text-sub py-8 text-center">
              챗봇을 불러오는 중...
            </p>
          ) : !bots || bots.length === 0 ? (
            <Card variant="outline" className="p-8 text-center">
              <div className="w-10 h-10 rounded-full bg-bg-sub shadow-border flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-4 h-4 text-text-sub" />
              </div>
              <h2 className="text-[16px] font-semibold tracking-tight text-text-main mb-1.5">
                연결할 챗봇이 없습니다
              </h2>
              <p className="text-[13px] text-text-sub leading-relaxed max-w-sm mx-auto mb-5">
                카카오톡 연결은 챗봇마다 따로 설정합니다. 먼저 챗봇을 만들어
                주세요.
              </p>
              <Link to="/dashboard/bots/new">
                <Button size="sm" pill>
                  챗봇 만들기
                </Button>
              </Link>
            </Card>
          ) : (
            <>
              <p className="text-[12px] text-text-sub leading-relaxed">
                카카오톡 연결은 챗봇마다 따로 설정합니다. 연결할 챗봇을
                선택하세요.
              </p>
              {bots.map((bot) => (
                <BotRow
                  key={bot.id}
                  bot={bot}
                  open={openSlug === bot.id}
                  onToggle={() =>
                    setOpenSlug((prev) => (prev === bot.id ? null : bot.id))
                  }
                />
              ))}
            </>
          )}
        </div>
      </div>
    </>
  );
};

interface BotRowProps {
  bot: BotDto;
  open: boolean;
  onToggle: () => void;
}

const BotRow = ({ bot, open, onToggle }: BotRowProps) => {
  // 목록 배지용. 펼치지 않아도 어느 봇이 연결됐는지 한눈에 보이게 한다.
  const { data: connection } = useGet<KakaoConnectionDto>(
    `api/kakao/connection/${bot.id}`,
    ["kakao-connection", bot.id],
  );

  return (
    <div className="rounded-comfy bg-bg-card shadow-border overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-[14px] font-medium text-text-main truncate">
            {bot.name}
          </span>
          {connection?.connected ? (
            <span className="shrink-0 inline-flex items-center px-2 h-5 rounded-full bg-success-bg text-success text-[10px] font-medium">
              연결됨
            </span>
          ) : (
            <span className="shrink-0 inline-flex items-center px-2 h-5 rounded-full bg-bg-sub text-text-sub text-[10px] font-medium">
              미연결
            </span>
          )}
          {!bot.active && (
            <span className="shrink-0 inline-flex items-center px-2 h-5 rounded-full bg-bg-sub text-text-disabled text-[10px] font-medium">
              비활성
            </span>
          )}
        </div>
        <ChevronDown
          className={[
            "shrink-0 w-4 h-4 text-text-sub transition-transform duration-200",
            open ? "rotate-180" : "",
          ].join(" ")}
        />
      </button>

      {open && (
        <div className="px-5 pb-5 pt-5 border-t border-line">
          <KakaoConnect botId={bot.id} />
        </div>
      )}
    </div>
  );
};

export default Kakao;
