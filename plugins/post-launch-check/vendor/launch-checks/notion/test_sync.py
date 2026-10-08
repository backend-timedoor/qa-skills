import unittest

import sync_checklist_to_notion as s

META = {"site": "https://x.test", "phase": "post", "runDate": "2026-10-08"}


def row(**o):
    base = {"id": "SEO-005", "group": "SEO Standard", "check": "H1 present", "type": "auto",
            "status": "fail", "reason": "1 page(s) without an H1", "pages": ["https://x.test/a"]}
    base.update(o)
    return base


def page(status, reviewer="", page_id="p1", row_id="SEO-005"):
    return {"id": page_id, "properties": {
        "ID": {"rich_text": [{"plain_text": row_id}]},
        "Status": {"select": {"name": status} if status else None},
        "Reviewer": {"rich_text": [{"plain_text": reviewer}] if reviewer else []},
    }}


class FakeClient:
    def __init__(self, existing=None):
        self.existing = existing or {}
        self.calls = []

    def request(self, method, path, body=None):
        self.calls.append((method, path, body))
        if method == "POST" and path.endswith("/query"):
            flt = body.get("filter", {})
            if "and" in flt:
                return {"results": list(self.existing.values()), "has_more": False, "next_cursor": None}
            key = flt["rich_text"]["equals"]
            hit = self.existing.get(key)
            return {"results": [hit] if hit else [], "has_more": False}
        return {"id": "new"}

    def writes(self):
        return [c for c in self.calls if c[0] in ("POST", "PATCH") and not c[1].endswith("/query")]


class PropertiesTest(unittest.TestCase):
    def test_key_and_properties(self):
        key = s.page_key(META, "SEO-005")
        self.assertEqual(key, "https://x.test|post|2026-10-08|SEO-005")
        p = s.build_properties(row(), META, key)
        self.assertEqual(p["Check"]["title"][0]["text"]["content"], "H1 present")
        self.assertEqual(p["Status"]["select"]["name"], "fail")
        self.assertEqual(p["Run date"]["date"]["start"], "2026-10-08")
        self.assertEqual(p["Pages affected"]["rich_text"][0]["text"]["content"], "https://x.test/a")

    def test_long_text_is_truncated_to_notion_limit(self):
        p = s.build_properties(row(reason="x" * 5000), META, "k")
        self.assertEqual(len(p["Evidence"]["rich_text"][0]["text"]["content"]), 2000)

    def test_update_never_touches_reviewer_and_protects_tester_status(self):
        for tester_status in ("pass", "fail", "n/a"):
            u = s.update_properties(row(status="manual-todo"), META, "k", tester_status)
            self.assertNotIn("Status", u)
            self.assertNotIn("Reviewer", u)
        for placeholder in ("manual-todo", "review-needed", None):
            u = s.update_properties(row(status="pass"), META, "k", placeholder)
            self.assertEqual(u["Status"]["select"]["name"], "pass")
            self.assertNotIn("Reviewer", u)


class SyncTest(unittest.TestCase):
    def test_creates_missing_pages_and_updates_existing(self):
        key_existing = s.page_key(META, "SEO-005")
        client = FakeClient({key_existing: page("review-needed")})
        report = {**META, "rows": [row(), row(id="SEO-001", check="Meta")]}
        result = s.sync_report(report, client, "db1")
        self.assertEqual((result["created"], result["updated"]), (1, 1))
        methods = [(m, p) for m, p, _ in client.writes()]
        self.assertIn(("PATCH", "/pages/p1"), methods)
        self.assertIn(("POST", "/pages"), methods)

    def test_resync_does_not_overwrite_tester_edited_status(self):
        key = s.page_key(META, "UI-001")
        client = FakeClient({key: page("pass", row_id="UI-001")})
        report = {**META, "rows": [row(id="UI-001", type="manual", status="manual-todo", reason="")]}
        s.sync_report(report, client, "db1")
        patch = [b for m, p, b in client.writes() if m == "PATCH"][0]
        self.assertNotIn("Status", patch["properties"])

    def test_dry_run_writes_nothing(self):
        client = FakeClient()
        result = s.sync_report({**META, "rows": [row()]}, client, "db1", dry_run=True)
        self.assertEqual(client.writes(), [])
        self.assertEqual(result["created"], 1)
        self.assertTrue(result["actions"][0].startswith("would create"))


class PullTest(unittest.TestCase):
    def test_pull_brings_back_tester_status_and_reviewer(self):
        report = {**META, "summary": {}, "rows": [row(id="UI-001", type="manual", status="manual-todo", reason="")]}
        client = FakeClient({"k": page("pass", reviewer="Dewi", row_id="UI-001")})
        result = s.pull_report(report, client, "db1")
        self.assertEqual(result["changed"], 1)
        self.assertEqual(report["rows"][0]["status"], "pass")
        self.assertEqual(report["rows"][0]["reviewer"], "Dewi")
        self.assertEqual(report["summary"]["pass"], 1)

    def test_pull_ignores_unknown_statuses_and_unknown_rows(self):
        report = {**META, "summary": {}, "rows": [row()]}
        client = FakeClient({"a": page("bogus"), "b": page("pass", row_id="NOPE-1")})
        self.assertEqual(s.pull_report(report, client, "db1")["changed"], 0)
        self.assertEqual(report["rows"][0]["status"], "fail")


if __name__ == "__main__":
    unittest.main()
