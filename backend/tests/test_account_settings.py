"""Account settings: changing your password and renaming the company."""
import uuid

from app.core.security import create_access_token, hash_password
from app.models.user import User, UserRole
from app.modules.auth.rate_limit import EMAIL_MAX_FAILURES

PASSWORD = "correct-horse-battery"


def change_password(client, headers, current, new):
    return client.post("/auth/password", headers=headers, json={"current_password": current, "new_password": new})


def test_a_changed_password_is_the_one_that_logs_in(client, account):
    created = account()

    response = change_password(client, created["headers"], PASSWORD, "a-brand-new-password")

    assert response.status_code == 204
    old = client.post("/auth/login", json={"email": created["email"], "password": PASSWORD})
    new = client.post("/auth/login", json={"email": created["email"], "password": "a-brand-new-password"})
    assert old.status_code == 401
    assert new.status_code == 200


def test_a_wrong_current_password_does_not_sign_you_out(client, account):
    """400, not 401: the frontend treats any 401 as "logged out"."""
    created = account()

    response = change_password(client, created["headers"], "not-the-password", "a-brand-new-password")

    assert response.status_code == 400
    assert client.get("/auth/me", headers=created["headers"]).status_code == 200


def test_the_new_password_must_differ_from_the_current_one(client, account):
    created = account()

    assert change_password(client, created["headers"], PASSWORD, PASSWORD).status_code == 400


def test_a_short_new_password_is_refused(client, account):
    created = account()

    assert change_password(client, created["headers"], PASSWORD, "short").status_code == 422


def test_a_new_password_longer_than_bcrypt_reads_is_refused(client, account):
    created = account()

    assert change_password(client, created["headers"], PASSWORD, "x" * 73).status_code == 422


def test_changing_the_password_needs_a_session(client):
    assert change_password(client, {}, PASSWORD, "a-brand-new-password").status_code == 401


def test_guessing_the_current_password_is_rate_limited(client, account):
    """A stolen session must not become an unlimited password-guessing oracle."""
    created = account()

    for _ in range(EMAIL_MAX_FAILURES):
        assert change_password(client, created["headers"], "wrong-guess", "a-brand-new-password").status_code == 400

    blocked = change_password(client, created["headers"], PASSWORD, "a-brand-new-password")

    assert blocked.status_code == 429
    assert int(blocked.headers["retry-after"]) > 0


def test_sign_up_uses_the_same_password_rules(client):
    email = f"test-{uuid.uuid4().hex[:10]}@example.com"

    too_short = client.post("/auth/register", json={"email": email, "password": "short"})
    too_long = client.post("/auth/register", json={"email": email, "password": "x" * 73})

    assert too_short.status_code == 422
    assert too_long.status_code == 422


def test_reading_the_company(client, account):
    created = account("Acme Farms")

    response = client.get("/orgs/me", headers=created["headers"])

    assert response.status_code == 200
    assert response.json()["name"] == "Acme Farms"


def test_the_owner_can_rename_the_company(client, account):
    created = account("Acme Farms")

    response = client.patch("/orgs/me", headers=created["headers"], json={"name": "  Acme Agritech  "})

    assert response.status_code == 200
    assert response.json()["name"] == "Acme Agritech"
    assert client.get("/orgs/me", headers=created["headers"]).json()["name"] == "Acme Agritech"


def test_a_blank_company_name_is_refused(client, account):
    created = account()

    assert client.patch("/orgs/me", headers=created["headers"], json={"name": "   "}).status_code == 422


def test_renaming_only_touches_your_own_company(client, account):
    mine = account("Mine")
    theirs = account("Theirs")

    client.patch("/orgs/me", headers=mine["headers"], json={"name": "Renamed"})

    assert client.get("/orgs/me", headers=theirs["headers"]).json()["name"] == "Theirs"


def test_a_member_can_read_but_not_rename_the_company(client, account, db_session):
    owner = account("Acme Farms")
    org_id = client.get("/auth/me", headers=owner["headers"]).json()["org_id"]
    member = User(
        org_id=org_id,
        email=f"member-{uuid.uuid4().hex[:10]}@example.com",
        hashed_password=hash_password(PASSWORD),
        role=UserRole.member,
    )
    db_session.add(member)
    db_session.commit()
    token = create_access_token(subject=str(member.id), org_id=str(org_id), role=member.role.value)
    headers = {"Authorization": f"Bearer {token}"}

    assert client.get("/orgs/me", headers=headers).json()["name"] == "Acme Farms"
    assert client.patch("/orgs/me", headers=headers, json={"name": "Hijacked"}).status_code == 403
