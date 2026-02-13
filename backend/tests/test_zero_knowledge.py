"""Tests for zero-knowledge authentication flow.

These tests verify the new prelogin, ZK register, ZK login, org key exchange,
and public key endpoints. They use simulated client-side values (base64 strings)
since the actual Web Crypto operations happen in the browser.
"""
import base64

from unittest.mock import patch


def _b64(data: str) -> str:
    """Helper to create a base64-encoded string."""
    return base64.b64encode(data.encode()).decode()


FAKE_ENCRYPTED_PRIVATE_KEY = _b64("fake-encrypted-private-key-data")
FAKE_PUBLIC_KEY = _b64("fake-public-key-spki-data")
FAKE_ENCRYPTED_ORG_KEY = _b64("fake-wrapped-org-key")
FAKE_RECOVERY_KEY = _b64("fake-recovery-encrypted-private-key")
FAKE_MASTER_PASSWORD_HASH = _b64("fake-master-password-hash-pbkdf2")


def _zk_register(client, email="zkuser@example.com", full_name="ZK User"):
    """Register a user using the zero-knowledge flow."""
    res = client.post("/api/auth/register", json={
        "email": email,
        "password": "placeholder",
        "full_name": full_name,
        "master_password_hash": FAKE_MASTER_PASSWORD_HASH,
        "encrypted_private_key": FAKE_ENCRYPTED_PRIVATE_KEY,
        "public_key": FAKE_PUBLIC_KEY,
        "encrypted_org_key": FAKE_ENCRYPTED_ORG_KEY,
        "recovery_encrypted_private_key": FAKE_RECOVERY_KEY,
        "kdf_iterations": 600000,
    })
    assert res.status_code == 201
    data = res.json()
    return data["token"], data["user"], data["user"]["active_org_id"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


# ── Prelogin ──────────────────────────────────────────────────────


class TestPrelogin:
    def test_prelogin_existing_user(self, client):
        """Prelogin returns KDF iterations for an existing user."""
        _zk_register(client, email="prelogin@example.com")
        res = client.post("/api/auth/prelogin", json={
            "email": "prelogin@example.com",
        })
        assert res.status_code == 200
        data = res.json()
        assert data["kdf_iterations"] == 600000
        assert data["email"] == "prelogin@example.com"

    def test_prelogin_unknown_email(self, client):
        """Prelogin returns default iterations for unknown email (no enumeration)."""
        res = client.post("/api/auth/prelogin", json={
            "email": "unknown@example.com",
        })
        assert res.status_code == 200
        data = res.json()
        assert data["kdf_iterations"] == 600000


# ── ZK Register ───────────────────────────────────────────────────


class TestZKRegister:
    def test_zk_register_stores_keys(self, client):
        """ZK registration stores encrypted keys and returns them."""
        res = client.post("/api/auth/register", json={
            "email": "newzk@example.com",
            "password": "placeholder",
            "full_name": "New ZK",
            "master_password_hash": FAKE_MASTER_PASSWORD_HASH,
            "encrypted_private_key": FAKE_ENCRYPTED_PRIVATE_KEY,
            "public_key": FAKE_PUBLIC_KEY,
            "encrypted_org_key": FAKE_ENCRYPTED_ORG_KEY,
            "recovery_encrypted_private_key": FAKE_RECOVERY_KEY,
            "kdf_iterations": 600000,
        })
        assert res.status_code == 201
        data = res.json()
        assert data["encrypted_private_key"] == FAKE_ENCRYPTED_PRIVATE_KEY
        assert data["public_key"] == FAKE_PUBLIC_KEY
        assert data["kdf_iterations"] == 600000
        assert data["encrypted_org_key"] == FAKE_ENCRYPTED_ORG_KEY

    def test_zk_register_duplicate_email(self, client):
        """Registering with an existing email returns 409."""
        _zk_register(client, email="dup@example.com")
        res = client.post("/api/auth/register", json={
            "email": "dup@example.com",
            "password": "placeholder",
            "full_name": "Dup User",
            "master_password_hash": FAKE_MASTER_PASSWORD_HASH,
            "encrypted_private_key": FAKE_ENCRYPTED_PRIVATE_KEY,
            "public_key": FAKE_PUBLIC_KEY,
        })
        assert res.status_code == 409


# ── ZK Login ──────────────────────────────────────────────────────


class TestZKLogin:
    def test_zk_login_success(self, client):
        """Login with correct master_password_hash succeeds and returns keys."""
        _zk_register(client, email="login@example.com")
        res = client.post("/api/auth/login", json={
            "email": "login@example.com",
            "password": "placeholder",
            "master_password_hash": FAKE_MASTER_PASSWORD_HASH,
        })
        assert res.status_code == 200
        data = res.json()
        assert "token" in data
        assert data["encrypted_private_key"] == FAKE_ENCRYPTED_PRIVATE_KEY
        assert data["public_key"] == FAKE_PUBLIC_KEY
        assert data["kdf_iterations"] == 600000
        assert data["encrypted_org_key"] == FAKE_ENCRYPTED_ORG_KEY

    def test_zk_login_wrong_hash(self, client):
        """Login with wrong master_password_hash returns 401."""
        _zk_register(client, email="wrong@example.com")
        res = client.post("/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "placeholder",
            "master_password_hash": _b64("wrong-hash"),
        })
        assert res.status_code == 401

    def test_zk_login_nonexistent_email(self, client):
        """Login with unknown email returns 401."""
        res = client.post("/api/auth/login", json={
            "email": "ghost@example.com",
            "password": "placeholder",
            "master_password_hash": FAKE_MASTER_PASSWORD_HASH,
        })
        assert res.status_code == 401


