# 데모 봇 — 봇마다 폴더 하나

DB를 다시 만들면 봇이 전부 사라진다(2026-09-12에 실제로 그랬고, 홍보 글의 데모 링크가
전부 404가 됐다). **여기 있는 파일이 원본이고 DB의 봇은 사본이다.** 사라지면 이대로 다시 만든다.

각 폴더에는 두 파일이 있다.

- `settings.md` — 이름·인사말·fallback·시스템 프롬프트·FAQ 버튼·만든 뒤 확인할 것
- `knowledge.txt` — 학습 텍스트. **그대로 복사**해 넣는다

| 폴더 | 봇 | 쓰는 곳 | 계정 | slug |
|---|---|---|---|---|
| [`landing/`](landing/settings.md) | chatbase.kr 안내봇 | 랜딩 우측 하단 버블 (`DEMO_BOT_SLUG`) | 운영자 계정 | `0rFgOK3XXZLMCF9p` |
| [`community/`](community/settings.md) | 햇살마을 공모사업 안내봇 | 업종 데모 — 공동체·공모사업 | `demo@chatbase.kr` | `_c-LEzEHY8gzabIV` |
| [`stay/`](stay/settings.md) | 한옥스테이 햇살채 | 업종 데모 — 숙소 · `/for/stay` | `demo@chatbase.kr` | `IYOewWCdKBs5J4L3` |
| [`academy/`](academy/settings.md) | 햇살수학영어학원 | 업종 데모 — 학원 · `/for/academy` | `demo@chatbase.kr` | `OUnU4V-DtDTNA2zW` |
| [`clinic/`](clinic/settings.md) | 햇살가정의학과의원 | 업종 데모 — 병원 · `/for/clinic` | `demo@chatbase.kr` | `kJd3qWNW6X7dW1rt` |
| [`shop/`](shop/settings.md) | 햇살리빙 고객센터 | 업종 데모 — 쇼핑몰 · `/for/shop` | `demo@chatbase.kr` | `mnZ_0kBhrud1SluM` |

2026-11-07 생성 (데모 계정 user_id 11, GLOBAL 무기한 관리자 지정). 봇을 다시 만들면 **slug 칸을 고치고**, 그 slug를 쓰는 곳(`OUTREACH.md`의 데모 링크,
`src/container/landing.tsx`)도 같이 고친다.

## 공통 규칙

- **랜딩 봇을 뺀 나머지는 전부 가상의 예시다.** 이름은 "햇살"로 통일했고, 연락처는
  `000-0000-0000` · `example@example.com`이다. 인사말 첫머리에서 예시라고 밝힌다.
  실재하는 단체·숙소·병원을 흉내 내지 않는다. 상호 "담쟁이"도 쓰지 않는다 —
  운영자가 숙소나 학원을 하는 것처럼 읽힌다.
- **실제 고객 봇의 자료를 옮기지 않는다.** 그 고객의 동의가 없다.
- **업종 데모는 `demo@chatbase.kr` 한 계정에 모은다.** 운영자 계정에 두면 데모 대화가
  운영자의 월 한도를 깎고, 봇 개수 상한(GLOBAL 5개)에 랜딩 봇까지 6개라 안 들어간다.
  이 계정은 어드민에서 **GLOBAL 무기한(관리자 지정)**으로 둔다 — 숙소봇 다국어가 GLOBAL 기능이다.
- **병원 봇은 진료 상담을 하지 않는다.** 증상·진단·약·검사 결과 질문은 거절하고 전화·내원을
  안내하도록 시스템 프롬프트에 박아 뒀다. 데모라도 증상에 답하는 화면이 캡처되면 그대로 돈다.
- 밖에 링크를 걸 때는 `?badge=1&utm_source=…` 를 단다 — 배지가 유입을 랜딩까지 이어 준다.
