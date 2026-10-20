"""Tests use dummy credentials only; never read the author's private verifier."""
import contextlib
import hashlib
import importlib.util
import io
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("author_authorization", Path(__file__).with_name("verify-author-authorization.py"))
authorization = importlib.util.module_from_spec(spec)
spec.loader.exec_module(authorization)


class AuthorAuthorizationTests(unittest.TestCase):
    def setUp(self):
        salt = bytes(range(32))
        self.record = {"schemaVersion": 1, "algorithm": "pbkdf2-sha256", "iterations": 600_000, "salt": salt.hex(),
                       "digest": hashlib.pbkdf2_hmac("sha256", b"dummy-operator-passphrase", salt, 600_000).hex()}

    def test_correct_and_wrong_dummy_passwords(self):
        self.assertTrue(authorization.verify_password("dummy-operator-passphrase", self.record))
        self.assertFalse(authorization.verify_password("wrong-dummy-passphrase", self.record))

    def test_malformed_record_cannot_authorize(self):
        for change in [{"schemaVersion": 0}, {"iterations": 1}, {"salt": "00"}, {"digest": "00"}]:
            with self.assertRaises(ValueError):
                authorization.verify_password("dummy-operator-passphrase", self.record | change)

    def test_missing_private_record_fails_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(authorization, "authorization_file", return_value=Path(directory)/"missing.json"), patch("sys.argv", ["verifier"]), contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(authorization.main(), 2)

    def test_non_interactive_input_cannot_auto_authorize(self):
        import json
        with tempfile.TemporaryDirectory() as directory:
            record = Path(directory)/"record.json"
            record.write_text(json.dumps(self.record), encoding="utf-8")
            with patch.object(authorization, "authorization_file", return_value=record), patch("sys.argv", ["verifier"]), patch("sys.stdin", io.StringIO("dummy-operator-passphrase\n")), contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(authorization.main(), 2)

    def test_password_argument_rejected_without_reading_private_record(self):
        with patch("sys.argv", ["verifier", "dummy-operator-passphrase"]), patch.object(authorization, "authorization_file", side_effect=AssertionError("must not read")), contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(authorization.main(), 2)


if __name__ == "__main__":
    unittest.main()
