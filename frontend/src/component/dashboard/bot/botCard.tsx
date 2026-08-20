import { Bot } from "lucide-react";
import Card from "@/component/dashboard/ui/card";

export interface BotCardData {
  id: string;
  name: string;
  description?: string;
  model?: string;
  conversations?: number;
  updatedAt?: string;
  active?: boolean;
}

interface BotCardProps {
  bot: BotCardData;
  onClick?: (bot: BotCardData) => void;
}

const BotCard = ({ bot, onClick }: BotCardProps) => {
  return (
    <Card
      variant="outline"
      interactive
      onClick={() => onClick?.(bot)}
      className="p-5 flex flex-col gap-4"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-DEFAULT bg-bg-sub shadow-border flex items-center justify-center shrink-0">
          <Bot className="w-4 h-4 text-text-sub" />
        </div>
        <div className="min-w-0">
          <div className="text-[14px] font-semibold tracking-tight text-text-main truncate">
            {bot.name}
          </div>
          {bot.model && (
            <div className="font-mono text-[11px] text-text-sub truncate">
              {bot.model}
            </div>
          )}
        </div>
      </div>

      {bot.description && (
        <p className="text-[13px] leading-relaxed text-text-sub line-clamp-2">
          {bot.description}
        </p>
      )}

      <div className="flex items-center justify-between mt-auto pt-1">
        <span
          className={[
            "inline-flex items-center gap-1.5 px-2 h-5 rounded-full text-[11px] font-medium",
            bot.active
              ? "bg-info-bg text-info"
              : "bg-bg-sub text-text-sub shadow-border",
          ].join(" ")}
        >
          <span
            className={[
              "w-1.5 h-1.5 rounded-full",
              bot.active ? "bg-info" : "bg-text-disabled",
            ].join(" ")}
          />
          {bot.active ? "활성" : "비활성"}
        </span>
        <div className="flex items-center gap-3 text-[11px] text-text-sub font-mono">
          {typeof bot.conversations === "number" && (
            <span>{bot.conversations.toLocaleString()} 대화</span>
          )}
          {bot.updatedAt && <span>{bot.updatedAt}</span>}
        </div>
      </div>
    </Card>
  );
};

export default BotCard;
