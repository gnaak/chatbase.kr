# chatbase.kr — 코드 한 줄 또는 QR 한 장으로 붙이는 AI 챗봇

내 자료를 학습한 챗봇을 만들어 **홈페이지·매장·카카오톡**에 내거는 한국어 SaaS입니다.
가입하면 API 키 없이 바로 쓸 수 있고, 자기 키를 등록하면 모델 선택과 파일 학습이 열립니다.

🔗 **https://chatbase.kr**

---

## 1. 프로젝트 개요

### 무엇을 해결하는가

- **챗봇 하나 붙이는 데 외주비가 든다** — 자료를 넣으면 30초 만에 봇이 만들어지고, 붙이는 건 `<script>` 한 줄
- **홈페이지가 없으면 시작을 못 한다** — QR을 인쇄해 카운터에 두면 사이트 없이도 된다
- **가입하고 첫 대화가 실패한다** — OpenAI 키를 서비스가 내주므로 키 발급 없이 바로 대화가 된다
- **외국인 손님에게 한국어로만 답한다** — 방문자가 언어를 고르면 그 언어로 응대한다

### 진입 경로가 셋이고, 셋 다 같은 봇이다

| | 설치 | 누가 쓰나 |
|---|---|---|
| **위젯 / iframe** | `<script>` 한 줄을 `</body>` 앞에 | 홈페이지가 있는 곳 |
| **QR** | 대시보드에서 PNG 내려받아 인쇄 | **사이트가 없는 매장·숙소** |
| **카카오톡 채널** | 오픈빌더에 스킬 URL 등록 | 카카오로 문의가 오는 곳 |

QR이 다른 이유는 **남의 것을 아무것도 안 고친다**는 점입니다. 위젯은 사이트를,
카카오는 오픈빌더를 건드려야 하는데 QR은 종이 한 장이면 끝입니다.

---

## 2. 핵심 기능

### 봇 주인 (대시보드)

- **봇 만들기** — 이름·인사말·시스템 프롬프트·fallback 문구
- **학습 데이터 3종** — 텍스트 직접 입력 / 웹페이지 주소 / 파일 업로드(OpenAI 벡터 스토어)
- **자주 묻는 질문** — 버튼으로 뜨고, 누르면 **LLM을 안 거치고** 저장된 답이 즉답으로 나감
- **다국어 응대** — 한국어 · English · 日本語 · 中文. 인사말과 FAQ는 미리 번역해 둠
- **QR 코드** — 한 장. PNG로 내려받아 인쇄
- **대화 로그** — 세션 목록(챗봇·언어·채널·시각) + 전문 모달, 기간 필터
- **통계** — 대화량 추이, **답변 못 한 질문** 목록, LLM 오류 알림
- **결제** — 토스페이먼츠 빌링키 정기결제, 플랜 상향/하향 예약

### 방문자 (임베드)

- SSE 스트리밍 응답 — 총 10초가 걸려도 1초 만에 글이 나오기 시작
- 언어 선택 pill (다국어 봇만)
- FAQ 버튼 즉답
- Shadow DOM 격리 — 호스트 사이트 CSS와 섞이지 않음

### 운영자 (어드민)

- 고객·구독·결제 내역, 플랜 분포, MRR
- 1:1 문의 스레드 답변
- 모델 카탈로그 on/off (DB가 SOT)
- 유입 출처(UTM)별 가입 → 키 등록 → 유료 전환 집계

---

## 3. 기술 스택

| 계층 | 사용 기술 |
|------|-----------|
| **Frontend** | React 19 + TypeScript + Vite + TanStack Query v5 + Tailwind CSS v3 + React Router v7 |
| **Backend** | FastAPI + SQLAlchemy 2.0 (async) + MySQL 8 (asyncmy) + Alembic |
| **LLM** | OpenAI (Responses API · Vector Store · file_search) / Anthropic / Google Gemini |
| **결제** | 토스페이먼츠 빌링키 |
| **메일** | SMTP (Resend) |
| **인증** | JWT + HttpOnly Cookie + OAuth 2.0 (Google, Kakao) |
| **인프라** | AWS EC2 (nginx + gunicorn) · RDS MySQL · Cloudflare |

---

## 4. 프로젝트 구조

