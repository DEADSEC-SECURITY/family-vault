"""Smoke tests to verify the API starts and basic endpoints work."""


def test_health_check(client):
    """Health endpoint should return 200 with status ok."""
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_categories_list_requires_auth(client):
    """Categories endpoint should require auth."""
    response = client.get("/api/categories")
    assert response.status_code == 401


def test_categories_list_with_auth(client):
    """Categories endpoint should return a list when authenticated."""
    # Register to get a token
    reg = client.post("/api/auth/register", json={
        "email": "cattest@example.com",
        "password": "testpassword123",
        "full_name": "Cat Test",
    })
    token = reg.json()["token"]

    response = client.get("/api/categories", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0
    for cat in data:
        assert "slug" in cat
        assert "label" in cat


def test_auth_required_for_items(client):
    """Items endpoint should return 401 without auth token."""
    response = client.get("/api/items")
    assert response.status_code == 401


def test_register_and_login(client):
    """Register a new user, then login with the same credentials."""
    # Register
    register_data = {
        "email": "test@example.com",
        "password": "testpassword123",
        "full_name": "Test User",
    }
    response = client.post("/api/auth/register", json=register_data)
    assert response.status_code in (200, 201)
    data = response.json()
    assert "token" in data
    assert data["user"]["email"] == "test@example.com"

    # Login
    login_data = {
        "email": "test@example.com",
        "password": "testpassword123",
    }
    response = client.post("/api/auth/login", json=login_data)
    assert response.status_code == 200
    data = response.json()
    assert "token" in data

    # Access protected endpoint with token
    token = data["token"]
    response = client.get("/api/items", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
