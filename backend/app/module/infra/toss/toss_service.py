"""토스페이먼츠 API 래핑.

자동결제(빌링) 경로만 사용한다:
  1. 프론트가 SDK로 카드를 등록하고 `authKey`를 받아온다.
  2. `issue_billing_key`로 authKey를 billingKey로 교환한다. (이 키로 앞으로 청구)
  3. `charge`로 billingKey를 써서 실제 금액을 청구한다.

인증은 시크릿 키를 쓰는 HTTP Basic이다 — `base64(secret + ":")`.
비밀번호가 빈 문자열이라 콜론을 빼먹으면 인증이 통과하지 않는다.
"""

import base64
import logging
from typing import Any, Optional

import httpx

from app.core.config.settings import settings

logger = logging.getLogger(__name__)

TOSS_API_BASE = "https://api.tosspayments.com/v1"
_TIMEOUT = 15


class TossError(Exception):
    """토스가 4xx/5xx로 돌려준 오류. `code`는 토스 문서의 에러 코드 그대로."""

    def __init__(self, code: str, message: str, status_code: int = 400):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


#: 결제위젯 전용 키 접두사. 우리가 쓰는 `payment().requestBillingAuth()`는
#: **API 개별 연동 키**(test_ck_/live_ck_)를 요구하고, 위젯 키를 넘기면 SDK가
#: "결제위젯 연동 키는 지원하지 않습니다"로 거부한다.
_WIDGET_KEY_PREFIXES = ("test_gck_", "live_gck_", "test_gsk_", "live_gsk_")


class TossService:
    @property
    def client_key(self) -> Optional[str]:
        """프론트 SDK 초기화용 공개 키. 노출돼도 되는 값이다."""
        key = settings.toss_client_key
        if key and key.startswith(_WIDGET_KEY_PREFIXES):
            logger.warning(
                "toss_api_client_key가 결제위젯 연동 키(%s...)입니다. "
                "자동결제(빌링)에는 API 개별 연동 키(test_ck_/live_ck_)가 필요합니다.",
                key[:12],
            )
        return key

    @property
    def secret_key(self) -> Optional[str]:
        return settings.toss_secret_key

    @property
    def configured(self) -> bool:
        return bool(self.secret_key)

    def _headers(self, idempotency_key: Optional[str] = None) -> dict:
        if not self.secret_key:
            raise TossError(
                "TOSS_NOT_CONFIGURED",
                "결제 설정이 완료되지 않았습니다. 관리자에게 문의해 주세요.",
                503,
            )
        if self.secret_key.startswith(_WIDGET_KEY_PREFIXES):
            # 위젯 시크릿 키로는 /v1/billing 호출이 NOT_FOUND_MERCHANT로 떨어진다.
            # 원인을 알 수 없는 토스 에러 대신 여기서 끊는다.
            raise TossError(
                "TOSS_WIDGET_KEY",
                "결제위젯 연동 키가 설정돼 있습니다. "
                "자동결제에는 API 개별 연동 키(test_sk_/live_sk_)가 필요합니다.",
                503,
            )
        token = base64.b64encode(f"{self.secret_key}:".encode()).decode()
        headers = {
            "Authorization": f"Basic {token}",
            "Content-Type": "application/json",
        }
        if idempotency_key:
            # 같은 키로 재요청하면 토스가 중복 청구 대신 원 결과를 돌려준다.
            headers["Idempotency-Key"] = idempotency_key
        return headers

    async def _post(
        self,
        path: str,
        payload: dict,
        idempotency_key: Optional[str] = None,
    ) -> dict[str, Any]:
        headers = self._headers(idempotency_key)
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.post(
                    f"{TOSS_API_BASE}{path}", json=payload, headers=headers
                )
        except httpx.TimeoutException as exc:
            raise TossError(
                "TOSS_TIMEOUT",
                "결제 서버 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.",
                504,
            ) from exc
        except httpx.HTTPError as exc:
            raise TossError(
                "TOSS_UNREACHABLE", "결제 서버에 연결할 수 없습니다.", 502
            ) from exc

        body = resp.json() if resp.content else {}
        if resp.status_code >= 400:
            code = body.get("code", "TOSS_ERROR")
            message = body.get("message", "결제 처리에 실패했습니다.")
            logger.warning(
                "toss error path=%s status=%s code=%s message=%s",
                path,
                resp.status_code,
                code,
                message,
            )
            raise TossError(code, message, resp.status_code)
        return body

    # ── 빌링(자동결제) ──────────────────────────────
    async def issue_billing_key(self, auth_key: str, customer_key: str) -> dict:
        """카드 등록으로 받은 authKey를 billingKey로 교환한다.

        응답에 billingKey와 카드 메타(발급사·마스킹 번호)가 함께 온다.
        """
        return await self._post(
            "/billing/authorizations/issue",
            {"authKey": auth_key, "customerKey": customer_key},
        )

    async def charge(
        self,
        billing_key: str,
        customer_key: str,
        amount: int,
        order_id: str,
        order_name: str,
        customer_email: Optional[str] = None,
        customer_name: Optional[str] = None,
    ) -> dict:
        """billingKey로 즉시 청구한다. order_id를 멱등키로 써서 중복 청구를 막는다."""
        payload: dict[str, Any] = {
            "customerKey": customer_key,
            "amount": amount,
            "orderId": order_id,
            "orderName": order_name,
        }
        if customer_email:
            payload["customerEmail"] = customer_email
        if customer_name:
            payload["customerName"] = customer_name

        return await self._post(
            f"/billing/{billing_key}", payload, idempotency_key=order_id
        )

    async def cancel_payment(self, payment_key: str, reason: str) -> dict:
        return await self._post(
            f"/payments/{payment_key}/cancel", {"cancelReason": reason}
        )
