# Frontend — CLAUDE.md

React 19 + TypeScript + Vite + TanStack Query v5 + Tailwind CSS v3 + lucide-react

## 폴더 구조

```
src/
├── App.tsx                  # 루트 라우터
├── container/               # 라우터 연결 페이지 (비즈니스 로직 + 훅)
│   ├── admin/               # 관리자 페이지 (customers, models, payments, group, login ...)
│   ├── dashboard/           # 사용자 대시보드 (home, botEdit, keys, billing ...)
│   ├── auth/ client/        # 로그인 / OAuth 콜백
│   ├── embed/ legal/        # 임베드 위젯 / 약관
│   └── landing.tsx guide.tsx notfound.tsx
├── component/
│   ├── admin/               # 관리자 전용 UI (layout/ modal/ ui/)
│   ├── dashboard/           # 사용자 대시보드 전용 UI (bot/ layout/ ui/)
│   ├── auth/                # 로그인·OAuth 관련 UI
│   └── landing/             # 랜딩 페이지 UI
├── hooks/                   # auth/ · common/(useAPI useAuth getCookie useAudioWs ...)
├── context/                 # AuthProvider · ThemeProvider · ToastProvider
├── types/                   # user.ts auth.ts admin/
└── utils/format/            # date.ts number.ts time.ts
```

## UI 컴포넌트

공통 `component/common/` 폴더는 **없다**. UI 컴포넌트는 화면 영역별로 나뉘어 있다.
새 화면을 만들 때는 해당 영역의 기존 컴포넌트를 재사용하고, 직접 새로 만들지 않는다.
각 컴포넌트의 props는 해당 파일 상단 인터페이스를 참고한다.

### 관리자 — `component/admin/ui/`

관리자 페이지(`container/admin/*`)에서 사용.

| 분류 | 컴포넌트 |
|------|----------|
| `feedback/` | alert, modal, confirmModal, formModal, toast |
| `form/` | button, inputbox, selectBox, comboBox, textareaBox, checkbox, radioButton, toggle, calendar |
| `table/` | table (+ tableHeader, tableBody) |
| 기타 | loading, pagination |

import 예: `import Table from "@/component/admin/ui/table/table";`

### 사용자 대시보드 — `component/dashboard/ui/`

대시보드 페이지(`container/dashboard/*`)에서 사용.

| 컴포넌트 |
|----------|
| button, card, input, textarea, select, field |
| confirmModal, codeBlock, logoUpload, themeToggle |

import 예: `import Button from "@/component/dashboard/ui/button";`

## 코딩 컨벤션

**경로 alias**
```typescript
import Foo from "@/component/...";     // src/ 기준
import Bar from "container/admin/..."; // src/container/ 기준
```

**API 호출**
```typescript
import { useGet, usePost } from "@/hooks/common/useAPI";

const { data, isLoading } = useGet<MyType>("/api/resource", ["query-key"]);

const mutation = usePost<ReqType, ResType>("/api/resource");
mutation.mutate(payload, { onSuccess: () => {}, onError: () => {} });
// 응답: BaseResponse<T> = { success, message, data, errorCode }
// 401 자동 토큰 갱신 처리됨
```

**인증 상태**
```typescript
import { useAuth } from "@/hooks/common/useAuth";
const { user, isLoading } = useAuth();
```

**컴포넌트 / 훅 정의**
```typescript
// ✅ 컴포넌트 — 화살표 함수 + default export
const MyComponent = ({ label }: MyComponentProps) => <div>{label}</div>;
export default MyComponent;

// ✅ 훅 — named export
export const useMyHook = () => {};

// ❌ function 키워드 금지 (App.tsx 제외)
```

**규칙**
- `container/`: 라우터 연결 페이지. 비즈니스 로직 + 훅.
- `component/`: 순수 UI. props만 받아 렌더링.
- 상태: TanStack Query (서버) + useState (로컬). 전역은 context.
- 타입은 `src/types/`에 정의.

**Tailwind 커스텀 색상**
```
bg-main / bg-main-hover / bg-main-active   → #1C1C1C (어두운 배경)
bg-sub1 / bg-sub1-hover / bg-sub1-active   → #3A3A3A (중간 배경)
bg-sub2 / bg-sub2-hover / bg-sub2-active   → #F2F2F2 (밝은 배경)
text-main / text-sub1 / text-sub2          → 텍스트
```
