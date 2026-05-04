import { ChangeEvent, DragEvent, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, FileText, Trash2, Loader2 } from "lucide-react";
import { useDelete, useGet, usePost } from "@/hooks/common/useAPI";
import { useToast } from "@/hooks/common/useToast";

interface BotFileDto {
  id: number;
  filename: string;
  size: number;
  mime_type: string;
  uploaded_at: string | null;
}

interface FileLearningProps {
  slug: string;
  isOpenAIModel: boolean;
}

const formatBytes = (n: number): string => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

const FileLearning = ({ slug, isOpenAIModel }: FileLearningProps) => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const queryKey = ["bot-files", slug];
  const { data: files } = useGet<BotFileDto[]>(
    `api/bot/${slug}/files`,
    queryKey,
    isOpenAIModel,
  );

  const uploadMutation = usePost<FormData, BotFileDto[]>(`api/bot/${slug}/files`);

  const upload = (selected: File[]) => {
    if (!selected.length) return;
    if (!isOpenAIModel) {
      toast.error("파일 학습은 OpenAI 모델에서만 사용할 수 있습니다.");
      return;
    }
    const fd = new FormData();
    selected.forEach((f) => fd.append("files", f));
    uploadMutation.mutate(fd, {
      onSuccess: () => {
        toast.success(`${selected.length}개 파일을 업로드했습니다.`);
        queryClient.invalidateQueries({ queryKey });
      },
      onError: (err) => toast.error(err?.message || "업로드에 실패했습니다."),
    });
  };

  const handleSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = "";
    upload(list);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    if (!isOpenAIModel) return;
    upload(Array.from(e.dataTransfer.files));
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

  const uploading = uploadMutation.isPending;

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
        {uploading ? (
          <Loader2 className="w-5 h-5 text-text-sub animate-spin" />
        ) : (
          <Upload className="w-5 h-5 text-text-sub" />
        )}
        <p className="text-[13px] font-medium text-text-main">
          {uploading
            ? "업로드 중..."
            : "파일을 드래그하거나 클릭해서 업로드"}
        </p>
        <p className="text-[11px] text-text-sub">
          PDF / DOCX / TXT / MD 등 · OpenAI vector store에 안전하게 저장됩니다.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        onChange={handleSelect}
        className="hidden"
      />

      {files && files.length > 0 && (
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
  const deleteMutation = useDelete<void>(`api/bot/${slug}/files/${file.id}`);

  const handleRemove = () => {
    if (!window.confirm(`'${file.filename}' 을(를) 삭제할까요?`)) return;
    deleteMutation.mutate(undefined, {
      onSuccess: () => {
        toast.success("삭제되었습니다.");
        onDeleted();
      },
      onError: (err) => toast.error(err?.message || "삭제에 실패했습니다."),
    });
  };

  return (
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
        onClick={handleRemove}
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
  );
};

export default FileLearning;
