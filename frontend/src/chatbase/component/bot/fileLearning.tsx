import { ChangeEvent, DragEvent, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, FileText, Trash2, X } from "lucide-react";
import ConfirmModal from "@shared/ui/confirmModal";
import { useDelete, useGet } from "@shared/hooks/common/useAPI";
import { useToast } from "@shared/hooks/common/useToast";

interface BotFileDto {
  id: number;
  filename: string;
  size: number;
  mime_type: string;
  uploaded_at: string | null;
}

interface FileLearningProps {
  slug?: string;
  isOpenAIModel: boolean;
  pending: File[];
  onPendingChange: (next: File[]) => void;
}

const formatBytes = (n: number): string => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

const FileLearning = ({
  slug,
  isOpenAIModel,
  pending,
  onPendingChange,
}: FileLearningProps) => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const queryKey = ["bot-files", slug ?? ""];
  const { data: files } = useGet<BotFileDto[]>(
    `api/bot/${slug}/files`,
    queryKey,
    isOpenAIModel && !!slug,
  );

  const stage = (selected: File[]) => {
    if (!selected.length) return;
    if (!isOpenAIModel) {
      toast.error("파일 학습은 OpenAI 모델에서만 사용할 수 있습니다.");
      return;
    }
    onPendingChange([...pending, ...selected]);
  };

  const removePending = (idx: number) =>
    onPendingChange(pending.filter((_, i) => i !== idx));

  const handleSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = "";
    stage(list);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    if (!isOpenAIModel) return;
    stage(Array.from(e.dataTransfer.files));
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (isOpenAIModel) setDragActive(true);
  };

  const handleDragLeave = () => setDragActive(false);

  if (!isOpenAIModel) {
    return (
      <div className="rounded-comfy bg-bg-sub/40 shadow-border px-4 py-3 text-[12px] text-text-sub leading-relaxed">
        파일 업로드 학습은 현재 OpenAI 모델(GPT-4o, GPT-4o mini)에서만 작동합니다.
        다른 모델은 위의 학습 텍스트만 사용합니다.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={[
          "rounded-comfy shadow-border px-4 py-6 cursor-pointer transition-colors",
          "flex flex-col items-center justify-center gap-2 text-center",
          dragActive ? "bg-bg-hover" : "bg-bg-sub/40 hover:bg-bg-hover/60",
        ].join(" ")}
      >
        <Upload className="w-5 h-5 text-text-sub" />
        <p className="text-[13px] font-medium text-text-main">
          파일을 드래그하거나 클릭해서 추가
        </p>
        <p className="text-[11px] text-text-sub">
          저장 버튼을 누르면 OpenAI vector store에 일괄 업로드됩니다.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        onChange={handleSelect}
        className="hidden"
      />

      {pending.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-[11px] font-medium uppercase tracking-tight text-text-sub">
            업로드 대기 ({pending.length})
          </div>
          <ul className="flex flex-col gap-1.5">
            {pending.map((f, idx) => (
              <li
                key={`${f.name}-${idx}`}
                className="flex items-center gap-3 px-3 py-2 rounded-DEFAULT shadow-border bg-bg-card"
              >
                <FileText className="w-4 h-4 text-text-sub shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-text-main truncate">
                    {f.name}
                  </div>
                  <div className="text-[11px] text-text-sub">
                    {formatBytes(f.size)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removePending(idx)}
                  aria-label="목록에서 제거"
                  className="
                    inline-flex items-center justify-center w-7 h-7 rounded-full
                    text-text-sub hover:text-text-main hover:bg-bg-hover
                    transition-colors
                  "
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {slug && files && files.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {files.map((f) => (
            <FileItem
              key={f.id}
              slug={slug}
              file={f}
              onDeleted={() => queryClient.invalidateQueries({ queryKey })}
            />
          ))}
        </ul>
      )}
    </div>
  );
};

const FileItem = ({
  slug,
  file,
  onDeleted,
}: {
  slug: string;
  file: BotFileDto;
  onDeleted: () => void;
}) => {
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const deleteMutation = useDelete<void>(`api/bot/${slug}/files/${file.id}`);

  const handleRemove = async () => {
    setConfirming(false);
    try {
      await deleteMutation.mutateAsync();
      onDeleted();
      toast.success(`${file.filename} 삭제됨`);
    } catch (err) {
      const e = err as { message?: string; status?: number };
      console.error("file delete failed", e);
      toast.error(e?.message || `삭제 실패 (status: ${e?.status ?? "?"})`);
    }
  };

  return (
    <>
      <li className="flex items-center gap-3 px-3 py-2 rounded-DEFAULT shadow-border bg-bg-card">
        <FileText className="w-4 h-4 text-text-sub shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium text-text-main truncate">
            {file.filename}
          </div>
          <div className="text-[11px] text-text-sub">{formatBytes(file.size)}</div>
        </div>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label="파일 삭제"
          disabled={deleteMutation.isPending}
          className="
            inline-flex items-center justify-center w-7 h-7 rounded-full
            text-text-sub hover:text-point-red hover:bg-bg-hover
            transition-colors disabled:opacity-50
          "
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </li>

      <ConfirmModal
        open={confirming}
        variant="danger"
        icon={<Trash2 className="w-4 h-4" />}
        title="이 파일을 삭제할까요?"
        description={
          <>
            {/* break-all: 공백 없는 긴 파일명이 좁은 카드 밖으로 삐져나가지 않게. */}
            <span className="text-text-main break-all">{file.filename}</span>
            <br />
            챗봇이 더 이상 이 문서로 답하지 않아요. 되돌릴 수 없어요.
          </>
        }
        confirmLabel="삭제"
        onConfirm={handleRemove}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
};

export default FileLearning;
