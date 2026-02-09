import boto3
from botocore.exceptions import ClientError

from app.config import settings


class StorageClient:
    def __init__(self):
        self.client = boto3.client(
            "s3",
            endpoint_url=settings.S3_ENDPOINT_URL,
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY,
            region_name=settings.S3_REGION,
        )
        self.bucket = settings.S3_BUCKET

    def ensure_bucket(self) -> None:
        """Create bucket if it doesn't exist."""
        try:
            self.client.head_bucket(Bucket=self.bucket)
        except ClientError:
            self.client.create_bucket(Bucket=self.bucket)

    def upload(self, data: bytes, key: str, content_type: str = "application/octet-stream") -> None:
        """Upload encrypted bytes to S3/MinIO."""
        self.client.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=data,
            ContentType=content_type,
        )

    def download(self, key: str) -> bytes:
        """Download encrypted bytes from S3/MinIO."""
        response = self.client.get_object(Bucket=self.bucket, Key=key)
        return response["Body"].read()

    def delete(self, key: str) -> None:
        """Delete an object from S3/MinIO."""
        self.client.delete_object(Bucket=self.bucket, Key=key)


_storage_client: StorageClient | None = None


def get_storage() -> StorageClient:
    global _storage_client
    if _storage_client is None:
        _storage_client = StorageClient()
        _storage_client.ensure_bucket()
    return _storage_client
