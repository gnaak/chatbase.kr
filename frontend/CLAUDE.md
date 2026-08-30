# Frontend — CLAUDE.md

React 19 + TypeScript + Vite + TanStack Query v5 + Tailwind CSS v3 + lucide-react

## 폴더 구조 — 상품별로 갈라져 있다

**두 상품을 한 레포에서 관리한다.** `chatbase.kr`(챗봇)과 `llm.chatbase.kr`(AEO/GEO)는
서로를 전제하지 않는다 — AEO만 쓰는 고객이 따로 있다.

```
src/
├── shared/          어느 상품에도 안 묶이는 것
│   ├── app.tsx      프로바이더 스택 + 404. 두 진입점이 공유
│   ├── routes.tsx   공통 라우트 (로그인 · 약관 · 문의 · OAuth 콜백)
│   ├── ui/          디자인 시스템 (button card input select textarea field ...)
│   ├── component/   auth/ inquiry/
│   ├── container/   auth/ client/ legal/ support/ notfound.tsx
│   ├── hooks/       auth/ · common/(useAPI useAuth getCookie useToast ...)
│   ├── context/     AuthProvider ThemeProvider ToastProvider
│   ├── types/       user.ts auth.ts inquiry.ts
│   └── utils/format/
├── chatbase/        상품 1 — 챗봇
│   ├── routes.tsx   / · /embed/:botId · /dashboard/*
│   ├── component/   bot/ layout/ billing/ landing/
│   ├── container/   dashboard/ embed/ landing.tsx guide.tsx
│   └── types/       plan.ts usage.ts stats.ts payment.ts
├── llm/             상품 2 — AEO/GEO
│   ├── routes.tsx
│   └── container/
├── admin/           어드민 (두 상품을 함께 관리)
│   ├── routes.tsx · component/ · container/ · types/
└── entry/
    ├── chatbase.tsx  ← index.html
    └── llm.tsx       ← llm.html
```

### 지켜야 할 규칙 하나

**`chatbase/`와 `llm/`은 서로를 import하지 않는다.** 공통이 필요하면 `shared/`로 올린다.

이것만 지키면 세 번째 상품은 폴더 하나 추가로 끝나고 기존 둘은 손대지 않는다.
alias가 경계를 강제한다 — `@llm/...`을 chatbase 코드에서 import하면 바로 눈에 띈다.

### 빌드 — 한 번에 산출물 둘

`npm run build` 한 번으로 `dist/index.html`(챗봇)과 `dist/llm.html`(AEO)이 나온다.
Rollup이 공유 코드를 공통 청크로 한 번만 뽑으므로 중복이 없고, **AEO 진입점은
챗봇 코드를 가져가지 않는다**(챗봇 431KB / AEO 1.3KB + 공유 346KB).

nginx는 `server_name`으로 진입 HTML만 갈라준다.

```nginx
server { server_name chatbase.kr;     root .../dist; try_files $uri /index.html; }
server { server_name llm.chatbase.kr; root .../dist; try_files $uri /llm.html; }
```

개발 서버는 그대로다 — `npm run dev` → `localhost:3000`이 챗봇,
`localhost:3000/llm.html`이 AEO.

## UI 컴포넌트

공통 `component/common/` 폴더는 **없다**. 디자인 시스템은 `shared/ui/`에 있고,
상품 전용 UI는 각 상품 폴더 안에 있다.
새 화면을 만들 때는 기존 컴포넌트를 재사용하고, 직접 새로 만들지 않는다.

### 디자인 시스템 — `shared/ui/`

| 컴포넌트 |
|----------|
| button, card, input, textarea, select, field |
| confirmModal, codeBlock, logoUpload, themeToggle, skeleton, lineChart |

import 예: `import Button from "@shared/ui/button";`

**버튼은 `pill`이 기본이다.** 액션 버튼은 캡슐형, `ghost` 취소 버튼만 각진 모서리.

### 관리자 — `admin/component/ui/`

| 분류 | 컴포넌트 |
|------|----------|
| `feedback/` | alert, modal, confirmModal, formModal, toast |
| `form/` | button, inputbox, selectBox, comboBox, textareaBox, checkbox, radioButton, toggle, calendar |
| `table/` | table (+ tableHeader, tableBody) |
| 기타 | loading, pagination, skeleton, statCard |

import 예: `import Table from "@admin/component/ui/table/table";`

⚠️ `loading.tsx`는 화면 전체를 덮는 오버레이다. 모달 안에서 쓰면 모달을 가린다 —
그럴 땐 `skeleton`을 쓴다.

## 코딩 컨벤션

**경로 alias** (`vite.config.ts`와 `tsconfig.app.json`을 반드시 같이 유지)
```typescript
import Button from "@shared/ui/button";          // src/shared/
import Home from "@chatbase/container/dashboard/home";  // src/chatbase/
import Landing from "@llm/container/landing";    // src/llm/
import Table from "@admin/component/ui/table/table";    // src/admin/
import logo from "@/assets/...";                 // src/ (에셋 등)
```

**API 호출**
```typescript
import { useGet, usePost } from "@shared/hooks/common/useAPI";

const { data, isLoading } = useGet<MyType>("/api/resource", ["query-key"]);

const mutation = usePost<ReqType, ResType>("/api/resource");
mutation.mutate(payload, { onSuccess: () => {}, onError: () => {} });
// 응답: BaseResponse<T> = { success, message, data, errorCode }
// 401 자동 토큰 갱신 처리됨
```

**인증 상태**
```typescript
import { useAuth } from "@shared/hooks/common/useAuth";
const { user, isLoading } = useAuth();
```

**컴포넌트 / 훅 정의**
```typescript
// ✅ 컴포넌트 — 화살표 함수 + default export
const MyComponent = ({ label }: MyComponentProps) => <div>{label}</div>;
export default MyComponent;

// ✅ 훅 — named export
export const useMyHook = () => {};

// ❌ function 키워드 금지
```

**규칙**
- `container/`: 라우터 연결 페이지. 비즈니스 로직 + 훅.
- `component/`: 순수 UI. props만 받아 렌더링.
- 상태: TanStack Query (서버) + useState (로컬). 전역은 context.
- 타입은 상품 경계에 맞춰 `shared/types/` 또는 `<상품>/types/`에 정의.

**Tailwind 커스텀 색상**
```
bg-main / bg-main-hover / bg-main-active   → #1C1C1C (어두운 배경)
bg-sub1 / bg-sub1-hover / bg-sub1-active   → #3A3A3A (중간 배경)
bg-sub2 / bg-sub2-hover / bg-sub2-active   → #F2F2F2 (밝은 배경)
text-main / text-sub1 / text-sub2          → 텍스트
```
