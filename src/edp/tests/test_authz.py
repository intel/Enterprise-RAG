# Copyright (C) 2026 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

import time
import uuid
from unittest.mock import MagicMock, patch

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient

from app.main import app

BACKEND_CLIENT = "EnterpriseRAG-oidc-backend"
SIGNING_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
FORGED_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)

USER = ["ERAG-user"]
MAINTAINER = ["ERAG-user", "ERAG-maintainer"]
ADMIN = ["ERAG-admin"]

client = TestClient(app, raise_server_exceptions=False)


def make_token(roles, key=SIGNING_KEY, expires_in=300):
    now = int(time.time())
    claims = {
        "sub": str(uuid.uuid4()),
        "iat": now,
        "exp": now + expires_in,
        "aud": [BACKEND_CLIENT, "account"],
        "resource_access": {BACKEND_CLIENT: {"roles": roles}},
    }
    return jwt.encode(claims, key, algorithm="RS384", headers={"kid": "test"})


def auth(token):
    return {"Authorization": f"Bearer {token}"} if token else {}


@pytest.fixture(autouse=True)
def keycloak_jwks(monkeypatch):
    monkeypatch.setenv("EDP_OIDC_CONFIG_URL", "http://keycloak/realms/EnterpriseRAG/.well-known/openid-configuration")
    monkeypatch.setattr("app.main._jwks_client", None)
    signing_key = MagicMock(key=SIGNING_KEY.public_key())
    monkeypatch.setattr(jwt.PyJWKClient, "get_signing_key_from_jwt", lambda self, token: signing_key)


# -------------- /api/presignedUrl ------------

@pytest.fixture
def signer(monkeypatch):
    """Default install: SeaweedFS without STS, so EDP falls back to the system credentials."""
    monkeypatch.setenv("PRESIGNED_URL_CREDENTIALS_SYSTEM_FALLBACK", "true")
    monkeypatch.setenv("USE_BEARER_TOKEN_AUTH", "false")
    sts_client = MagicMock()
    sts_client._provider.retrieve.side_effect = ValueError(
        "AssumeRoleWithWebIdentity failed with HTTP status code 405")
    with patch("app.main.get_local_minio_client_using_token_credentials", return_value=sts_client), \
         patch("app.main.ensure_bucket_exists"), \
         patch("app.main.generate_presigned_url", return_value="http://s3/presigned") as sign:
        yield sign


def presign(bucket, method, token=None):
    payload = {"bucket_name": bucket, "object_name": "doc.txt", "method": method}
    return client.post("/api/presignedUrl", json=payload, headers=auth(token))


def test_presigned_url_without_token_is_unauthorized(signer):
    response = presign("default", "GET")
    assert response.status_code == 401
    signer.assert_not_called()


def test_presigned_url_with_forged_token_is_unauthorized(signer):
    response = presign("only-admin", "GET", make_token(ADMIN, key=FORGED_KEY))
    assert response.status_code == 401
    signer.assert_not_called()


def test_presigned_url_with_expired_token_is_unauthorized(signer):
    response = presign("only-admin", "GET", make_token(ADMIN, expires_in=-60))
    assert response.status_code == 401
    signer.assert_not_called()


def test_presigned_url_without_product_role_is_forbidden(signer):
    response = presign("default", "GET", make_token([]))
    assert response.status_code == 403
    signer.assert_not_called()


@pytest.mark.parametrize("bucket", ["default", "secondary", "only-admin"])
@pytest.mark.parametrize("method", ["PUT", "DELETE"])
def test_regular_user_cannot_presign_writes(signer, bucket, method):
    response = presign(bucket, method, make_token(USER))
    assert response.status_code == 403
    signer.assert_not_called()


# Without RBAC every user retrieves chunks from every bucket, so the source file stays downloadable.
@pytest.mark.parametrize("bucket", ["default", "secondary", "only-admin"])
def test_regular_user_can_presign_read(signer, bucket):
    response = presign(bucket, "GET", make_token(USER))
    assert response.status_code == 200
    assert response.json() == {"url": "http://s3/presigned"}


@pytest.mark.parametrize("bucket,status", [("erag-docs", 200), ("billing-exports", 403)])
def test_system_signed_presign_is_limited_to_managed_buckets(signer, monkeypatch, bucket, status):
    monkeypatch.setenv("BUCKET_NAME_REGEX_FILTER", "^erag-")
    assert presign(bucket, "GET", make_token(USER)).status_code == status


