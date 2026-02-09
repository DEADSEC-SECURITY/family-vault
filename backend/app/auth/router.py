from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session as DBSession
from uuid import uuid4

from app.auth.models import User
from app.auth.schemas import TokenResponse, UserCreate, UserLogin, UserResponse
from app.auth.service import (
    create_session,
    delete_session,
    get_user_by_email,
    hash_password,
    verify_password,
)
from app.database import get_db
from app.dependencies import get_current_user
from app.orgs.service import create_organization, get_user_orgs
from app.people.models import Person

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=201)
def register(data: UserCreate, db: DBSession = Depends(get_db)):
    existing = get_user_by_email(db, data.email.lower().strip())
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user = User(
        email=data.email.lower().strip(),
        password_hash=hash_password(data.password),
        full_name=data.full_name.strip(),
    )
    db.add(user)
    db.flush()

    # Auto-create personal organization
    org = create_organization(
        db, name=f"{user.full_name}'s Vault", created_by=user.id
    )

    # Auto-create person record for the user
    # Split full_name into first and last name (or use defaults)
    name_parts = user.full_name.strip().split(maxsplit=1)
    first_name = name_parts[0] if name_parts else "User"
    last_name = name_parts[1] if len(name_parts) > 1 else ""

    person = Person(
        id=str(uuid4()),
        org_id=org.id,
        first_name=first_name,
        last_name=last_name,
        email=user.email,
        can_login=True,
        user_id=user.id,
    )
    db.add(person)

    session = create_session(db, user.id)

    return TokenResponse(
        token=session.token,
        user=UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            created_at=user.created_at.isoformat(),
            active_org_id=org.id,
        ),
    )


@router.post("/login", response_model=TokenResponse)
def login(data: UserLogin, db: DBSession = Depends(get_db)):
    user = get_user_by_email(db, data.email.lower().strip())
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    session = create_session(db, user.id)
    orgs = get_user_orgs(db, user.id)

    return TokenResponse(
        token=session.token,
        user=UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            created_at=user.created_at.isoformat(),
            active_org_id=orgs[0].id if orgs else None,
        ),
    )


@router.post("/logout", status_code=204)
def logout(
    db: DBSession = Depends(get_db),
    authorization: str | None = Header(None),
):
    if authorization and authorization.startswith("Bearer "):
        delete_session(db, authorization[7:])


@router.get("/me", response_model=UserResponse)
def me(
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    orgs = get_user_orgs(db, user.id)
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        created_at=user.created_at.isoformat(),
        active_org_id=orgs[0].id if orgs else None,
    )