```
chatbase.kr/
├── backend/                    FastAPI
│   ├── alembic/versions/       마이그레이션 (git 추적 대상)
│   └── app/
│       ├── core/               설정 · DB · 미들웨어 · DI provider · 공용 유틸
│       ├── module/             도메인 모듈 (모델 + repository + service + router)
│       └── main.py
├── chatbase/                   React
│   ├── public/                 widget.js · robots.txt · sitemap.xml
│   ├── scripts/prerender.mjs   빌드 후 정적 HTML 생성
│   └── src/
│       ├── ui/                 디자인 시스템
│       ├── component/          순수 UI
│       ├── container/          라우터 연결 페이지
│       ├── admin/              어드민 (별도 디자인 시스템)
│       ├── hooks/              useAPI · useAuth
│       ├── prerender.tsx       Node 전용 — 라우트 렌더 + JSON-LD
│       └── publicRoutes.tsx    공개·크롤 대상 라우트
└── README.md
```

---

## 5. 백엔드 상세

### 5.1 모듈별 책임

| 모듈 | prefix | 하는 일 |
|------|--------|---------|
| `auth` | `/api/auth` | 이메일 로그인 + Google/Kakao OAuth, JWT 발급·갱신 |
| `user` | `/api/user` | 내 정보, 탈퇴(개인정보 파기) |
| `bot` | `/api/bot` | 챗봇 CRUD, 파일 업로드, FAQ, 번역 |
| `api_key` | `/api/api-key` | BYOK 키 등록·검증 (Fernet 암호화) |
| `chat` | `/api/chat` | 위젯 대화(SSE), 미리보기, 대화 로그 |
| `kakao_skill` | `/api/kakao` | 오픈빌더 스킬 서버 |
| `llm_model` | `/api/model` | 모델 카탈로그 |
| `usage` | `/api/usage` | 월 사용량, 플랜 게이팅 값 |
| `payment` | `/api/payment` | 토스 빌링키, 구독, 결제 이력 |
| `stats` | `/api/stats` | 대화 집계, 주제 묶기, LLM 오류 |
| `inquiry` | `/api/inquiry` | 1:1 문의 (회원 · 비회원 토큰) |
| `admin` | `/api/admin` | 운영자 화면 |
| `llm_error` | — | **라우터 없음.** 기록은 chat/kakao, 조회는 stats |
| `infra/*` | — | openai · anthropic · gemini · google · kakao · toss · llm · mail |

### 5.2 아키텍처 패턴

**도메인 4파일 세트**

각 도메인이 `xxx.py`(모델) → `xxx_repository.py`(쿼리만) → `xxx_service.py`(로직)
→ `xxx_router.py`(HTTP)로 나뉩니다. 세트가 다 안 차는 모듈이 있고 그게 정상입니다 —
`stats`는 남의 테이블을 집계할 뿐이라 **모델이 없고**, `llm_error`는 기록과 조회
주체가 달라 **라우터가 없습니다**.

**ServiceProvider (Lazy DI)**

요청마다 하나의 provider가 만들어지고, 리포지토리·서비스는 **실제로 참조되는
순간에만** 인스턴스화됩니다(lazy property). 라우터는 데코레이터 한 줄로 주입받습니다.

```python
@router.get("/me")
@with_provider
@with_login()
async def get_me(p: ServiceProvider):
    return await p.user_service.get_me(p.request)
```

⚠️ 지연 로딩은 **첫 요청이 LLM SDK 임포트 비용을 뒤집어쓰는** 부작용이 있어서
(실측 2.4초, 파이썬 임포트 락 때문에 동시 요청까지 직렬화됨) 기동 시점에 미리
임포트해 둡니다(`main.py`의 `_warm_llm_imports`).

### 5.3 채팅 — 두 개의 키 경로, 하나의 프롬프트 조립기

**키 해석**이 먼저입니다. 회원이 자기 키를 등록했고 그걸 쓰기로 했으면 BYOK,
아니면 서비스가 내주는 OpenAI 키(`SERVICE_MODEL` 고정)로 갑니다.

| | 서비스 키 | BYOK |
|---|---|---|
| 모델 | `gpt-5.6-luna` 고정 | 등록한 provider의 모델 선택 |
| 월 대화 한도 | 플랜별 상한 있음 | **없음** |
| 파일 학습 · 웹 검색 | ❌ | ✅ |
| 비용 부담 | 서비스 | 회원이 각 제공자에 직접 |

**시스템 프롬프트 조립** (`_build_system_prompt`)

1. 봇의 시스템 프롬프트
2. **언어 규칙** — 다국어면 방문자가 고른 언어로 고정, 아니면 한국어로 고정
3. 학습 텍스트 (`training_type`이 `file`이면 제외 — 모드를 바꿔도 옛 텍스트가
   조용히 주입되는 걸 막음)
