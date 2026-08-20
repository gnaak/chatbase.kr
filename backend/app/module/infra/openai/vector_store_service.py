from typing import List

from openai import AsyncOpenAI
from starlette.datastructures import UploadFile


class VectorStoreService:
    """OpenAI 벡터 스토어 CRUD. BYOK — 메서드마다 사용자 api_key를 인자로 받음."""

    def _client(self, api_key: str) -> AsyncOpenAI:
        return AsyncOpenAI(api_key=api_key)

    async def create_vector_store(self, api_key: str, label: str) -> str:
        """봇 단위로 vector store를 만들고 id를 반환."""
        client = self._client(api_key)
        store = await client.vector_stores.create(name=f"chatbase_{label}")
        return store.id

    async def add_files(
        self,
        api_key: str,
        vector_store_id: str,
        files: List[UploadFile],
    ) -> list[dict]:
        """여러 파일을 OpenAI에 업로드하고 vector store에 attach.

        반환: [{"filename", "openai_file_id", "size", "mime_type"}, ...]
        """
        client = self._client(api_key)
        records: list[dict] = []
        for f in files:
            data = await f.read()
            uploaded = await client.files.create(
                file=(f.filename, data),
                purpose="assistants",
            )
            records.append(
                {
                    "filename": f.filename or "",
                    "openai_file_id": uploaded.id,
                    "size": len(data),
                    "mime_type": f.content_type or "application/octet-stream",
                }
            )

        if records:
            await client.vector_stores.file_batches.create_and_poll(
                vector_store_id=vector_store_id,
                file_ids=[r["openai_file_id"] for r in records],
            )
        return records

    async def remove_file(
        self,
        api_key: str,
        vector_store_id: str,
        openai_file_id: str,
    ) -> None:
        """vector store에서 detach 후 OpenAI 파일 자체 삭제. best-effort."""
        client = self._client(api_key)
        try:
            await client.vector_stores.files.delete(
                vector_store_id=vector_store_id,
                file_id=openai_file_id,
            )
        except Exception:
            pass
        try:
            await client.files.delete(file_id=openai_file_id)
        except Exception:
            pass

    async def delete_vector_store(self, api_key: str, vector_store_id: str) -> None:
        if not vector_store_id:
            return
        client = self._client(api_key)
        try:
            await client.vector_stores.delete(vector_store_id=vector_store_id)
        except Exception:
            pass
