import logging
import secrets
from datetime import datetime, timedelta

from fastapi import HTTPException

from app.core.config.settings import settings
from app.core.database.base import now_kst
from app.core.utils.response import fail, success
from app.module.auth.auth_token import AuthToken
from app.module.infra.mail import templates
from app.module.infra.mail.mail_service import MailService
from app.module.inquiry.inquiry import (
    Inquiry,
    InquiryCategory,
    InquiryMessage,
    InquirySender,
    InquiryStatus,
)
from app.module.inquiry.inquiry_repository import InquiryRepository
from app.module.user.user_repository import UserRepository

logger = logging.getLogger("app.inquiry")

SUBJECT_MAX = 200
CONTENT_MAX = 5000
NAME_MAX = 50
EMAIL_MAX = 100
#: 저장은 정규화된 값(숫자와 선행 +)이라 20자면 국제번호까지 들어간다.
#: 입력은 하이픈·공백이 섞여 들어오므로 자르기 전 길이를 넉넉히 잡는다.
PHONE_MAX = 20
PHONE_INPUT_MAX = 32

#: 같은 IP에서 1시간에 받을 문의 수. 공개 엔드포인트라 상한이 없으면 봇이 테이블을 채운다.
#: Redis가 없어서 DB COUNT로 센다 — ix_inquiry_ip_created 인덱스가 받쳐준다.
RATE_LIMIT_PER_HOUR = 5

LIST_LIMIT_DEFAULT = 50
LIST_LIMIT_MAX = 200


