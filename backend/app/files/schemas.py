from datetime import datetime

from pydantic import BaseModel


class FileUploadResponse(BaseModel):
    id: str
    file_name: str
    display_name: str | None = None
    file_size: int
    mime_type: str
    purpose: str | None
    encryption_version: int = 1
    created_at: datetime


class FileRenameRequest(BaseModel):
    display_name: str
