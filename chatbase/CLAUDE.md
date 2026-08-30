# chatbase — CLAUDE.md

React 19 + TypeScript + Vite + TanStack Query v5 + Tailwind CSS v3 + lucide-react

## 폴더 구조

**독립 앱이다.** `../llm`과 코드도 `node_modules`도 공유하지 않는다.
백엔드(`../backend`)만 같이 쓴다 — 계정·결제·어드민이 공용이기 때문.

```
chatbase/
├── package.json  node_modules  vite.config.ts  tailwind.config.js
├── tsconfig*.json  eslint.config.js  .env  .env.production
├── index.html
├── public/          favicon · fonts · og-image · robots.txt · sitemap.xml · widget.js
└── src/
    ├── main.tsx      진입점
    ├── app.tsx       프로바이더 스택 + 404
    ├── routes.tsx    챗봇 + 계정 · 약관 · 문의 라우트
    ├── index.css     디자인 토큰
    ├── ui/           디자인 시스템 (button card input select textarea field ...)
    ├── component/    auth/ bot/ layout/ billing/ landing/ inquiry/
    ├── container/    dashboard/ embed/ auth/ client/ legal/ support/
    │                 landing.tsx guide.tsx notfound.tsx
    ├── admin/        어드민 (routes · component · container · types)
    ├── hooks/        auth/ · common/(useAPI useAuth getCookie useToast ...)
    ├── context/      AuthProvider ThemeProvider ToastProvider
    ├── types/        plan usage stats payment user auth inquiry
    ├── utils/format/
    └── assets/
```

### 실행

```bash
npm run dev      # :3000
npm run build    # dist/
```

`../llm`은 :3001에서 자기 앱으로 따로 돈다. 각자 자기 `/`를 가지므로
로컬에서도 도메인이 나뉜 것처럼 동작한다.

### llm 앱과의 관계

두 앱은 **아무것도 공유하지 않는다.** 로그인 훅·UI 컴포넌트가 양쪽에 따로 있다.
`ui/button.tsx` 같은 걸 고치면 `../llm/src/ui/button.tsx`도 같이 봐야 한다.

공유하는 건 백엔드 하나뿐이다. 계정 쿠키가 `domain=chatbase.kr`라
서브도메인끼리 로그인이 이어진다.

## UI 컴포넌트

공통 `component/common/` 폴더는 **없다**. 디자인 시스템은 `shared/ui/`에 있고,
상품 전용 UI는 각 상품 폴더 안에 있다.
새 화면을 만들 때는 기존 컴포넌트를 재사용하고, 직접 새로 만들지 않는다.

### 디자인 시스템 — `src/ui/`

| 컴포넌트 |
|----------|
| button, card, input, textarea, select, field |
| confirmModal, codeBlock, logoUpload, themeToggle, skeleton, lineChart |

import 예: `import Button from "@/ui/button";`

**버튼은 `pill`이 기본이다.** 액션 버튼은 캡슐형, `ghost` 취소 버튼만 각진 모서리.

### 관리자 — `src/admin/component/ui/`

| 분류 | 컴포넌트 |
|------|----------|
| `feedback/` | alert, modal, confirmModal, formModal, toast |
| `form/` | button, inputbox, selectBox, comboBox, textareaBox, checkbox, radioButton, toggle, calendar |
| `table/` | table (+ tableHeader, tableBody) |
| 기타 | loading, pagination, skeleton, statCard |

import 예: `import Table from "@/admin/component/ui/table/table";`

⚠️ `loading.tsx`는 화면 전체를 덮는 오버레이다. 모달 안에서 쓰면 모달을 가린다 —
그럴 땐 `skeleton`을 쓴다.

## 코딩 컨벤션

**경로 alias**
```typescript
import Button from "@/ui/button";
import Home from "@/container/dashboard/home";
import Table from "@/admin/component/ui/table/table";
```
`@` → `src/`. `vite.config.ts`와 `tsconfig.app.json` 양쪽에 있으니 같이 유지한다.

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

// ❌ function 키워드 금지
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
