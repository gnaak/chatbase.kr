"""문의 메일 본문. 지금은 평문만 만든다.

HTML 템플릿은 발송 인프라(TODO.md 2번)를 붙일 때 같이 넣는다 — 지금 만들어봐야
렌더링을 확인할 방법이 없고, 평문 본문은 어차피 HTML 메일의 fallback으로 그대로 쓴다.
"""

from app.module.inquiry.inquiry import CATEGORY_LABEL, Inquiry

FOOTER = """
--
chatbase.kr
https://chatbase.kr
"""


def _quote(content: str) -> str:
    """본문을 인용 형태로 들여쓴다. 메일에서 원문과 안내문을 구분하기 위한 것."""
    return "\n".join(f"  {line}" for line in content.strip().splitlines())


def received(inquiry: Inquiry, content: str, thread_url: str) -> tuple[str, str]:
    """문의자에게 보내는 접수 확인."""
    subject = f"[chatbase.kr] 문의가 접수되었습니다 — {inquiry.subject}"
    body = f"""{inquiry.name}님, 문의해 주셔서 감사합니다.

아래 내용으로 접수되었습니다. 확인 후 이 메일 주소로 답변드리겠습니다.

유형: {CATEGORY_LABEL.get(inquiry.category, "일반 문의")}
제목: {inquiry.subject}

{_quote(content)}

문의 내역은 아래 링크에서 확인하고 이어서 질문하실 수 있습니다.
{thread_url}
{FOOTER}"""
    return subject, body


def admin_alert(
    inquiry: Inquiry,
    content: str,
    admin_url: str,
    is_followup: bool = False,
) -> tuple[str, str]:
    """운영자에게 보내는 신규/추가 문의 알림."""
    kind = "추가 질문" if is_followup else "새 문의"
    subject = f"[chatbase.kr] {kind} #{inquiry.id} — {inquiry.subject}"
    account = f"회원 #{inquiry.user_id}" if inquiry.user_id else "비회원"
    body = f"""{kind}가 도착했습니다.

번호: #{inquiry.id}
유형: {CATEGORY_LABEL.get(inquiry.category, "일반 문의")}
작성자: {inquiry.name} <{inquiry.email}> ({account})
제목: {inquiry.subject}

{_quote(content)}

답변하기: {admin_url}
{FOOTER}"""
    return subject, body


def answered(inquiry: Inquiry, content: str, thread_url: str) -> tuple[str, str]:
    """문의자에게 보내는 답변 도착 알림."""
    subject = f"[chatbase.kr] 문의 답변이 도착했습니다 — {inquiry.subject}"
    body = f"""{inquiry.name}님, 문의하신 내용에 답변드립니다.

제목: {inquiry.subject}

{_quote(content)}

추가로 궁금한 점이 있으시면 아래 링크에서 바로 이어서 질문하실 수 있습니다.
{thread_url}
{FOOTER}"""
    return subject, body
