"""Which websites may call the API from a browser: ours, and nobody else's."""
import pytest


def preflight(client, origin: str):
    return client.options(
        "/auth/me",
        headers={"Origin": origin, "Access-Control-Request-Method": "GET"},
    )


def test_the_app_itself_is_allowed(client):
    response = preflight(client, "https://app.oark.in")

    assert response.headers.get("access-control-allow-origin") == "https://app.oark.in"
    assert response.headers.get("access-control-allow-credentials") == "true"


@pytest.mark.parametrize(
    "origin",
    [
        "https://evil.example.com",
        # The address Render gave the frontend before app.oark.in existed.
        "https://oark-frontend.onrender.com",
        # Look-alikes of the real one.
        "https://app.oark.in.evil.example.com",
        "http://app.oark.in",
    ],
)
def test_any_other_website_is_refused(client, origin):
    assert "access-control-allow-origin" not in preflight(client, origin).headers
