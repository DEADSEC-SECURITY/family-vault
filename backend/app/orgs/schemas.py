from pydantic import BaseModel


class OrgCreate(BaseModel):
    name: str


class OrgUpdate(BaseModel):
    name: str


class OrgMemberInvite(BaseModel):
    email: str
    role: str = "member"


class OrgMemberUpdate(BaseModel):
    role: str


class OrgMemberResponse(BaseModel):
    id: str
    user_id: str
    email: str
    full_name: str
    role: str
    created_at: str


class OrgResponse(BaseModel):
    id: str
    name: str
    created_by: str
    created_at: str
    updated_at: str
    members: list[OrgMemberResponse] | None = None

    model_config = {"from_attributes": True}
