# chatbase.kr — CLAUDE.md

한 레포에 앱 둘.

```
backend/    FastAPI + MySQL + Redis        :8000
chatbase/   React — chatbase.kr            :3000
```

`npm install`·`npm run dev`는 `chatbase/`에서 한다. 백엔드는 `backend/`에서 따로 돈다.

### AEO 앱은 지웠다 — 스키마의 상품 축은 남아 있다

`aeo/`(llm.chatbase.kr)를 만들다 접었고 폴더째 삭제했다(`1c1c545`).
그런데 **백엔드의 상품 축은 그대로 두었다**:

- `Plan` 옆에 `Product` enum이 있고 `Product.AEO` 값이 살아 있다
- `tb_subscriptions`가 `(user_id, product)` 유니크다

지운 건 프론트 앱이고, **한 사람이 상품마다 구독을 따로 갖는 구조**는 스키마에
박혀 있다. 다음 상품이 생기면 `Product`에 값 하나만 늘리면 되고 마이그레이션이
필요 없다. 지금 이걸 걷어내면 그때 다시 만들어야 하므로 **일부러 남긴 것**이다.
`Product`를 보고 "쓰지도 않는 추상"이라고 판단해서 지우지 말 것.

세부 규칙은 [`chatbase/CLAUDE.md`](chatbase/CLAUDE.md) · [`backend/CLAUDE.md`](backend/CLAUDE.md).

### 문서 위치

상품 문서는 상품 폴더 안에 있다. 루트에는 레포 전체에 걸치는 것만 둔다.

| 위치 | 문서 | 무엇 |
|------|------|------|
| 루트 | `CLAUDE.md`(이 문서) | 레포 구조 · 규칙 |
| 루트 | `DESIGN.md` | 디자인 시스템 · 토큰 |
| `chatbase/` | `PROJECT.md` | **현재 동작하는 방식** + 함정 모음 |
| `chatbase/` | `NEED.md` | 기능 보완 — 지금 하는 것 |
| `chatbase/` | `TODO.md` | 사업 확장 — 그다음 |
| `chatbase/` | `SALES.md` | 어디에 어떻게 팔지 + 계산 근거 |
| `chatbase/` | `OUTREACH.md` | 가입할 곳 · 채널 · 복붙 문구 |
| `chatbase/` | `PROGRESS.md` | 단계별 진행 기록 |
| `chatbase/` | `chatbase-knowledge.txt` | 랜딩 데모 봇의 학습 자료 |

**넷의 경계**: `PROJECT.md`는 *왜 그게 그런지*, `NEED.md`·`TODO.md`는 *무엇을 할지*,
`SALES.md`는 *어떻게 팔지*. 설명이 길어지면 PROJECT로, 체크박스가 필요해지면 나머지로.

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | React 19 + TypeScript + Vite + TanStack Query v5 + Tailwind CSS v3 |
| Backend | FastAPI + SQLAlchemy 2.0 (async) + MySQL 8 (asyncmy) + Redis + Alembic |
| 인프라 | AWS EC2(nginx + gunicorn) + RDS MySQL + ElastiCache Redis · Cloudflare |
| 인증 | JWT + OAuth (Google, Kakao) |
| 결제 | 토스페이먼츠 빌링키 정기결제 |
| LLM | OpenAI / Anthropic / Google — **전부 사용자 키(BYOK)** |

## 네이밍 규칙

| 대상 | 규칙 | 예시 |
|------|------|------|
| 컴포넌트 / 클래스 | PascalCase | `UserCard`, `AuthService` |
| 타입 / 인터페이스 | PascalCase | `UserInfo`, `BaseResponse<T>` |
| 함수 / 변수 / 훅 | camelCase | `handleSubmit`, `useAuth` |
| 이벤트 핸들러 | `handle` 접두사 | `handleClick` |
| 폴더명 | camelCase (소문자 시작) | `sideBar/`, `feedback/` |
| 파일명 (Frontend) | camelCase | `inputbox.tsx`, `useAPI.ts` |
| 파일명 (Backend) | snake_case | `user_service.py` |

## 🚫 사용자 지시 없이 하지 말 것

아래 셋은 **내가 명시적으로 시킬 때만** 한다. "다 해", "진행해" 같은
포괄적인 승인은 이 셋에 대한 허락이 아니다.

