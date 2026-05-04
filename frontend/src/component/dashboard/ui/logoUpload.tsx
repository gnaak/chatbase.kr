import { ChangeEvent, useRef } from "react";
import { ImageIcon, Upload, X } from "lucide-react";

interface LogoUploadProps {
  value?: string;
  onChange: (dataUrl: string | undefined) => void;
  maxSizeMB?: number;
}

const LogoUpload = ({ value, onChange, maxSizeMB = 2 }: LogoUploadProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > maxSizeMB * 1024 * 1024) {
      alert(`이미지는 ${maxSizeMB}MB 이하만 업로드 가능합니다.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") onChange(reader.result);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleClick = () => inputRef.current?.click();
  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(undefined);
  };

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleClick}
        aria-label="로고 업로드"
        className="
          relative w-14 h-14 rounded-comfy bg-bg-sub shadow-border
          flex items-center justify-center shrink-0
          hover:bg-bg-hover transition-colors
          group overflow-hidden
        "
      >
        {value ? (
          <img src={value} alt="로고" className="w-full h-full object-cover" />
        ) : (
          <ImageIcon className="w-5 h-5 text-text-sub" />
        )}
      </button>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleClick}
            className="
              inline-flex items-center gap-1.5 h-7 px-3 rounded-full
              text-[12px] font-medium text-text-main
              bg-bg shadow-border hover:bg-bg-hover
              transition-colors
            "
          >
            <Upload className="w-3 h-3" />
            {value ? "변경" : "업로드"}
          </button>
          {value && (
            <button
              type="button"
              onClick={handleRemove}
              className="
                inline-flex items-center gap-1 h-7 px-3 rounded-full
                text-[12px] font-medium text-text-sub hover:text-point-red
                hover:bg-bg-hover transition-colors
              "
            >
              <X className="w-3 h-3" />
              제거
            </button>
          )}
        </div>
        <p className="text-[11px] text-text-sub">PNG / JPG / SVG · 최대 {maxSizeMB}MB</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  );
};

export default LogoUpload;
