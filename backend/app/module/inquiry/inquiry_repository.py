from datetime import datetime

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.module.inquiry.inquiry import (
    Inquiry,
    InquiryMessage,
    InquirySender,
    InquiryStatus,
)


class InquiryRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── 조회 ──────────────────────────────────
    async def find_by_id(self, inquiry_id: int) -> Inquiry | None:
        result = await self.db.execute(
            select(Inquiry).where(Inquiry.id == inquiry_id)
        )
        return result.scalar_one_or_none()

    async def find_by_token(self, token: str) -> Inquiry | None:
        result = await self.db.execute(
            select(Inquiry).where(Inquiry.access_token == token)
        )
        return result.scalar_one_or_none()

    async def find_by_user(self, user_id: int) -> list[Inquiry]:
        result = await self.db.execute(
            select(Inquiry)
            .where(Inquiry.user_id == user_id)
            .order_by(Inquiry.updated_at.desc(), Inquiry.id.desc())
        )
        return list(result.scalars().all())

    async def find_messages(self, inquiry_id: int) -> list[InquiryMessage]:
        # created_at은 초 단위라 같은 초에 들어온 두 글의 순서가 뒤집힌다.
        # id는 단조 증가라 항상 쓴 순서대로 나온다.
        result = await self.db.execute(
            select(InquiryMessage)
            .where(InquiryMessage.inquiry_id == inquiry_id)
            .order_by(InquiryMessage.id.asc())
        )
        return list(result.scalars().all())

    async def count_recent_by_ip(self, ip: str, since: datetime) -> int:
        result = await self.db.execute(
            select(func.count(Inquiry.id)).where(
                Inquiry.ip == ip, Inquiry.created_at >= since
            )
        )
        return int(result.scalar() or 0)

    # ── 어드민 목록 ────────────────────────────
    async def admin_list(
        self,
        status: InquiryStatus | None = None,
        keyword: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[Inquiry], int]:
        conditions = []
        if status:
            conditions.append(Inquiry.status == status)
        if keyword:
            like = f"%{keyword}%"
            targets = [
                Inquiry.subject.like(like),
                Inquiry.name.like(like),
                Inquiry.email.like(like),
            ]
            # 저장된 전화번호는 숫자만이라 "010-1234"로는 안 걸린다. 검색어에서도
            # 구분자를 걷어내고 비교하되, 숫자가 없으면 조건을 붙이지 않는다.
            digits = "".join(ch for ch in keyword if ch.isdigit())
            if digits:
                targets.append(Inquiry.phone.like(f"%{digits}%"))
            conditions.append(or_(*targets))

        base = select(Inquiry)
        if conditions:
            base = base.where(*conditions)

        total = await self.db.execute(
            select(func.count()).select_from(base.subquery())
        )

        rows = await self.db.execute(
            base.order_by(Inquiry.updated_at.desc(), Inquiry.id.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(rows.scalars().all()), int(total.scalar() or 0)

    async def count_by_status(self) -> dict[str, int]:
        rows = await self.db.execute(
            select(Inquiry.status, func.count(Inquiry.id)).group_by(Inquiry.status)
        )
        counts = {s.value: 0 for s in InquiryStatus}
        for status, count in rows.all():
            key = status.value if hasattr(status, "value") else str(status)
            counts[key] = int(count)
        return counts

    async def message_stats(
        self, inquiry_ids: list[int]
    ) -> dict[int, dict]:
        """목록 화면용 요약: 스레드별 글 수 + 마지막 글.

        목록의 각 행마다 스레드를 통째로 읽으면 N+1이 된다. 두 번의 집계 쿼리로
        끝낸다 — 개수 한 번, 마지막 글 한 번.
        """
        if not inquiry_ids:
            return {}

        count_rows = await self.db.execute(
            select(InquiryMessage.inquiry_id, func.count(InquiryMessage.id))
            .where(InquiryMessage.inquiry_id.in_(inquiry_ids))
            .group_by(InquiryMessage.inquiry_id)
        )
        stats: dict[int, dict] = {
            iid: {"count": 0, "last": None} for iid in inquiry_ids
        }
        for iid, count in count_rows.all():
            stats[iid]["count"] = int(count)

        last_ids = await self.db.execute(
            select(func.max(InquiryMessage.id))
            .where(InquiryMessage.inquiry_id.in_(inquiry_ids))
            .group_by(InquiryMessage.inquiry_id)
        )
        ids = [row[0] for row in last_ids.all() if row[0] is not None]
        if ids:
            last_rows = await self.db.execute(
                select(InquiryMessage).where(InquiryMessage.id.in_(ids))
            )
            for msg in last_rows.scalars().all():
                stats[msg.inquiry_id]["last"] = msg

        return stats

    # ── 쓰기 ──────────────────────────────────
    def add_inquiry(self, inquiry: Inquiry) -> Inquiry:
        self.db.add(inquiry)
        return inquiry

    def add_message(
        self,
        inquiry_id: int,
        sender: InquirySender,
        content: str,
        admin_id: int | None = None,
    ) -> InquiryMessage:
        message = InquiryMessage(
            inquiry_id=inquiry_id,
            sender=sender,
            content=content,
            admin_id=admin_id,
        )
        self.db.add(message)
        return message
