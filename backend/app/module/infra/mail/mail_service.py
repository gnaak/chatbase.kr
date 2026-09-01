import asyncio
import logging
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr, parseaddr

from app.core.config.settings import settings

logger = logging.getLogger("app.infra.mail")

#: SMTP 왕복 타임아웃(초).
#:
#: **반드시 준다.** smtplib의 기본 타임아웃은 무한대다. 메일 서버가 연결만 받고
#: 응답을 안 주면 그 스레드가 영원히 잡히고, `to_thread`의 기본 executor는
#: 스레드 수가 제한돼 있어서 몇 건 쌓이면 다른 모든 `to_thread` 호출까지 멈춘다.
_SMTP_TIMEOUT = 15


class MailService:
    """메일 발송 단일 창구. SMTP.

    켜지는 조건은 **둘 다**다:
      1. `MAIL_ENABLED=true`
      2. `SMTP_HOST` 이하 접속 정보

    하나라도 비면 로그만 남기고 `False`를 돌려준다. 그래서 로컬에서는 아무것도
    설정하지 않아도 호출부가 그대로 돈다.

    ⚠️ **DNS(SPF·DKIM·DMARC)가 없으면 메일은 나가지만 전부 스팸함으로 간다.**
    그리고 그 실패는 로그에 성공(`[mail:sent]`)으로 찍혀서 원인을 못 찾는다.
    SMTP 정보를 넣기 전에 제공자에서 도메인 인증부터 끝낼 것 —
    `mail_from`의 도메인과 인증한 도메인이 같아야 한다.

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

    def _build(
        self,
        to: str,
        subject: str,
        body: str,
        reply_to: str | None,
    ) -> EmailMessage:
        """평문 메일 한 통을 조립한다.

        HTML을 쓰지 않는다. 거래 메일(문의 접수·답변 도착)은 평문이 스팸 판정에
        유리하고, 지금 `templates.py`도 평문이다. HTML이 필요해지면 여기에
        `add_alternative(..., subtype="html")`를 얹는 자리가 있다.
        """
        message = EmailMessage()

        # mail_from은 "chatbase.kr <hello@chatbase.kr>" 형태다. 그대로 넣으면
        # 한글 표시이름이 들어왔을 때 헤더 인코딩이 깨지므로 한 번 갈라서
        # formataddr에 맡긴다 — 얘가 필요할 때만 RFC 2047로 인코딩해 준다.
        name, addr = parseaddr(self.sender)
        message["From"] = formataddr((name, addr)) if name else addr
        message["To"] = to
        message["Subject"] = subject
        if reply_to:
            message["Reply-To"] = reply_to

        message.set_content(body)
        return message

    def _send_sync(self, message: EmailMessage) -> None:
        """블로킹 SMTP 전송. **반드시 `to_thread`로 감싸서 부른다.**

        실패하면 예외를 그대로 올린다 — `send()`가 받아서 삼키고 로그를 남긴다.
        """
        host = settings.smtp_host
        port = settings.smtp_port
        user = settings.smtp_user
        password = settings.smtp_password
        context = ssl.create_default_context()

        if port == 465:
            with smtplib.SMTP_SSL(
                host, port, context=context, timeout=_SMTP_TIMEOUT
            ) as smtp:
                if user:
                    smtp.login(user, password or "")
                smtp.send_message(message)
            return

        # 587(STARTTLS)과 그 밖의 포트. 평문으로 열고 TLS로 승격한다.
        with smtplib.SMTP(host, port, timeout=_SMTP_TIMEOUT) as smtp:
            smtp.ehlo()
            smtp.starttls(context=context)
            # STARTTLS 뒤에는 EHLO를 다시 해야 한다. 서버가 TLS 이후에야
            # AUTH 지원을 광고하는 경우가 있어서, 생략하면 로그인이 막힌다.
            smtp.ehlo()
            if user:
                smtp.login(user, password or "")
            smtp.send_message(message)

    async def _transport(
        self,
        to: str,
        subject: str,
        body: str,
        reply_to: str | None,
    ) -> bool:
        """실제 전송. SMTP — 제공자를 가리지 않는다.

        SES v2 API가 아니라 SMTP를 고른 이유는 **갈아탈 수 있어서**다.
        시작은 Resend(무료 3,000통/월, DNS 3개, 즉시)로 하고 물량이 늘면
        SES SMTP로 옮기는데, 그때 바꾸는 건 .env 네 줄뿐이다.
        """
        if not settings.smtp_host:
            logger.warning(
                "[mail:no-transport] MAIL_ENABLED=true 인데 SMTP_HOST가 없다. to=%s",
                to,
            )
            return False

        message = self._build(to, subject, body, reply_to)

        # ⚠️ smtplib는 블로킹이다. `to_thread` 없이 부르면 SMTP 왕복(수 초)
        # 동안 이벤트 루프가 통째로 멈춰서 그 사이 모든 요청이 대기한다.
        await asyncio.to_thread(self._send_sync, message)

        logger.info("[mail:sent] to=%s subject=%s", to, subject)
        return True
