from fastapi.testclient import TestClient

from app.main import app


def test_health_and_service_lifecycle():
    with TestClient(app) as client:
        assert client.get("/health").json() == {"status": "ok"}
        created = client.post("/api/services", json={
            "name": "Example", "url": "https://example.com/health", "interval_seconds": 60
        })
        assert created.status_code == 201
        service = created.json()
        assert service["status"] == "unknown"
        assert client.get(f"/api/services/{service['id']}").status_code == 200
        paused = client.patch(f"/api/services/{service['id']}", json={"is_active": False})
        assert paused.json()["is_active"] is False
        assert client.post(f"/api/services/{service['id']}/checks").status_code == 409
        assert client.delete(f"/api/services/{service['id']}").status_code == 204
        assert client.get(f"/api/services/{service['id']}").status_code == 404


def test_cors_allows_local_dashboard_hosts():
    with TestClient(app) as client:
        for origin in ("http://localhost:5173", "http://127.0.0.1:5173"):
            response = client.options(
                "/api/services",
                headers={
                    "Origin": origin,
                    "Access-Control-Request-Method": "GET",
                },
            )
            assert response.status_code == 200
            assert response.headers["access-control-allow-origin"] == origin


def test_rejects_invalid_interval():
    with TestClient(app) as client:
        response = client.post("/api/services", json={
            "name": "Bad", "url": "https://example.com", "interval_seconds": 1
        })
        assert response.status_code == 422


def test_failed_check_opens_incident_and_recovery_resolves_it(monkeypatch):
    from app import checks

    state = {"status": 503}

    class FakeResponse:
        def __init__(self, status_code):
            self.status_code = status_code
            self.is_success = 200 <= status_code < 300

    class FakeClient:
        def __init__(self, **_kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def get(self, _url):
            return FakeResponse(state["status"])

    monkeypatch.setattr(checks.httpx, "AsyncClient", FakeClient)
    with TestClient(app) as client:
        service = client.post("/api/services", json={"name": "Incident test", "url": "https://example.com"}).json()
        first = client.post(f"/api/services/{service['id']}/checks")
        second = client.post(f"/api/services/{service['id']}/checks")
        assert first.json()["is_success"] is False
        assert second.json()["is_success"] is False
        open_incidents = client.get("/api/incidents?state=open").json()
        matching = [item for item in open_incidents if item["service_id"] == service["id"]]
        assert len(matching) == 1

        state["status"] = 200
        recovered = client.post(f"/api/services/{service['id']}/checks")
        assert recovered.json()["is_success"] is True
        resolved = client.get("/api/incidents?state=resolved").json()
        assert any(item["service_id"] == service["id"] for item in resolved)
