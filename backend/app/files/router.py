import base64
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session as DBSession

from app.auth.models import User
from app.database import get_db
from app.dependencies import get_current_user
from app.files.encryption import decrypt_file, encrypt_file
from app.files.models import FileAttachment
from app.files.schemas import FileUploadResponse
from app.files.storage import get_storage
from app.items.models import Item
from app.orgs.models import Organization
from app.orgs.service import get_active_org, get_org_by_id, get_org_encryption_key

router = APIRouter(prefix="/api/files", tags=["files"])

ALLOWED_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB


@router.post("/upload", response_model=FileUploadResponse, status_code=201)
async def upload_file(
    file: UploadFile = File(...),
    item_id: str = Form(...),
    purpose: str | None = Form(None),
    encryption_version: int = Form(1),
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    org = get_active_org(user, db)

    # Verify item belongs to org
    item = (
        db.query(Item)
        .filter(Item.id == item_id, Item.org_id == org.id, Item.is_archived == False)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Read file content
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 25MB)")

    mime_type = file.content_type or "application/octet-stream"
    # For client-encrypted files, the MIME type on the upload is application/octet-stream
    # but we allow it; the original MIME type is passed as 'purpose' or tracked client-side.
    if encryption_version == 1 and mime_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"File type not allowed: {mime_type}",
        )

    # Generate storage key
    ext = file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "bin"
    short_uuid = str(uuid4())[:8]
    storage_key = f"{org.id}/{item_id}/{purpose or 'file'}_{short_uuid}.{ext}.enc"

    storage = get_storage()

    if encryption_version == 2:
        # Client-side encryption: file is already encrypted by the client
        storage.upload(content, storage_key)
        iv_b64 = ""
        tag_b64 = ""
        file_size = len(content)
    else:
        # Server-side encryption (v1)
        org_key = get_org_encryption_key(org)
        ciphertext, iv, tag = encrypt_file(content, org_key)
        storage.upload(ciphertext + tag, storage_key)
        iv_b64 = base64.b64encode(iv).decode()
        tag_b64 = base64.b64encode(tag).decode()
        file_size = len(content)

    # Save metadata
    attachment = FileAttachment(
        item_id=item_id,
        uploaded_by=user.id,
        file_name=file.filename or "unnamed",
        storage_key=storage_key,
        file_size=file_size,
        mime_type=mime_type,
        purpose=purpose,
        encryption_iv=iv_b64,
        encryption_tag=tag_b64,
        encryption_version=encryption_version,
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)

    return FileUploadResponse(
        id=attachment.id,
        file_name=attachment.file_name,
        file_size=attachment.file_size,
        mime_type=attachment.mime_type,
        purpose=attachment.purpose,
        encryption_version=attachment.encryption_version,
        created_at=attachment.created_at.isoformat(),
    )


@router.get("/{file_id}")
def download_file(
    file_id: str,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    org = get_active_org(user, db)

    attachment = (
        db.query(FileAttachment)
        .join(Item)
        .filter(FileAttachment.id == file_id, Item.org_id == org.id)
        .first()
    )
    if not attachment:
        raise HTTPException(status_code=404, detail="File not found")

    # Download bytes from MinIO
    storage = get_storage()
    stored_data = storage.download(attachment.storage_key)

    if attachment.encryption_version == 2:
        # Client-side encryption: return encrypted bytes as-is (client will decrypt)
        return Response(
            content=stored_data,
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": f'attachment; filename="{attachment.file_name}"',
                "X-Encryption-Version": "2",
            },
        )

    # Server-side encryption (v1): decrypt before returning
    org_key = get_org_encryption_key(org)
    iv = base64.b64decode(attachment.encryption_iv)
    tag = base64.b64decode(attachment.encryption_tag)

    ciphertext = stored_data[:-16]
    stored_tag = stored_data[-16:]
    plaintext = decrypt_file(ciphertext, iv, stored_tag, org_key)

    return Response(
        content=plaintext,
        media_type=attachment.mime_type,
        headers={
            "Content-Disposition": f'inline; filename="{attachment.file_name}"',
        },
    )


@router.delete("/{file_id}", status_code=204)
def delete_file(
    file_id: str,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    org = get_active_org(user, db)

    attachment = (
        db.query(FileAttachment)
        .join(Item)
        .filter(FileAttachment.id == file_id, Item.org_id == org.id)
        .first()
    )
    if not attachment:
        raise HTTPException(status_code=404, detail="File not found")

    # Delete from storage
    storage = get_storage()
    try:
        storage.delete(attachment.storage_key)
    except Exception:
        pass  # File may already be gone

    db.delete(attachment)
    db.commit()