| 금지 | 이유 |
|------|------|
| **dev 서버·포트 실행** (`npm run dev`, `uvicorn`, 백그라운드 실행) | 내가 이미 띄워둔 서버와 포트가 충돌한다. 좀비 프로세스가 남아 파일 핸들을 잡으면 폴더 이동·삭제가 막힌다 |
| **`git commit`** | 커밋 시점과 단위는 내가 정한다. 작업은 워킹트리에 남겨두고 보고만 한다 |
| **`alembic upgrade` (마이그레이션 적용)** | DB를 바꾸는 일이다. 마이그레이션 **파일 작성까지만** 하고, 적용은 내가 한다 |

대신 이렇게 한다:
- 서버가 필요하면 → "띄워서 확인해 주세요"라고 말하고 멈춘다
- 커밋할 것이 준비되면 → 변경 요약을 보여주고 커밋 여부를 묻는다
- 마이그레이션을 만들었으면 → 파일 경로와 `alembic upgrade head` 명령을 알려준다

## 작업 원칙

1. Phase 단위로 작업. 한 번에 여러 Phase 수행 금지.
2. 매 Phase 완료 시 `chatbase/PROGRESS.md` 업데이트. **커밋은 지시가 있을 때만.**
3. 테스트 통과 후 다음 Phase 진행.
4. 불확실하면 멈추고 질문. **추측으로 문서를 쓰지 않는다.**
5. 과도한 추상화 금지.
6. 빌드·린트·타입체크는 자유롭게 돌려도 된다. **상태를 바꾸는 것**(서버 기동 ·
   커밋 · DB 마이그레이션)만 지시를 받는다.

### 문서도 코드와 같이 고친다

한 번 어긋나면 다음 판단의 입력값이 통째로 틀어진다. 실제로 그랬다 —
GA4·프리렌더·QR·다국어·GLOBAL 플랜까지 갔는데 `NEED.md`는 "분석 도구가 하나도
없다"에, `PROJECT.md`는 3플랜에 멈춰 있었다. **한 일을 남은 일로 읽게 되면
같은 시간을 두 번 쓴다.**

| 코드를 이렇게 고치면 | 같이 봐야 하는 문서 |
|---|---|
| 플랜·가격·한도 | `PROJECT.md` 요금제 표 · `plan.py` · `types/plan.ts` **셋 다** |
| 라우트 추가 | `publicRoutes.tsx` · `prerender.tsx` ROUTES · `public/sitemap.xml` **셋 다** |
| DB 테이블 추가 | `PROJECT.md` 테이블 목록 |
| 기능 완료 | `NEED.md`/`TODO.md` 체크박스 + `PROGRESS.md` 한 회차 |

## Phase 관리

**시작 순서**: `chatbase/PROJECT.md` 기능 정의 → Claude가 Phase 계획 수립 →
사용자 승인 → Phase 1부터 개발

**Phase 양식** (계획을 세울 때):
```markdown
## Phase N: [이름]
**목표**: ...
**수행 내용**: ...
**완료 기준**: - [ ] ...
**커밋 메시지(안)**: `N단계: [설명]` — 실제 커밋은 지시를 받고 한다
```

## 진행 기록 — `chatbase/PROGRESS.md`

**Phase 완료 시 양식**:
```markdown
## N 단계: [이름]
- 상태: ⬜ 대기 / 🔄 진행중 / ✅ 완료 / ❌ 실패
- 완료 시각:
- 수행 내용:
- 이슈/메모:
- 남은 것:
```

`이슈/메모`에는 **왜 그렇게 했는지**와 **밟은 함정**을 남긴다.
"무엇을 했다"는 diff를 보면 알지만, "왜"와 "다음에 조심할 것"은 여기 없으면 사라진다.

`남은 것`에는 **적용하지 않은 마이그레이션**과 **직접 눈으로 봐야 하는 확인**을
적는다. 내가 서버를 띄워야만 되는 일이 여기 모인다.

## 트러블슈팅

| 상황 | 대응 |
|------|------|
| 외부 API 키 없음 | mock 데이터로 fallback, 키 확보 후 교체 |
| 테스트 실패 | 원인 파악 후 수정. 우회 금지 |
| 불명확한 요구사항 | 추측 말고 질문 후 진행 |
| 예상치 못한 파일 발견 | 삭제 전 반드시 확인 요청 |
| 셸 heredoc에 `\n`이 있는 패치 | heredoc이 백슬래시를 먹는다. 스크립트 파일로 뺄 것 |
