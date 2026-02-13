"""Tests for the invitation system, password reset, and password change."""

from unittest.mock import patch


def _register(client, email="owner@example.com", full_name="Owner User"):
    """Helper to register a user and return (token, user, org_id)."""
    res = client.post("/api/auth/register", json={
        "email": email,
        "password": "testpass123",
        "full_name": full_name,
    })
    assert res.status_code == 201
    data = res.json()
    return data["token"], data["user"], data["user"]["active_org_id"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


# ── Person status badge ─────────────────────────────────────────


class TestPersonStatus:
    def test_person_status_none(self, client):
        """Person without can_login and no user_id has status 'none'."""
        token, user, org_id = _register(client)
        res = client.post("/api/people", json={
            "first_name": "Jane",
            "last_name": "Doe",
            "email": "jane@example.com",
        }, headers=_auth(token))
        assert res.status_code == 201
        assert res.json()["status"] == "none"

    @patch("app.people.router.send_invitation_email")
    def test_person_status_invited(self, mock_send, client):
        """Person with can_login=True and no user_id has status 'invited'."""
        token, user, org_id = _register(client)
        res = client.post("/api/people", json={
            "first_name": "Jane",
            "last_name": "Doe",
            "email": "jane@example.com",
            "can_login": True,
        }, headers=_auth(token))
        assert res.status_code == 201
        assert res.json()["status"] == "invited"
        assert res.json()["can_login"] is True
        assert res.json()["user_id"] is None

    def test_owner_person_status_active(self, client):
        """Auto-created person for registered user has status 'active'."""
        token, user, org_id = _register(client)
        res = client.get("/api/people", headers=_auth(token))
        assert res.status_code == 200
        people = res.json()
        owner_person = [p for p in people if p["user_id"] == user["id"]]
        assert len(owner_person) == 1
        assert owner_person[0]["status"] == "active"


# ── Invitation flow ─────────────────────────────────────────────


class TestInvitationFlow:
    @patch("app.people.router.send_invitation_email")
    def test_create_person_with_can_login_sends_invite(self, mock_send, client):
        """Creating a person with can_login=True triggers invitation."""
        token, user, org_id = _register(client)
        res = client.post("/api/people", json={
            "first_name": "Jane",
            "last_name": "Doe",
            "email": "jane@example.com",
            "can_login": True,
        }, headers=_auth(token))
        assert res.status_code == 201
        mock_send.assert_called_once()

    def test_create_person_can_login_without_email_fails(self, client):
        """Creating person with can_login but no email returns 400."""
        token, user, org_id = _register(client)
        res = client.post("/api/people", json={
            "first_name": "Jane",
            "last_name": "Doe",
            "can_login": True,
        }, headers=_auth(token))
        assert res.status_code == 400
        assert "Email is required" in res.json()["detail"]

    @patch("app.people.router.send_invitation_email")
    def test_update_can_login_triggers_invite(self, mock_send, client):
        """Toggling can_login from False to True sends invitation."""
        token, user, org_id = _register(client)
        # Create without can_login
        res = client.post("/api/people", json={
            "first_name": "Jane",
            "last_name": "Doe",
            "email": "jane@example.com",
        }, headers=_auth(token))
        person_id = res.json()["id"]
        mock_send.assert_not_called()

        # Toggle can_login on
        res = client.patch(f"/api/people/{person_id}", json={
            "can_login": True,
        }, headers=_auth(token))
        assert res.status_code == 200
        assert res.json()["status"] == "invited"
        mock_send.assert_called_once()

    @patch("app.people.router.send_invitation_email")
    def test_resend_invite(self, mock_send, client):
        """Resend invite endpoint regenerates token and sends email."""
        token, user, org_id = _register(client)
        res = client.post("/api/people", json={
            "first_name": "Jane",
            "last_name": "Doe",
            "email": "jane@example.com",
            "can_login": True,
        }, headers=_auth(token))
        person_id = res.json()["id"]
        mock_send.reset_mock()

        res = client.post(f"/api/people/{person_id}/resend-invite", headers=_auth(token))
        assert res.status_code == 200
        assert "resent" in res.json()["message"].lower()
        mock_send.assert_called_once()


# ── Invite link ─────────────────────────────────────────────────


class TestInviteLink:
    @patch("app.people.router.send_invitation_email")
    def test_get_invite_link(self, mock_send, client):
        """Get invite link returns a valid URL for an invited person."""
        token, user, org_id = _register(client)
        res = client.post("/api/people", json={
            "first_name": "Jane",
            "last_name": "Doe",
            "email": "jane@example.com",
            "can_login": True,
        }, headers=_auth(token))
        person_id = res.json()["id"]

        res = client.get(f"/api/people/{person_id}/invite-link", headers=_auth(token))
        assert res.status_code == 200
        data = res.json()
        assert "invite_url" in data
        assert "/accept-invite?token=" in data["invite_url"]

    def test_get_invite_link_no_invitation(self, client):
        """Get invite link returns 404 when person has no active invitation."""
        token, user, org_id = _register(client)
        res = client.post("/api/people", json={
            "first_name": "Jane",
            "last_name": "Doe",
            "email": "jane@example.com",
        }, headers=_auth(token))
        person_id = res.json()["id"]

        res = client.get(f"/api/people/{person_id}/invite-link", headers=_auth(token))
        assert res.status_code == 404


# ── Accept invitation ────────────────────────────────────────────


class TestAcceptInvitation:
    @patch("app.people.router.send_invitation_email")
    def test_validate_invite_token(self, mock_send, client, db):
        """Validate invite endpoint returns person and org info."""
        token, user, org_id = _register(client)
        client.post("/api/people", json={
            "first_name": "Jane",
            "last_name": "Doe",
            "email": "jane@example.com",
            "can_login": True,
        }, headers=_auth(token))

        # Get the token from DB
        from app.invitations.models import InvitationToken
        invite = db.query(InvitationToken).filter(
            InvitationToken.purpose == "invite"
        ).first()
        assert invite is not None

        res = client.get(f"/api/auth/validate-invite?token={invite.token}")
        assert res.status_code == 200
        data = res.json()
        assert data["valid"] is True
        assert data["email"] == "jane@example.com"
        assert data["full_name"] == "Jane Doe"

    def test_validate_invite_invalid_token(self, client):
        """Invalid token returns valid=False."""
        res = client.get("/api/auth/validate-invite?token=bogus-token")
        assert res.status_code == 200
        assert res.json()["valid"] is False

    @patch("app.people.router.send_invitation_email")
    def test_accept_invite_creates_user(self, mock_send, client, db):
        """Accepting invitation creates user, links person, creates membership."""
        token, user, org_id = _register(client)
        client.post("/api/people", json={
            "first_name": "Jane",
            "last_name": "Doe",
            "email": "jane@example.com",
            "can_login": True,
        }, headers=_auth(token))

        from app.invitations.models import InvitationToken
        invite = db.query(InvitationToken).filter(
            InvitationToken.purpose == "invite"
        ).first()

        res = client.post("/api/auth/accept-invite", json={
            "token": invite.token,
            "password": "janepass123",
        })
        assert res.status_code == 200
        data = res.json()
        assert "token" in data
        assert data["user"]["email"] == "jane@example.com"
        assert data["user"]["active_org_id"] == org_id

        # Jane should be able to see the same org's people
        jane_token = data["token"]
        res = client.get("/api/people", headers=_auth(jane_token))
        assert res.status_code == 200

        # Person should now be active (linked to user)
        people = res.json()
        jane_person = [p for p in people if p["email"] == "jane@example.com"]
        assert len(jane_person) == 1
        assert jane_person[0]["status"] == "active"
        assert jane_person[0]["user_id"] is not None

    @patch("app.people.router.send_invitation_email")
    def test_accept_invite_short_password(self, mock_send, client, db):
        """Password under 8 chars returns 400."""
        token, user, org_id = _register(client)
        client.post("/api/people", json={
            "first_name": "Jane",
            "last_name": "Doe",
            "email": "jane@example.com",
            "can_login": True,
        }, headers=_auth(token))

        from app.invitations.models import InvitationToken
        invite = db.query(InvitationToken).filter(
            InvitationToken.purpose == "invite"
        ).first()

        res = client.post("/api/auth/accept-invite", json={
            "token": invite.token,
            "password": "short",
        })
        assert res.status_code == 400


# ── Password reset ───────────────────────────────────────────────


class TestPasswordReset:
    @patch("app.invitations.service.send_email_async")
    def test_forgot_password_sends_email(self, mock_send, client):
        """Forgot password sends reset email for existing user."""
        _register(client, email="reset@example.com")
        res = client.post("/api/auth/forgot-password", json={
            "email": "reset@example.com",
        })
        assert res.status_code == 200
        mock_send.assert_called_once()

    def test_forgot_password_nonexistent_email(self, client):
        """Forgot password returns 200 even for non-existent email."""
        res = client.post("/api/auth/forgot-password", json={
            "email": "nobody@example.com",
        })
        assert res.status_code == 200

    @patch("app.invitations.service.send_email_async")
    def test_reset_password_flow(self, mock_send, client, db):
        """Full flow: forgot → validate → reset → login with new password."""
        _register(client, email="reset@example.com")
        client.post("/api/auth/forgot-password", json={
            "email": "reset@example.com",
        })

        from app.invitations.models import InvitationToken
        reset_token = db.query(InvitationToken).filter(
            InvitationToken.purpose == "password_reset"
        ).first()
        assert reset_token is not None

        # Validate token
        res = client.get(f"/api/auth/validate-reset?token={reset_token.token}")
        assert res.status_code == 200
        assert res.json()["valid"] is True

        # Reset password
        res = client.post("/api/auth/reset-password", json={
            "token": reset_token.token,
            "password": "newpass12345",
        })
        assert res.status_code == 200

        # Login with new password
        res = client.post("/api/auth/login", json={
            "email": "reset@example.com",
            "password": "newpass12345",
        })
        assert res.status_code == 200
        assert "token" in res.json()

        # Old password should fail
        res = client.post("/api/auth/login", json={
            "email": "reset@example.com",
            "password": "testpass123",
        })
        assert res.status_code == 401

    def test_validate_reset_invalid_token(self, client):
        """Invalid reset token returns valid=False."""
        res = client.get("/api/auth/validate-reset?token=bogus")
        assert res.status_code == 200
        assert res.json()["valid"] is False


# ── Password change (authenticated) ─────────────────────────────


class TestChangePassword:
    def test_change_password_success(self, client):
        """Change password with correct current password."""
        token, user, org_id = _register(client, email="change@example.com")
        res = client.post("/api/auth/change-password", json={
            "current_password": "testpass123",
            "new_password": "newpass12345",
        }, headers=_auth(token))
        assert res.status_code == 200

        # Login with new password
        res = client.post("/api/auth/login", json={
            "email": "change@example.com",
            "password": "newpass12345",
        })
        assert res.status_code == 200

    def test_change_password_wrong_current(self, client):
        """Change password with wrong current password returns 400."""
        token, user, org_id = _register(client)
        res = client.post("/api/auth/change-password", json={
            "current_password": "wrongpassword",
            "new_password": "newpass12345",
        }, headers=_auth(token))
        assert res.status_code == 400

    def test_change_password_short_new(self, client):
        """Change password with short new password returns 400."""
        token, user, org_id = _register(client)
        res = client.post("/api/auth/change-password", json={
            "current_password": "testpass123",
            "new_password": "short",
        }, headers=_auth(token))
        assert res.status_code == 400

    def test_change_password_requires_auth(self, client):
        """Change password without auth returns 401."""
        res = client.post("/api/auth/change-password", json={
            "current_password": "testpass123",
            "new_password": "newpass12345",
        })
        assert res.status_code == 401
