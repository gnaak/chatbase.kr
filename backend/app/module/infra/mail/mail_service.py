import logging

from app.core.config.settings import settings

logger = logging.getLogger("app.infra.mail")


class MailService:
    """메일 발송 단일 창구.

    ⚠️ **아직 실제로 보내지 않는다.** 발송 인프라(SES/SMTP + SPF·DKIM·DMARC DNS,
    SES 샌드박스 해제)가 `TODO.md` 2번에 남아 있다. 지금은 호출부를 전부 제자리에
    두고 로그만 남긴다 — 나중에 채울 곳은 `_transport()` 하나뿐이다.

    발송 실패는 절대 호출자를 깨지 않는다. 문의는 이미 DB에 저장된 뒤이고,
    메일이 안 갔다고 해서 접수 자체를 실패로 만들면 사용자가 같은 문의를
    반복해서 넣는다. 그래서 예외를 삼키고 bool만 돌려준다.
    """

    def __init__(self):
        self.enabled = settings.mail_enabled
        self.sender = settings.mail_from
        self.admin_to = settings.mail_admin_to

    async def send(
        self,
        to: str,
        subject: str,
        body: str,
        reply_to: str | None = None,
    ) -> bool:
        if not to:
            return False

        if not self.enabled:
            # 발송 인프라가 붙기 전까지 여기로 떨어진다. 무엇을 보내려 했는지는
            # 남겨야 운영 중에 "답변했는데 메일이 안 왔다"를 추적할 수 있다.
            logger.info("[mail:skipped] to=%s subject=%s", to, subject)
            logger.debug("[mail:skipped] body=\n%s", body)
            return False

        try:
            return await self._transport(to, subject, body, reply_to)
        except Exception:
            logger.error(
                "[mail:failed] to=%s subject=%s", to, subject, exc_info=True
            )
            return False

    async def send_to_admin(
        self,
        subject: str,
        body: str,
        reply_to: str | None = None,
    ) -> bool:
        """운영자(hello@chatbase.kr) 알림.

        reply_to에 문의자 주소를 넣어두면 메일함에서 바로 회신할 수 있다 —
        다만 그 회신은 우리 DB에 남지 않으므로, 스레드를 이어가려면 어드민
        화면에서 답변해야 한다.
        """
        return await self.send(self.admin_to, subject, body, reply_to)

    async def _transport(
        self,
        to: str,
        subject: str,
        body: str,
        reply_to: str | None,
    ) -> bool:
        """실제 전송. **여기만 채우면 발송이 켜진다.**

        SMTP라면 `smtplib.SMTP_SSL` + `email.message.EmailMessage`를
        `asyncio.to_thread()`로 감싸고, SES라면 httpx로 SES v2 API를 친다.
        어느 쪽이든 settings에 접속 정보 필드를 먼저 추가해야 한다.
        """
        logger.warning(
            "[mail:no-transport] MAIL_ENABLED=true 인데 발송 구현이 없다. to=%s", to
        )
        return False