def _iso(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None


def _enum_value(raw) -> str | None:
    if raw is None:
        return None
    return raw.value if hasattr(raw, "value") else str(raw)


def _client_ip(request) -> str | None:
    """nginx 뒤에 있으므로 X-Forwarded-For의 첫 값이 실제 클라이언트다."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()[:45] or None
    return request.client.host[:45] if request.client else None


def _text(body: dict, key: str, limit: int) -> str:
    return str(body.get(key) or "").strip()[:limit]


def _normalize_phone(value: str) -> str:
    """하이픈·공백·괄호를 걷어내고 숫자(와 선행 +)만 남긴다.

    운영자가 화면에서 복사해 문자 앱에 붙여넣는 값이다. 표기가 제각각이면
    붙여넣을 때마다 손을 봐야 하므로 저장 시점에 한 번 정리해 둔다.
    """
    if not value:
        return ""
    plus = value.lstrip().startswith("+")
    digits = "".join(ch for ch in value if ch.isdigit())
    return ("+" + digits if plus else digits)[:PHONE_MAX]


def _looks_like_phone(value: str) -> bool:
    """국번 체계를 판정하지 않는다. 오타가 아니라 '번호가 아닌 것'만 거른다."""
    digits = value.lstrip("+")
    return digits.isdigit() and 9 <= len(digits) <= 15


def _looks_like_email(value: str) -> bool:
    """정규식으로 RFC를 흉내내지 않는다. 오타를 잡는 게 아니라 빈 값·형식 붕괴만 막는다."""
    if "@" not in value or " " in value:
        return False
    local, _, domain = value.partition("@")
    return bool(local) and "." in domain and not domain.startswith(".")


class InquiryService:
    def __init__(
        self,
        inquiry_repo: InquiryRepository,
        user_repo: UserRepository,
        mail_service: MailService,
    ):
        self.repo = inquiry_repo
        self.user_repo = user_repo
        self.mail = mail_service

    # ── 직렬화 ────────────────────────────────
    def _thread_url(self, inquiry: Inquiry) -> str:
        return f"{settings.app_url}/support/{inquiry.access_token}"

    def _admin_url(self, inquiry: Inquiry) -> str:
        return f"{settings.app_url}/admin/inquiries?id={inquiry.id}"

    def _message_dict(self, message: InquiryMessage) -> dict:
        return {
            "id": message.id,
            "sender": _enum_value(message.sender),
            "content": message.content,
            "created_at": _iso(message.created_at),
        }

    def _inquiry_dict(self, inquiry: Inquiry, include_email: bool = False) -> dict:
        data = {
            "id": inquiry.id,
            "subject": inquiry.subject,
            "category": _enum_value(inquiry.category),
            "status": _enum_value(inquiry.status),
            "name": inquiry.name,
            "user_id": inquiry.user_id,
            "answered_at": _iso(inquiry.answered_at),
            "created_at": _iso(inquiry.created_at),
            "updated_at": _iso(inquiry.updated_at),
        }
        # 이메일은 어드민 화면에만 내려보낸다. 토큰 링크는 URL만 알면 열리므로
        # 공개 응답에 주소를 실으면 토큰이 새는 순간 주소까지 같이 샌다.
        if include_email:
            data["email"] = inquiry.email
            data["phone"] = inquiry.phone
            data["ip"] = inquiry.ip
        return data

    async def _thread_response(
        self, inquiry: Inquiry, include_email: bool = False
    ) -> dict:
        messages = await self.repo.find_messages(inquiry.id)
        return {
            **self._inquiry_dict(inquiry, include_email),
            "messages": [self._message_dict(m) for m in messages],
        }

    # ── 로그인 여부 확인 (선택) ─────────────────
    async def _optional_user(self, request):
        """쿠키가 있으면 회원으로, 없으면 비회원으로 처리한다.

        공개 문의 엔드포인트는 `@without_login`이라 토큰을 파싱하지 않는다.
        그런데 로그인한 사용자가 랜딩에서 문의하면 대시보드에서도 보여야 하므로,
        여기서 한 번 더 직접 확인한다. 실패는 그냥 '비회원'이다.
        """
        try:
            user_id, _ = await AuthToken().get_token_info(request, "user")
        except HTTPException:
            return None
        except Exception:
            logger.warning("문의 작성자 토큰 확인 실패", exc_info=True)
            return None
        return await self.user_repo.get_user_by_id(user_id)

    # ── 공개: 문의 생성 ────────────────────────
    async def create(self, request):
        body = await request.json()

        user = await self._optional_user(request)

        name = _text(body, "name", NAME_MAX) or (user.name if user else "")
        email = _text(body, "email", EMAIL_MAX).lower() or (
            user.email if user else ""
        )
        phone = _normalize_phone(_text(body, "phone", PHONE_INPUT_MAX))
        subject = _text(body, "subject", SUBJECT_MAX)
        content = _text(body, "content", CONTENT_MAX)

        if not name:
            fail("이름을 입력해 주세요.", "INQUIRY_NAME_REQUIRED")
        if email and not _looks_like_email(email):
            fail("이메일 주소를 정확히 입력해 주세요.", "INQUIRY_EMAIL_INVALID")
        if phone and not _looks_like_phone(phone):
            fail("연락처를 정확히 입력해 주세요.", "INQUIRY_PHONE_INVALID")
        # 둘 중 하나만 있으면 된다. 전화번호만 남기면 자동 알림은 못 가고
        # 운영자가 직접 문자로 답하게 된다 — 그건 화면에서 안내한다.
        if not email and not phone:
            fail(
                "답변받을 이메일 또는 연락처 중 하나는 입력해 주세요.",
                "INQUIRY_CONTACT_REQUIRED",
            )
        if not subject:
            fail("제목을 입력해 주세요.", "INQUIRY_SUBJECT_REQUIRED")
        if not content:
            fail("문의 내용을 입력해 주세요.", "INQUIRY_CONTENT_REQUIRED")

        try:
            category = InquiryCategory(body.get("category") or "general")
        except ValueError:
            category = InquiryCategory.GENERAL

        ip = _client_ip(request)
        if ip:
            since = (now_kst() - timedelta(hours=1)).replace(tzinfo=None)
            recent = await self.repo.count_recent_by_ip(ip, since)
            if recent >= RATE_LIMIT_PER_HOUR:
                fail(
                    "문의가 너무 많이 접수되었습니다. 잠시 후 다시 시도해 주세요.",
                    "INQUIRY_RATE_LIMITED",
                    429,
                )

        inquiry = Inquiry(
            user_id=user.id if user else None,
            name=name,
            email=email or None,
            phone=phone or None,
            category=category,
            subject=subject,
            status=InquiryStatus.OPEN,
            # 32바이트 난수 → 43자. 링크 하나가 스레드 열쇠라 추측 가능하면 안 된다.
            access_token=secrets.token_urlsafe(32),
            ip=ip,
        )
        self.repo.add_inquiry(inquiry)
        # 메시지가 inquiry_id를 참조하므로 id부터 확보한다.
        await self.repo.db.flush()
        self.repo.add_message(inquiry.id, InquirySender.USER, content)
        await self.repo.db.commit()
        await self.repo.db.refresh(inquiry)

        await self._notify_created(inquiry, content)

        return success(
            {
                **self._inquiry_dict(inquiry),
                "access_token": inquiry.access_token,
                "thread_url": self._thread_url(inquiry),
            },
            "문의가 접수되었습니다.",
        )

    # ── 공개: 토큰으로 스레드 열람 / 재질문 ──────
    async def get_by_token(self, request):
        inquiry = await self._token_inquiry(request)
        return success(await self._thread_response(inquiry))

    async def add_message_by_token(self, request):
        inquiry = await self._token_inquiry(request)
        return await self._append_user_message(request, inquiry)

    async def _token_inquiry(self, request) -> Inquiry:
        token = str(request.path_params.get("token") or "")
        inquiry = await self.repo.find_by_token(token)
        if not inquiry:
            fail("문의를 찾을 수 없습니다.", "INQUIRY_NOT_FOUND", 404)
        return inquiry

    # ── 로그인 사용자 ──────────────────────────
    async def list_mine(self, request):
        inquiries = await self.repo.find_by_user(request.user_id)
        stats = await self.repo.message_stats([i.id for i in inquiries])
        data = []
        for inquiry in inquiries:
            stat = stats.get(inquiry.id) or {}
            last = stat.get("last")
            data.append(
                {
                    **self._inquiry_dict(inquiry),
                    "message_count": stat.get("count", 0),
                    "last_sender": _enum_value(last.sender) if last else None,
                    "last_message_at": _iso(last.created_at) if last else None,
                }
            )
        return success(data)

    async def get_mine(self, request):
        inquiry = await self._owned_inquiry(request)
        return success(await self._thread_response(inquiry))

    async def add_message_mine(self, request):
        inquiry = await self._owned_inquiry(request)
        return await self._append_user_message(request, inquiry)

    async def _owned_inquiry(self, request) -> Inquiry:
        inquiry_id = int(request.path_params.get("id"))
        inquiry = await self.repo.find_by_id(inquiry_id)
        # 남의 문의인지 없는 문의인지 구분해서 알려주지 않는다 — 번호를 훑어
        # 존재 여부를 알아내는 것을 막는다.
        if not inquiry or inquiry.user_id != request.user_id:
            fail("문의를 찾을 수 없습니다.", "INQUIRY_NOT_FOUND", 404)
        return inquiry

    async def _append_user_message(self, request, inquiry: Inquiry):
        if inquiry.status == InquiryStatus.CLOSED:
            fail(
                "종료된 문의입니다. 새 문의로 등록해 주세요.",
                "INQUIRY_CLOSED",
                409,
            )

        body = await request.json()
        content = _text(body, "content", CONTENT_MAX)
        if not content:
            fail("문의 내용을 입력해 주세요.", "INQUIRY_CONTENT_REQUIRED")

        self.repo.add_message(inquiry.id, InquirySender.USER, content)
        # 사용자가 다시 물었으니 다시 '답변 대기'다.
        inquiry.status = InquiryStatus.OPEN
        # 헤더 컬럼이 안 바뀌면 onupdate가 돌지 않는다. 목록 정렬이 이 값이라 직접 올린다.
        inquiry.updated_at = now_kst()
        await self.repo.db.commit()

        await self._notify_admin(inquiry, content, is_followup=True)

        return success(await self._thread_response(inquiry), "문의가 등록되었습니다.")

    # ── 어드민 ────────────────────────────────
    async def admin_list(self, request):
        params = request.query_params

        status = None
        raw_status = params.get("status")
        if raw_status and raw_status != "all":
            try:
                status = InquiryStatus(raw_status)
            except ValueError:
                fail(f"알 수 없는 상태: {raw_status}", "INQUIRY_INVALID_STATUS")

        try:
            limit = min(int(params.get("limit") or LIST_LIMIT_DEFAULT), LIST_LIMIT_MAX)
            offset = max(int(params.get("offset") or 0), 0)
        except ValueError:
            fail("limit/offset이 올바르지 않습니다.", "INVALID_PAGINATION")

        keyword = (params.get("q") or "").strip() or None

        inquiries, total = await self.repo.admin_list(status, keyword, limit, offset)
        stats = await self.repo.message_stats([i.id for i in inquiries])

        items = []
        for inquiry in inquiries:
            stat = stats.get(inquiry.id) or {}
            last = stat.get("last")
            items.append(
                {
                    **self._inquiry_dict(inquiry, include_email=True),
                    "message_count": stat.get("count", 0),
                    "last_sender": _enum_value(last.sender) if last else None,
                    "last_message_at": _iso(last.created_at) if last else None,
                    # 목록에서 내용을 짐작할 수 있게 앞부분만.
                    "preview": (last.content[:120] if last else ""),
                }
            )

        return success(
            {
                "items": items,
                "total": total,
                "limit": limit,
                "offset": offset,
                "counts": await self.repo.count_by_status(),
            }
        )

    async def admin_detail(self, request):
        inquiry = await self._require_inquiry(request)
        return success(await self._thread_response(inquiry, include_email=True))

    async def admin_reply(self, request):
        inquiry = await self._require_inquiry(request)

        body = await request.json()
        content = _text(body, "content", CONTENT_MAX)
        if not content:
            fail("답변 내용을 입력해 주세요.", "INQUIRY_CONTENT_REQUIRED")

        self.repo.add_message(
            inquiry.id,
            InquirySender.ADMIN,
            content,
            admin_id=request.user_id,
        )
        # 답변과 동시에 종료하고 싶을 때가 많다(단순 안내 문의). 한 번에 처리한다.
        inquiry.status = (
            InquiryStatus.CLOSED if body.get("close") else InquiryStatus.ANSWERED
        )
        inquiry.answered_at = now_kst()
        inquiry.updated_at = now_kst()
        await self.repo.db.commit()

        subject, mail_body = templates.answered(
            inquiry, content, self._thread_url(inquiry)
        )
        sent = await self.mail.send(inquiry.email, subject, mail_body)

        return success(
            {
                **(await self._thread_response(inquiry, include_email=True)),
                # 메일이 실제로 나갔는지 화면에서 알려준다 — 발송 인프라가 붙기
                # 전까지는 항상 false다. 관리자가 "보냈겠지"라고 착각하면 안 된다.
                "mail_sent": sent,
            },
            "답변을 등록했습니다.",
        )

    async def admin_update_status(self, request):
        inquiry = await self._require_inquiry(request)

        body = await request.json()
        raw_status = body.get("status")
        try:
            status = InquiryStatus(raw_status)
        except ValueError:
            fail(f"알 수 없는 상태: {raw_status}", "INQUIRY_INVALID_STATUS")

        inquiry.status = status
        inquiry.updated_at = now_kst()
        await self.repo.db.commit()

        return success(self._inquiry_dict(inquiry, include_email=True))

    async def _require_inquiry(self, request) -> Inquiry:
        inquiry_id = int(request.path_params.get("id"))
        inquiry = await self.repo.find_by_id(inquiry_id)
        if not inquiry:
            fail("문의를 찾을 수 없습니다.", "INQUIRY_NOT_FOUND", 404)
        return inquiry

    # ── 메일 발송 (실패해도 요청은 성공) ─────────
    async def _notify_created(self, inquiry: Inquiry, content: str) -> None:
        subject, body = templates.received(
            inquiry, content, self._thread_url(inquiry)
        )
        await self.mail.send(inquiry.email, subject, body)
        await self._notify_admin(inquiry, content)

    async def _notify_admin(
        self, inquiry: Inquiry, content: str, is_followup: bool = False
    ) -> None:
        subject, body = templates.admin_alert(
            inquiry, content, self._admin_url(inquiry), is_followup
        )
        await self.mail.send_to_admin(subject, body, reply_to=inquiry.email)
