"""Tests for /api/importFlowBundle, which unpacks a .cfzip into the flows and media folders.

Bundled media files used to be verified at their destination in MEDIA_DIR before
being copied there, so on a fresh media folder every file failed verification
and none were imported.
"""

import hashlib
import io
import json
import os
import zipfile

import pytest

import chainforge.flask_app as flask_app


def media_uid(content: bytes, ext=".png", uuid_hex="0123456789abcdef0123456789abcdef"):
    """A media filename as the server names them: <sha256 of content>-<uuid><ext>."""
    return f"{hashlib.sha256(content).hexdigest()}-{uuid_hex}{ext}"


def bundle(media: dict) -> io.BytesIO:
    """A .cfzip holding a minimal flow.json and the given {filename: bytes} media files."""
    flow = {"flow": {"nodes": [], "edges": []}, "cache": {"__media": {"uids": list(media)}}}
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("flow.json", json.dumps(flow))
        for name, content in media.items():
            zf.writestr(f"media/{name}", content)
    buf.seek(0)
    return buf


@pytest.fixture
def dirs(tmp_path, monkeypatch):
    """Empty flows and media folders, as on a fresh install or `serve --dir <new dir>`."""
    flows_dir = tmp_path / "flows"
    flows_dir.mkdir()
    media_dir = flows_dir / "media"
    monkeypatch.setattr(flask_app, "FLOWS_DIR", str(flows_dir))
    monkeypatch.setattr(flask_app, "MEDIA_DIR", str(media_dir))
    return flows_dir, media_dir


def import_bundle(client, media):
    return client.post(
        "/api/importFlowBundle",
        data={"file": (bundle(media), "my-flow.cfzip")},
        content_type="multipart/form-data",
    )


def test_media_is_imported_into_an_empty_media_dir(client, dirs):
    _, media_dir = dirs
    content = b"\x89PNG not really an image"
    uid = media_uid(content)

    resp = import_bundle(client, {uid: content})

    assert resp.status_code == 200, resp.get_json()
    assert (media_dir / uid).read_bytes() == content


def test_media_whose_content_does_not_match_its_hash_is_rejected(client, dirs):
    _, media_dir = dirs
    good = b"the real bytes"
    good_uid = media_uid(good, uuid_hex="a" * 32)
    tampered_uid = media_uid(b"what the name promises", uuid_hex="b" * 32)

    resp = import_bundle(client, {good_uid: good, tampered_uid: b"something else"})

    assert resp.status_code == 200, resp.get_json()
    assert (media_dir / good_uid).exists()
    assert not (media_dir / tampered_uid).exists()


class TestVerifyMediaFileIntegrity:

    def test_defaults_to_media_dir(self, dirs):
        _, media_dir = dirs
        media_dir.mkdir()
        content = b"hello"
        uid = media_uid(content)
        (media_dir / uid).write_bytes(content)

        flask_app.verify_media_file_integrity(uid)

    def test_checks_the_given_directory(self, tmp_path, dirs):
        content = b"hello"
        uid = media_uid(content)
        (tmp_path / uid).write_bytes(content)

        flask_app.verify_media_file_integrity(uid, directory=str(tmp_path))
        with pytest.raises(FileNotFoundError):
            flask_app.verify_media_file_integrity(uid)

    def test_hash_mismatch_raises(self, tmp_path):
        uid = media_uid(b"expected")
        (tmp_path / uid).write_bytes(b"actual")

        with pytest.raises(ValueError, match="Hash mismatch"):
            flask_app.verify_media_file_integrity(uid, directory=str(tmp_path))