4. fallback 규칙 또는 웹 검색 지시

⚠️ `vector_store_id`는 **provider 게이팅을 마친 값**을 받습니다. OpenAI가 아닌
모델은 파일 지식이 전달되지 않으므로, 봇에 벡터 스토어가 남아 있어도 '자료 한정'
규칙을 붙이면 **모든 질문에 fallback만 뱉는 봇**이 됩니다.

**응답**은 `StreamingResponse` + `text/event-stream`이고, 프론트는 `fetch` +
`ReadableStream.getReader()`로 청크를 받아 마크다운으로 렌더링합니다.

### 5.4 카카오톡 — 5초 제한과 콜백

오픈빌더는 스킬 응답을 **5초** 안에 받아야 합니다. 파일 학습을 붙이면 거의 항상
초과합니다(실측: 텍스트만 0.9~1.4초 → 파일 학습 4.9~5.4초).

블록에서 Callback API를 켜면 `userRequest.callbackUrl`이 함께 오고, 그때는:

```
① 즉시 {"version":"2.0","useCallback":true,...} 반환        (실측 29ms)
② 백그라운드에서 LLM 완주                                    (상한 60초)
③ callbackUrl 로 완성된 답 POST                              (1회용, 5분 유효)
```

백그라운드는 요청 세션이 닫히므로 **새 DB 세션**을 엽니다. `callbackUrl`이 없으면
기존 4.3초 동기 경로로 빠집니다.

시크릿은 **저장하지 않습니다.** `hash_key + slug`로 HMAC을 계산하는 결정적 값이라
컬럼도 마이그레이션도 필요 없습니다. 대신 폐기가 불가능하고, 플랜을 내렸다 올리면
같은 URL이 되살아납니다(재설정 불필요).

### 5.5 다국어 — 무엇을 미리 번역하고 무엇을 런타임에 맡기나

**기준은 하나: LLM을 안 거치고 화면에 그대로 뿌려지는 것만 미리 만든다.**

| | 방식 | 왜 |
|---|---|---|
| **대화 응답** | LLM이 실시간으로 | 방문자가 실제로 쓴 말을 따라가야 함 |
| **인사말 · FAQ** | 미리 번역해 저장 | 첫 화면은 방문자가 아직 아무 말도 안 했고, FAQ는 즉답이라 런타임 번역을 붙이면 그 성질이 사라짐 |
| **fallback** | 시스템 프롬프트 안에서 | 4개 국어로 응대하다 모르는 질문 하나에서 한국어가 튀어나오는 게 제일 티남 |
| **채팅창 UI 문구** | 코드에 4개 국어 직접 | 고정 문자열이라 번역기를 태울 이유가 없음 |

번역 결과는 `tb_bot_translations`에 저장하고, 원문(인사말+FAQ 합쳐서)의
`source_hash`가 안 바뀌었으면 다시 번역하지 않습니다.

**게이팅이 두 군데**입니다. 쓰기 시점만 막으면 상위 플랜을 한 달 결제해 켜둔 뒤
내려도 계속 돕니다(하향은 봇을 건드리지 않으므로). 실행 시점에도 매번 현재 플랜을
봅니다 — 하향 시 즉시 중단, 재상향 시 즉시 복구. **끄는 건 언제나 허용**합니다.

### 5.6 결제

토스페이먼츠 **빌링키** 정기결제입니다.

```
카드 등록 → 빌링키 발급 → tb_billing_methods
  → /api/payment/subscribe 로 첫 달 즉시 결제
  → tb_subscriptions.next_billing_at = +1개월
```

- **플랜 변경은 예약제** — `scheduled_plan`에 넣고 다음 청구일에 적용
- **상향은 예외로 즉시 전액 청구 + 결제일 리셋.** 토스 빌링키는 Stripe와 달리
  구독·정산·비례배분 기능이 없어 이 선택이 맞습니다
- `tb_subscriptions`가 `(user_id, product)` 유니크라, 상품이 늘어도 스키마는 그대로입니다

### 5.7 SEO / AI 크롤러 — 프리렌더

랜딩이 클라이언트 렌더링이라 크롤러가 받는 `<body>` 텍스트가 **0자**였습니다.
Googlebot은 JS를 실행해 주지만 **GPTBot · OAI-SearchBot · ClaudeBot은 하지 않습니다.**