@pytest.mark.parametrize("roles", [MAINTAINER, ADMIN], ids=["maintainer", "admin"])
@pytest.mark.parametrize("bucket", ["default", "only-admin"])
@pytest.mark.parametrize("method", ["GET", "PUT", "DELETE"])
def test_privileged_roles_can_presign_any_method(signer, roles, bucket, method):
    response = presign(bucket, method, make_token(roles))
    assert response.status_code == 200
    assert response.json() == {"url": "http://s3/presigned"}


@pytest.mark.parametrize("method", ["PUT", "DELETE"])
def test_bearer_mode_regular_user_cannot_presign_writes(monkeypatch, method):
    monkeypatch.setenv("USE_BEARER_TOKEN_AUTH", "true")
    with patch("app.main.get_seaweedfs_client_using_bearer_token"), \
         patch("app.main.ensure_bucket_exists"):
        response = presign("default", method, make_token(USER))
    assert response.status_code == 403


# -------------- Admin-only API called directly, bypassing the gateway ------------

# Mirrors the edp-admin route in deployment/components/edp/values.yaml.
LINK_ID = FILE_ID = str(uuid.uuid4())
ADMIN_ONLY_ROUTES = [
    ("GET", "/api/files", {}),
    ("GET", "/api/links", {}),
    ("POST", "/api/links", {"json": {"links": ["https://www.example.org/"]}}),
    ("DELETE", f"/api/link/{LINK_ID}", {}),
    ("POST", f"/api/link/{LINK_ID}/retry", {}),
    ("DELETE", f"/api/link/{LINK_ID}/task", {}),
    ("POST", f"/api/link/{LINK_ID}/extract", {}),
    ("POST", f"/api/file/{FILE_ID}/retry", {}),
    ("DELETE", f"/api/file/{FILE_ID}/task", {}),
    ("POST", f"/api/file/{FILE_ID}/extract", {}),
    ("GET", "/api/files/sync", {}),
    ("POST", "/api/files/sync", {}),
    ("POST", "/api/retrieve", {"json": {"query": "q"}}),
    ("GET", "/api/list_buckets", {}),
    ("GET", "/api/sharepoint/sites", {}),
    ("POST", "/api/sharepoint/sites", {"json": {"site_url": "https://contoso.sharepoint.com/sites/s"}}),
    ("DELETE", "/api/sharepoint/sites/site-1", {}),
    ("GET", "/api/sharepoint/sync", {}),
    ("POST", "/api/sharepoint/sync", {}),
    ("POST", "/api/sharepoint/files", {"files": {"file": ("a.txt", b"x", "text/plain")}}),
    ("DELETE", "/api/sharepoint/files", {"json": {"site_name": "s", "object_name": "a.txt"}}),
    ("POST", "/api/sharepoint/file-url", {"json": {"site_name": "s", "object_name": "a.txt"}}),
]
ROUTE_IDS = [f"{method} {path}" for method, path, _ in ADMIN_ONLY_ROUTES]


@pytest.fixture
def isolated_handlers():
    """A handler that runs past authorization fails with 500 instead of touching real services."""
    reached = RuntimeError("handler reached")
    with patch("app.main.get_db", side_effect=reached), \
         patch("app.main.minio_internal") as minio, \
         patch("app.main.sync_files", side_effect=reached), \
         patch("requests.post", side_effect=reached):
        minio.list_buckets.return_value = []
        yield


def call(method, path, kwargs, token=None):
    return client.request(method, path, headers=auth(token), **kwargs)


@pytest.mark.parametrize("method,path,kwargs", ADMIN_ONLY_ROUTES, ids=ROUTE_IDS)
def test_admin_route_without_token_is_unauthorized(isolated_handlers, method, path, kwargs):
    assert call(method, path, kwargs).status_code == 401


@pytest.mark.parametrize("method,path,kwargs", ADMIN_ONLY_ROUTES, ids=ROUTE_IDS)
def test_admin_route_with_regular_user_token_is_forbidden(isolated_handlers, method, path, kwargs):
    assert call(method, path, kwargs, make_token(USER)).status_code == 403


@pytest.mark.parametrize("method,path,kwargs", ADMIN_ONLY_ROUTES, ids=ROUTE_IDS)
def test_admin_route_accepts_maintainer_token(isolated_handlers, method, path, kwargs):
    assert call(method, path, kwargs, make_token(MAINTAINER)).status_code not in (401, 403)


def test_retriever_bucket_permissions_stay_open_to_regular_user(isolated_handlers):
    response = client.get("/api/list_bucket_with_permissions", headers=auth(make_token(USER)))
    assert response.status_code not in (401, 403)