# ── Org Key Exchange ──────────────────────────────────────────────


class TestOrgKeyExchange:
    def test_get_my_org_key(self, client):
        """User can retrieve their wrapped org key."""
        token, user, org_id = _zk_register(client, email="orgkey@example.com")
        res = client.get(
            f"/api/auth/org/{org_id}/my-key",
            headers=_auth(token),
        )
        assert res.status_code == 200
        assert res.json()["encrypted_org_key"] == FAKE_ENCRYPTED_ORG_KEY

    def test_get_my_org_key_wrong_org(self, client):
        """Getting org key for unknown org returns 404."""
        token, user, org_id = _zk_register(client, email="nokey@example.com")
        res = client.get(
            "/api/auth/org/nonexistent-org-id/my-key",
            headers=_auth(token),
        )
        assert res.status_code == 404

    def test_get_user_public_key(self, client):
        """Can retrieve a user's public key."""
        token, user, org_id = _zk_register(client, email="pubkey@example.com")
        res = client.get(
            f"/api/auth/user/{user['id']}/public-key",
            headers=_auth(token),
        )
        assert res.status_code == 200
        assert res.json()["public_key"] == FAKE_PUBLIC_KEY

    @patch("app.people.router.send_invitation_email")
    def test_store_org_key_for_another_user(self, mock_send, client, db):
        """Existing member can store wrapped org key for a new member."""
        # Register owner
        token, user, org_id = _zk_register(client, email="owner2@example.com")

        # Create an invited person
        res = client.post("/api/people", json={
            "first_name": "Invite",
            "last_name": "User",
            "email": "invited2@example.com",
            "can_login": True,
        }, headers=_auth(token))
        assert res.status_code == 201

        # Accept invite to create the second user
        from app.invitations.models import InvitationToken
        invite = db.query(InvitationToken).filter(
            InvitationToken.email == "invited2@example.com",
            InvitationToken.purpose == "invite",
        ).first()
        assert invite is not None

        accept_res = client.post("/api/auth/accept-invite", json={
            "token": invite.token,
            "password": "inviteepass123",
            "master_password_hash": _b64("invitee-hash"),
            "encrypted_private_key": _b64("invitee-priv-key"),
            "public_key": _b64("invitee-pub-key"),
            "kdf_iterations": 600000,
        })
        assert accept_res.status_code == 200
        invitee_user_id = accept_res.json()["user"]["id"]

        # Owner stores wrapped org key for the invitee
        res = client.post(
            f"/api/auth/org/{org_id}/keys",
            json={
                "user_id": invitee_user_id,
                "encrypted_org_key": _b64("wrapped-for-invitee"),
            },
            headers=_auth(token),
        )
        assert res.status_code == 201

        # Invitee can now retrieve their wrapped org key
        invitee_token = accept_res.json()["token"]
        res = client.get(
            f"/api/auth/org/{org_id}/my-key",
            headers=_auth(invitee_token),
        )
        assert res.status_code == 200
        assert res.json()["encrypted_org_key"] == _b64("wrapped-for-invitee")


# ── ZK Change Password ───────────────────────────────────────────


class TestZKChangePassword:
    def test_zk_change_password(self, client):
        """Change password using ZK flow (master password hashes)."""
        token, user, org_id = _zk_register(client, email="chpw@example.com")
        new_hash = _b64("new-master-password-hash")
        new_priv = _b64("new-encrypted-private-key")

        res = client.post("/api/auth/change-password", json={
            "current_password": "placeholder",
            "new_password": "placeholder",
            "current_master_password_hash": FAKE_MASTER_PASSWORD_HASH,
            "new_master_password_hash": new_hash,
            "new_encrypted_private_key": new_priv,
        }, headers=_auth(token))
        assert res.status_code == 200

        # Login with new hash should work
        res = client.post("/api/auth/login", json={
            "email": "chpw@example.com",
            "password": "placeholder",
            "master_password_hash": new_hash,
        })
        assert res.status_code == 200
        # Private key should be updated
        assert res.json()["encrypted_private_key"] == new_priv

        # Old hash should fail
        res = client.post("/api/auth/login", json={
            "email": "chpw@example.com",
            "password": "placeholder",
            "master_password_hash": FAKE_MASTER_PASSWORD_HASH,
        })
        assert res.status_code == 401

    def test_zk_change_password_wrong_current(self, client):
        """ZK change password with wrong current hash returns 400."""
        token, user, org_id = _zk_register(client, email="wrongchpw@example.com")
        res = client.post("/api/auth/change-password", json={
            "current_password": "placeholder",
            "new_password": "placeholder",
            "current_master_password_hash": _b64("wrong-hash"),
            "new_master_password_hash": _b64("new-hash"),
        }, headers=_auth(token))
        assert res.status_code == 400


# ── Backward Compatibility ────────────────────────────────────────


class TestBackwardCompatibility:
    def test_legacy_register_still_works(self, client):
        """Legacy register (no ZK fields) still works."""
        res = client.post("/api/auth/register", json={
            "email": "legacy@example.com",
            "password": "legacypass123",
            "full_name": "Legacy User",
        })
        assert res.status_code == 201
        data = res.json()
        assert data["encrypted_private_key"] is None
        assert data["public_key"] is None

    def test_legacy_login_still_works(self, client):
        """Legacy login (raw password) still works."""
        client.post("/api/auth/register", json={
            "email": "legacy2@example.com",
            "password": "legacypass123",
            "full_name": "Legacy User 2",
        })
        res = client.post("/api/auth/login", json={
            "email": "legacy2@example.com",
            "password": "legacypass123",
        })
        assert res.status_code == 200
        assert "token" in res.json()