빌드 시점에 공개 라우트를 정적 HTML로 뽑고 JSON-LD를 `<head>`에 넣습니다.

```
npm run build  →  vite build  →  scripts/prerender.mjs
```

라우트를 추가하면 **세 곳을 같이** 고쳐야 합니다 — `publicRoutes.tsx` ·
`prerender.tsx`의 `ROUTES` · `public/sitemap.xml`. 어긋나면 sitemap에는 있는데
크롤러에겐 빈 페이지인 URL이 생깁니다.

⚠️ 프리렌더는 `routes.tsx`가 아니라 `publicRoutes.tsx`를 씁니다. 전자는 대시보드
컨테이너를 전부 끌고 오는데 그중 일부가 모듈 스코프에서 `window`를 읽어 Node에서
죽습니다.

### 5.8 데이터 모델

```
tb_users  tb_admins
tb_api_keys                            사용자별 provider 키 (Fernet 암호문)
tb_bots  tb_bot_files                  봇 + 업로드 파일 메타
tb_bot_translations                    인사말·FAQ 번역본
tb_chat_sessions  tb_chat_messages     대화 세션 + 메시지
tb_llm_errors                          방문자 경로에서 난 LLM 오류
tb_models                              모델 카탈로그
tb_subscriptions  tb_billing_methods  tb_payments
tb_usage_monthly                       봇 × 연월 대화 건수
tb_inquiries  tb_inquiry_messages      1:1 문의 스레드
```

---

## 6. 프론트엔드 상세

### 6.1 라우팅

| 영역 | 경로 |
|---|---|
| **공개 (프리렌더 대상)** | `/` · `/terms` · `/privacy` · `/support` |
| **임베드** | `/embed/:botId` — 고객 사이트 iframe 안에서 도는 화면 |
| **대시보드** | `/dashboard` · `/dashboard/bots/:slug` · `/keys` · `/conversations` · `/stats` · `/kakao` · `/billing` · `/support` · `/guide` |
| **어드민** | `/admin/*` |

### 6.2 상태 관리

- **서버 상태는 TanStack Query v5** — 캐시·쿼리키·401 자동 갱신을 훅에 위임
- **인증 상태는 Context** — `AuthProvider`
- **로컬 UI 상태는 useState**
- 별도 클라이언트 상태 라이브러리는 쓰지 않습니다 — 서버 상태가 대부분입니다

### 6.3 디자인 시스템이 둘이다

`src/ui/`(대시보드·랜딩)와 `src/admin/component/ui/`(어드민)가 **분리돼 있습니다.**
어드민은 다크 테마가 없고 표·폼 밀도가 다릅니다. 어드민 컴포넌트를 대시보드에
그대로 가져오면 다크 모드에서 흰 판이 뜹니다 — 필요하면 토큰만 바꿔 `src/ui/`로
옮깁니다(`calendar.tsx` · `pagination.tsx`가 그렇게 옮겨온 것들입니다).

**버튼은 `pill`이 기본**이고, `ghost` 취소 버튼만 각진 모서리입니다.

### 6.4 위젯

`widget.js` 한 줄이 우측 하단 버블을 만들고, 클릭하면 `/embed/{slug}?mode=widget`을
**iframe으로** 띄웁니다. 채팅 호출이 iframe 내부(같은 origin)에서 일어나 CORS 문제가
없고, Shadow DOM으로 호스트 사이트 CSS와 격리됩니다.

### 6.5 `/embed`는 남의 사이트다

이 경로는 **고객 사이트 안에서 도는 화면**이라 우리 편의를 위한 것을 넣으면 남의
방문자에게 영향이 갑니다.

- **애널리틱스를 싣지 않습니다** — suppress가 아니라 `index.html`에서 스크립트 자체를
  안 받습니다. 그래야 고객 사이트에서 외부로 나가는 요청이 아예 안 생깁니다
- **과금 문구를 보내지 않습니다** — 플랜·한도로 막힐 때 상대는 봇 주인이 아니라
  그 사람의 고객입니다. 봇 주인이 써둔 fallback을 대신 내보내고 진짜 이유는 로그에만 남깁니다

---

## 7. 로컬 실행

### 요구 사항

