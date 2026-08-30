"""유입 출처(UTM) 다루기.

가입 요청 바디로 넘어온 `utm_*`을 골라내 `tb_users`에 박는 데 쓴다.

**왜 저장하는가** — GA4는 "cafe_apsa에서 34명 방문"까지만 안다. 그중 누가 결제까지
갔는지는 우리 DB에만 있고, 둘을 잇는 값이 없으면 어느 카페가 돈이 됐는지 알 수 없다.

**왜 지금인가** — 가입하는 순간에만 알 수 있어서 소급이 안 된다. 나중에 붙이면
그전에 가입한 사람의 출처는 영영 모른다.

규칙과 값 예시는 `chatbase/SALES.md` §6.
"""

#: DB 컬럼과 1:1. 늘리려면 `tb_users` 마이그레이션도 같이 가야 한다.
UTM_FIELDS = ("utm_source", "utm_medium", "utm_campaign")

#: `tb_users.utm_*` 이 String(100)이다. 넘치면 DB가 던지므로 여기서 자른다.
#: 방문자가 주소창에 무엇을 넣든 우리 저장은 안 깨져야 한다.
_MAX_LEN = 100


def extract_utm(body: dict | None) -> dict | None:
    """요청 바디에서 `utm_*`만 골라낸다. 쓸 값이 없으면 None.

    바디는 클라이언트가 보낸 값이라 타입을 믿지 않는다 — 문자열이 아니거나
    공백뿐이면 버린다. 셋 다 없으면 None을 돌려주고, 호출부는 컬럼을 아예
    건드리지 않는다(직접 방문·검색 유입이 여기 해당한다).
    """
    if not isinstance(body, dict):
        return None

    picked = {}
    for field in UTM_FIELDS:
        value = body.get(field)
        if isinstance(value, str) and value.strip():
            picked[field] = value.strip()[:_MAX_LEN]

    # source 없이 medium·campaign만 오는 건 의미가 없다(집계 기준이 source다).
    return picked if picked.get("utm_source") else None


def utm_columns(utm: dict | None) -> dict:
    """`User(**...)`에 펼쳐 넣을 kwargs.

    utm이 없으면 **빈 dict**를 준다 — 컬럼을 명시하지 않으면 NULL로 남는다.
    None을 명시적으로 넣는 것과 결과는 같지만, 호출부에서 "안 건드린다"는
    의도가 더 분명해진다.
    """
    if not utm:
        return {}
    return {field: utm.get(field) for field in UTM_FIELDS}
