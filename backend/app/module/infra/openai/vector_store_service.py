from typing import List, Tuple

from openai import AsyncOpenAI
from starlette.datastructures import UploadFile


class VectorStoreService:
    """OpenAI 벡터 스토어 CRUD. BYOK — 메서드마다 사용자 api_key를 인자로 받음."""

    def _client(self, api_key: str) -> AsyncOpenAI:
        return AsyncOpenAI(api_key=api_key)

    async def create_vector_store(self, api_key: str, directory_name: str) -> str:
        client = self._client(api_key)
        vector_store = await client.vector_stores.create(name=f"jetema_{directory_name}")
        return vector_store.id

    async def upload_file_to_vector_store(
        self,
        api_key: str,
        vector_store_id: str,
        files: List[UploadFile],
    ) -> Tuple[List[str], List[str], List[int]]:
        client = self._client(api_key)
        file_names, file_ids, file_sizes = [], [], []
        for file in files:
            name = file.filename
            data = await file.read()
            uploaded = await client.files.create(file=(name, data), purpose="assistants")
            file_names.append(name)
            file_ids.append(uploaded.id)
            file_sizes.append(file.size)
        await client.vector_stores.file_batches.create_and_poll(
            vector_store_id=vector_store_id, file_ids=file_ids
        )
        return file_names, file_ids, file_sizes

    async def delete_vector_store_files(
        self,
        api_key: str,
        vector_store_id: str,
        file_ids: List[str],
    ) -> None:
        if not file_ids:
            return
        client = self._client(api_key)
        for file_id in file_ids:
            await client.vector_stores.files.delete(
                vector_store_id=vector_store_id, file_id=file_id
            )
            await client.files.delete(file_id=file_id)

    async def delete_vector_store(self, api_key: str, vector_store_id: str):
        if not vector_store_id:
            return
        client = self._client(api_key)
        await client.vector_stores.delete(vector_store_id=vector_store_id)
