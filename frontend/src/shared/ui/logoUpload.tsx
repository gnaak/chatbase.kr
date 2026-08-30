import { ChangeEvent, useRef } from "react";
import { ImageIcon, Upload, X } from "lucide-react";

interface LogoUploadProps {
  value?: string;
  onChange: (dataUrl: string | undefined) => void;
  maxSizeMB?: number;
}

/** 저장되는 긴 변 픽셀. 로고는 위젯에서 56px 이하로만 쓰이므로 이 이상은 낭비다. */
const MAX_EDGE = 256;

/** base64 data URL 문자 수 상한. 백엔드 검증(300,000자)보다 넉넉히 아래로 잡는다. */
const MAX_DATA_URL_CHARS = 200_000;

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("파일을 읽을 수 없습니다."));
    reader.onerror = () => reject(new Error("파일을 읽을 수 없습니다."));
    reader.readAsDataURL(file);
  });

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("이미지를 불러올 수 없습니다."));
    img.src = src;
  });

/**
 * 긴 변을 MAX_EDGE로 줄여 webp(미지원 브라우저는 png)로 다시 인코딩한다.
 * 원본을 그대로 base64로 보내면 2MB 이미지가 약 2.7MB 문자열이 되어
 * DB 컬럼과 위젯 응답을 모두 터뜨린다.
 */
const shrink = async (dataUrl: string) => {
  const img = await loadImage(dataUrl);
  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, width, height);

  const webp = canvas.toDataURL("image/webp", 0.9);
  return webp.startsWith("data:image/webp")
    ? webp
    : canvas.toDataURL("image/png");
};

const LogoUpload = ({ value, onChange, maxSizeMB = 2 }: LogoUploadProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > maxSizeMB * 1024 * 1024) {
      alert(`이미지는 ${maxSizeMB}MB 이하만 업로드 가능합니다.`);
      return;
    }

    try {
      const raw = await readAsDataUrl(file);
      // SVG는 캔버스로 다시 그리면 벡터 이점을 잃는다. 보통 용량도 작아 그대로 쓴다.
      const result = file.type === "image/svg+xml" ? raw : await shrink(raw);

      if (result.length > MAX_DATA_URL_CHARS) {
        alert("이미지 용량이 너무 큽니다. 더 단순한 이미지를 사용해주세요.");
        return;
      }
      onChange(result);
    } catch (err) {
      alert(err instanceof Error ? err.message : "이미지를 처리할 수 없습니다.");
    }
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
        <p className="text-[11px] text-text-sub">
          PNG / JPG / SVG · 최대 {maxSizeMB}MB · 업로드 시 {MAX_EDGE}px로 자동 축소
        </p>
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
