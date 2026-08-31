# chatbase — CLAUDE.md

React 19 + TypeScript + Vite + TanStack Query v5 + Tailwind CSS v3 + lucide-react

레포에서 유일한 프론트 앱이다. 백엔드(`../backend`)와만 짝을 이룬다.
(`aeo/`가 한때 옆에 있었지만 지웠다 — [`../CLAUDE.md`](../CLAUDE.md) 참고.)

## 폴더 구조

```
chatbase/
├── package.json  vite.config.ts  tailwind.config.js  postcss.config.cjs
├── tsconfig*.json  eslint.config.js  .env  .env.production
├── index.html                    메타 · OG · GA4 · 테마 선적용 스크립트
├── public/                       favicon · fonts · og-image · robots.txt
│                                 sitemap.xml · widget.js
├── scripts/prerender.mjs         빌드 후 정적 HTML 생성 (Node)
└── src/
    ├── main.tsx                  진입점
    ├── app.tsx                   프로바이더 스택 + 404. `router` prop을 받는다
    ├── routes.tsx                전체 라우트
    ├── publicRoutes.tsx          공개·크롤 대상만 — 프리렌더가 이것만 import
    ├── prerender.tsx             Node 전용. 라우트 렌더 + JSON-LD
    ├── index.css                 디자인 토큰
    ├── ui/                       디자인 시스템
    ├── component/                auth/ billing/ bot/ inquiry/ landing/ layout/
    ├── container/                auth/ client/ dashboard/ embed/ legal/ support/
    │                             landing.tsx guide.tsx notfound.tsx
    ├── admin/                    어드민 (routes · component · container · types)
    ├── hooks/                    auth/ · common/
    ├── context/                  AuthProvider ThemeProvider ToastProvider
    ├── types/                    auth inquiry payment plan stats usage user
    ├── utils/format/             date markdown number time
    └── assets/
```

### 실행

```bash
npm run dev          # :3000
npm run build        # vite build → dist/ → prerender.mjs 가 정적 HTML 덮어씀
npm run build:spa    # 프리렌더 없이 (디버깅용)
npm run check:types  # tsc --noEmit
```

⚠️ `vite build`는 **tsc를 거치지 않는다.** 타입 에러를 안고도 빌드가 통과하므로,
고친 파일의 에러 개수를 `check:types`로 **작업 전후 비교**한다. 전체 0을 목표로
하지 않는다 — 기존 에러(대부분 `useGet`의 `TQueryFnData` 추론)가 이미 쌓여 있다.

## 프리렌더 — 라우트를 추가하면 세 곳을 같이 고친다

랜딩이 클라이언트 렌더링이라 크롤러가 받는 `<body>` 텍스트가 **0자**였다.
Googlebot은 JS를 실행해 주지만 **GPTBot · OAI-SearchBot · ClaudeBot은 하지 않는다.**
그래서 빌드 시점에 공개 라우트를 정적 HTML로 뽑는다.

| # | 파일 | 무엇 |
|---|------|------|
| 1 | [`src/publicRoutes.tsx`](src/publicRoutes.tsx) | 라우트 정의 |
| 2 | [`src/prerender.tsx`](src/prerender.tsx) `ROUTES` | 라우트별 title · description · JSON-LD |
| 3 | [`public/sitemap.xml`](public/sitemap.xml) | 색인 요청 |

**어긋나면 sitemap에는 있는데 크롤러에겐 빈 페이지인 URL이 생긴다.**

⚠️ 프리렌더는 `routes.tsx`가 아니라 `publicRoutes.tsx`를 쓴다. 전자는 대시보드·
어드민 컨테이너 30여 개를 모듈 스코프에서 끌고 오는데, 그중 하나라도 모듈
스코프에서 `window`를 읽으면 Node에서 즉사한다(실제로 `botEdit.tsx`의
`EMBED_ORIGIN`이 그렇다).

⚠️ JSON-LD의 **가격은 `PLANS`에서 자동으로 읽지만 `featureList`는 손으로 쓴 배열**이다.
기능을 추가하면 저기도 넣어야 한다 — 안 그러면 "AI가 아는 우리"에 신상품이 빠진다.

## UI 컴포넌트

새 화면을 만들 때는 기존 컴포넌트를 재사용하고, 직접 새로 만들지 않는다.

### 디자인 시스템 — `src/ui/`

| 컴포넌트 |
|----------|
| button · card · input · textarea · select · field · toggle |
| confirmModal · codeBlock · logoUpload · themeToggle · skeleton · lineChart |

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

**플랜을 건드릴 때는 백엔드와 한 쌍이다.** [`src/types/plan.ts`](src/types/plan.ts)의
`PLANS[].limits`와 [`backend/app/core/utils/plan.py`](../backend/app/core/utils/plan.py)의
`PLAN_LIMITS`가 **같은 숫자여야 한다.** 한쪽만 고치면 "가격표엔 3개라고 써놓고
1개에서 막히는" 상황이 된다 — 실제로 한동안 어긋나 있었다.

**Tailwind 커스텀 색상**
```
bg-main / bg-main-hover / bg-main-active   → #1C1C1C (어두운 배경)
bg-sub1 / bg-sub1-hover / bg-sub1-active   → #3A3A3A (중간 배경)
bg-sub2 / bg-sub2-hover / bg-sub2-active   → #F2F2F2 (밝은 배경)
text-main / text-sub1 / text-sub2          → 텍스트
```

## 남의 사이트 안에서 도는 코드 — `/embed`

[`container/embed/`](src/container/embed/index.tsx)는 **고객 사이트의 iframe 안**에서 돈다.
여기에 우리 편의를 위한 것을 넣으면 남의 방문자에게 영향이 간다.

- **GA4를 싣지 않는다.** `index.html`이 `/embed` 경로에서 스크립트 자체를 안 받는다.
  suppress가 아니라 요청을 아예 안 만드는 쪽이다 — 개인정보처리방침에 없는 일이다.
- **우리 과금 문구를 보내지 않는다.** 상대는 봇 주인이 아니라 그 사람의 고객이다.
  플랜·한도로 막힐 때는 봇 주인의 fallback을 대신 쓴다.
