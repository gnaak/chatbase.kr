# Backend — CLAUDE.md

FastAPI + SQLAlchemy 2.0 (async) + MySQL 8 (asyncmy) + Redis + Alembic

## 폴더 구조

```
app/
├── main.py
├── core/
│   ├── config/settings.py          환경변수 (hostname으로 local/prod 자동 감지)
│   ├── database/                   base.py(+ now_kst) · redis.py
│   ├── exception/handler.py        전역 예외 핸들러
│   ├── logging/                    app.log · access.log · error.log
│   ├── middleware/                 cors · register · secure_headers · rate limit
│   ├── provider/http/              endpoint.py · login.py · service.py
│   └── utils/                      response.py · plan.py · utm.py · crypto ...
└── module/
    ├── __init__.py                 setup_routers() + 모델 등록
    ├── admin/ auth/ user/
    ├── api_key/ bot/ chat/ usage/ payment/
    ├── kakao_skill/ llm_model/ stats/ inquiry/ llm_error/
    └── infra/                      anthropic gemini google kakao
                                    llm mail openai toss
```

## 도메인 모듈 — 4파일 세트

```
module/[domain]/
├── [domain].py             # SQLAlchemy 모델
├── [domain]_repository.py  # DB 쿼리만 (비즈니스 로직 없음)
├── [domain]_service.py     # 비즈니스 로직
└── [domain]_router.py      # HTTP 엔드포인트
```

**세트가 다 안 차는 모듈이 있고, 그게 정상이다:**

- `stats/` — **모델이 없다.** 남의 테이블을 집계할 뿐 자기 테이블이 없다
- `llm_error/` — **라우터가 없다.** 기록은 `chat`·`kakao_skill`이 하고 조회는 `stats`가 한다
- `infra/*` — **service만 있다.** 외부 API 래핑이라 모델도 라우터도 없다

새 모듈 추가 시 `module/__init__.py`에서:
1. 모델 import (`from app.module.x.x import XModel`) — `Base.metadata` 등록용
2. `setup_routers()`에 `app.include_router(x_router.router, prefix="/api/x")`

> `alembic/env.py`는 `import app.module` 한 줄로 모든 모델을 자동 감지한다. **별도 수정 불필요.**

## 라우터 목록

| 모듈 | prefix | 역할 |
|------|--------|------|
| `auth` | `/api/auth` | 이메일 로그인 + Google/Kakao OAuth, JWT |
| `user` | `/api/user` | 내 정보, 탈퇴 |
| `bot` | `/api/bot` | 챗봇 CRUD, 파일 업로드/삭제, FAQ, 번역 |
| `api_key` | `/api/api-key` | BYOK 키 등록·검증 (Fernet 암호화) |
| `chat` | `/api/chat` | 위젯 대화(SSE 스트리밍), 미리보기, 대화 로그 |
| `kakao_skill` | `/api/kakao` | 오픈빌더 스킬 서버 + 연결 정보 |
| `llm_model` | `/api/model` | 모델 카탈로그 (DB가 SOT) |
| `usage` | `/api/usage` | 월 사용량, 플랜 게이팅 값 |
| `payment` | `/api/payment` | 토스 빌링키, 구독, 결제 이력 |
| `stats` | `/api/stats` | 대화 집계 · 주제 묶기 · LLM 오류 |
| `inquiry` | `/api/inquiry` | 1:1 문의 (회원 · 비회원 토큰) |
| `admin` | `/api/admin` | 운영자 화면 |

## infra 모듈 — service만

| 모듈 | 역할 |
|------|------|
| `infra/llm/` | 3사 공통 진입점 · `strip_citations()` · `translate_service`(FAQ·인사말 번역) |
| `infra/openai/` | Responses API · 벡터 스토어(`file_search`) · 스트리밍 |
| `infra/anthropic/` | Anthropic SDK 래핑 · 스트리밍 |
| `infra/gemini/` | Google Gemini |
| `infra/toss/` | 토스페이먼츠 빌링키 발급·청구 |
| `infra/kakao/` `infra/google/` | OAuth 호출 |
| `infra/mail/` | 메일 단일 창구. **`_transport()`가 비어 있다** — 아직 안 나간다 |

## 라우터 패턴

```python
from app.core.provider.http.endpoint import with_provider
from app.core.provider.http.login import with_login
from app.core.utils.response import success, fail

@router.post("/example")
@with_provider                          # 로그인 불필요
async def example(p: ServiceProvider):
    result = await p.example_service.do_something(p.request)
    return success(result)

@router.get("/me")
@with_login                             # 로그인 필요, p.user 사용 가능
async def get_me(p: ServiceProvider):
    return success(p.user)
```

응답: `success(data)` → `{success:true, data}` / `fail("msg")` → `{success:false, message}`

`fail()`은 **던진다.** 호출한 줄에서 실행이 끊기므로 뒤에 `return`을 붙이지 않는다.

## ServiceProvider — lazy-load 프로퍼티

`core/provider/http/service.py`에 추가:
```python
@property
def my_service(self):
    if not self._my_service:
        from app.module.my_domain.my_service import MyService
        self._my_service = MyService(self.my_repository)
    return self._my_service
```

## Repository 패턴

```python
class ExampleRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def find_by_id(self, id: int) -> Example | None:
        result = await self.db.execute(select(Example).where(Example.id == id))
        return result.scalar_one_or_none()
```

## 환경 · 배포

환경 판별은 **hostname**으로 한다 — `settings.py`의 `_detect_env()`가 `ip-` 또는
`ec2-`로 시작하면 `prod`. `.env`의 키가 `LOCAL_*` / `PROD_*` 접두사로 갈린다.

```bash
cd ~/backend && git pull
./migrate.sh                      # = uv run alembic upgrade head
sudo systemctl restart fastapi.service
```

로그: `~/backend/logs/` — `app.log`(전체) · `access.log`(2xx3xx) · `error.log`(4xx5xx+ERROR)

⚠️ `*.sh`가 `100644`로 커밋되면 서버에서 `Permission denied`가 난다.
`git update-index --chmod=+x`로 박아두지 않으면 pull마다 반복된다.

## 시간 — 이미 두 번 걸렸다

`now_kst()`는 tz-aware인데 **DB에서 읽은 DATETIME은 naive다.** 둘을 비교하거나
빼면 `TypeError: can't compare offset-naive and offset-aware datetimes`가 난다.

저장할 때 KST 벽시계 값을 넣었으므로 비교 기준도 **같은 벽시계의 naive**로 맞춘다:

```python
since = (now_kst() - timedelta(days=days)).replace(tzinfo=None)
```

읽은 값에 tz를 붙이는 방향도 있다(`kakao_skill_service._is_expired`가 그 방식).
어느 쪽이든 **한 요청 안에서는 하나로 통일**할 것.

## 마이그레이션

`alembic/versions/*.py`는 **git으로 추적한다.** 한때 `.gitignore`에 있었고, 그때는
서버에 파일이 안 가서 `alembic upgrade head`가 **아무것도 안 하면서 성공**했다.
스키마만 조용히 뒤처졌다. 마이그레이션은 산출물이 아니라 소스코드다.

⚠️ 새 컬럼에 `NOT NULL`을 걸 때는 `server_default`를 준다. 앱의 `default=`는
파이썬 레벨이라 **이미 있는 행에는 적용되지 않아** 제약에 걸린다.

**파일 작성까지만 하고 적용은 사용자가 한다.**