- Python **3.12+** · [uv](https://docs.astral.sh/uv/)
- Node.js 20+
- MySQL 8

### 백엔드

```bash
cd backend
cp .env.example .env          # 값을 채운다
./migrate.sh                  # uv run alembic upgrade head
./run.sh                      # uv run uvicorn app.main:app --reload --port 8000
```

### 프론트엔드

```bash
cd chatbase
cp .env.example .env          # 값을 채운다
npm install
npm run dev                   # :3000
npm run build                 # vite build + prerender → dist/
npm run check:types           # tsc --noEmit
```

⚠️ `vite build`는 **tsc를 거치지 않습니다.** 타입 에러를 안고도 빌드가 통과하므로
`check:types`를 따로 돌립니다.

### 환경변수

`.env`는 커밋하지 않습니다. `.env.example`에 **키 이름만** 있으니 값을 채워서
쓰고, 새 키를 추가할 때 example에도 같이 넣습니다.

---

## 8. 대표 데이터 흐름

### 8.1 방문자가 위젯에서 질문한다

```
방문자 입력
   ↓
POST /api/chat/stream  (slug · visitor_id · lang)
   ↓
ChatService
   ├─ 봇 조회 (active 확인)
   ├─ 플랜 게이팅 — 월 한도 초과면 봇 주인의 fallback 으로 응답하고 종료
   ├─ 키 해석 — 서비스 키 / BYOK
   │     키가 없으면 LLM 을 아예 부르지 않고 fallback (주인에게는 llm_error 로 남김)
   ├─ 다국어 판정 (봇 설정 + 현재 플랜)
   └─ 시스템 프롬프트 조립 → LLM 스트리밍 (+ file_search)
        ↓
   SSE 로 청크 전송 → 프론트가 마크다운 렌더링
        ↓
[스트림 종료 후]
   ├─ 답변 저장 (OpenAI 출처 마커 제거 후)
   ├─ tb_usage_monthly 카운트 증가
   └─ session.lang 갱신
```

### 8.2 봇 주인이 파일을 학습시킨다

```
파일 선택 → 저장
   ↓
POST /api/bot  (multipart)
   ↓
BotService
   ├─ 플랜 + OpenAI 키 확인 (둘 다 있어야 함)
   ├─ OpenAI Vector Store 에 create_and_poll — 인덱싱 완료까지 대기 (실측 41초)
   └─ tb_bot_files 에 메타 저장
```

⚠️ 저장 버튼은 **업로드가 끝날 때까지 잡아둬야 합니다.** mutation의 `isPending`만
보면 그 구간에서 버튼이 되살아나고, 사용자가 끝난 줄 알고 새로고침해 업로드를
중단시킵니다.

### 8.3 카카오톡으로 문의가 온다

```
오픈빌더 → POST /api/kakao/skill/{slug}?secret=...
   ↓
시크릿 검증 (hash_key + slug HMAC)
   ↓
callbackUrl 있나?
   ├─ 있음 → 즉시 useCallback:true 반환 (29ms) → 백그라운드 LLM → callbackUrl 로 POST
   └─ 없음 → 4.3초 안에 동기 응답
        ↓
   마크다운 평문화 + 1000자 컷 (카카오는 마크다운 미지원)
```

실패해도 **항상 200 + simpleText**로 돌려줍니다. 4xx를 주면 오픈빌더가 원인을 감추고
기본 에러만 띄워서 사용자가 어디서 막혔는지 알 수 없습니다.

---

## 9. 설계 원칙

- **방문자에게 우리 사정을 보내지 않는다** — 플랜·한도·키 오류는 봇 주인의 문제지
  그 사람 고객의 문제가 아니다. 진짜 이유는 로그와 대시보드에만 남긴다
- **시스템이 사용자의 스위치를 만지지 않는다** — 키가 없다고 `bot.active`를 끄면
  "내가 켰는데 왜 꺼져 있지"가 되고 되돌릴 사람이 없다. 상태를 만들지 말고
  **호출 시점에 판정**한다
- **유료 기능은 쓰기와 실행 양쪽에서 막는다** — 쓰기만 막으면 결제 후 해지로 우회된다
- **확인할 수 없는 유료 기능은 끈다** — 판정 수단이 없으면 보수적으로 동작한다
- **숫자의 SOT는 한 곳** — 플랜 한도는 백엔드 `plan.py`와 프론트 `plan.ts`가
  일치해야 하고, 어긋나면 "가격표엔 3개인데 1개에서 막히는" 상태가 된다
- **캐시·상수는 무효화 전략과 세트로 설계한다**

---

## 10. 상태

개인 프로젝트입니다. 기획 문서와 환경변수는 저장소에 포함하지 않습니다.

라이선스를 별도로 명시하지 않았으므로 기본적으로 모든 권리를 보유합니다.
