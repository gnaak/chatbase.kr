# chatbase.kr — CLAUDE.md

한 레포에 앱 셋.

```
backend/    FastAPI — 하나. 두 상품이 같이 쓴다
chatbase/   React — chatbase.kr (챗봇)      :3000
llm/        React — llm.chatbase.kr (AEO)   :3001
```

**상품이 둘이고 서로를 전제하지 않는다.** AEO만 쓰는 고객이 따로 있다.
계정·결제·어드민은 백엔드에서 공유하고, 구독은 `(user_id, product)`로 상품마다 따로 잡는다.

프론트 두 앱은 **코드도 `node_modules`도 공유하지 않는다.** 각자 완전히 독립이라
`npm install`도 `npm run dev`도 각 폴더에서 따로 한다.
대신 디자인 시스템·인증 훅이 양쪽에 복사돼 있으므로, 고칠 때 양쪽을 같이 본다.

세부 규칙은 `chatbase/CLAUDE.md`, `llm/CLAUDE.md`, `backend/CLAUDE.md` 참고.

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | React 19 + TypeScript + Vite + TanStack Query v5 + Tailwind CSS v3 |
| Backend | FastAPI + SQLAlchemy 2.0 (async) + MySQL 8 (asyncmy) + Redis + Alembic |
| 인프라 | AWS (RDS MySQL + ElastiCache Redis) |
| 인증 | JWT + OAuth (Google, Kakao) |

## 네이밍 규칙

| 대상 | 규칙 | 예시 |
|------|------|------|
| 컴포넌트 / 클래스 | PascalCase | `UserCard`, `AuthService` |
| 타입 / 인터페이스 | PascalCase | `UserInfo`, `BaseResponse<T>` |
| 함수 / 변수 / 훅 | camelCase | `handleSubmit`, `useAuth` |
| 이벤트 핸들러 | `handle` 접두사 | `handleClick` |
| 폴더명 | camelCase (소문자 시작) | `sideBar/`, `web_socket/` |
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
2. 매 Phase 완료 시 `PROGRESS.md` 업데이트. **커밋은 지시가 있을 때만.**
3. 테스트 통과 후 다음 Phase 진행.
4. 불확실하면 멈추고 질문.
5. 과도한 추상화 금지.
6. 빌드·린트·타입체크는 자유롭게 돌려도 된다. **상태를 바꾸는 것**(서버 기동 ·
   커밋 · DB 마이그레이션)만 지시를 받는다.

## Phase 관리

**시작 순서**: `PROJECT.md` 기능 정의 작성 → Claude가 Phase 계획 수립 → 사용자 승인 → Phase 1부터 개발

**Phase 양식**:
```markdown
## Phase N: [이름]
**목표**: ...
**수행 내용**: ...
**완료 기준**: - [ ] ...
**커밋 메시지(안)**: `N단계: [설명]` — 실제 커밋은 지시를 받고 한다
```

## agent-progress.md 형식

```markdown
## N 단계: [이름]
- 상태: ⬜ 대기 / 🔄 진행중 / ✅ 완료 / ❌ 실패
- 완료 시각:
- 수행 내용:
- 이슈/메모:
```

## 트러블슈팅

| 상황 | 대응 |
|------|------|
| 외부 API 키 없음 | mock 데이터로 fallback, 키 확보 후 교체 |
| 테스트 실패 | 원인 파악 후 수정. 우회 금지 |
| 불명확한 요구사항 | 추측 말고 질문 후 진행 |
| 예상치 못한 파일 발견 | 삭제 전 반드시 확인 요청 |
