#!/usr/bin/env python3
"""File a batch of issue drafts from issues/{repo}/ to the upstream GitHub tracker.

Replicates the maintainer's manual filing format (e.g. odd-platform#1754):
  - title  = the draft frontmatter `title` (surrounding quotes stripped, trimmed to <=250 chars)
  - body   = the draft body verbatim (everything after the frontmatter), followed by the
             frontmatter itself in a trailing fenced code block
  - labels = per-item, from the manifest

Usage:
  GITHUB_TOKEN=<token> python3 scripts/file-issue-batch.py --manifest state/filing-manifest-YYYY-MM-DD.txt [--dry-run]

Manifest format (tab-separated; `#` comments and blank lines ignored):
  PLT-147<TAB>kind: bug;scope: backend

Safety:
  - An item whose frontmatter already carries a `github_issue_number` is SKIPPED (idempotent re-runs).
  - Non-ASCII bodies are skipped with an error (issues/README.md ASCII-only discipline) unless --allow-non-ascii.
  - On success the draft frontmatter is updated in place: status -> filed, github_issue_url,
    github_issue_number, filed_date. Review and commit the diff afterwards.
  - The token is read from $GITHUB_TOKEN only; it is never echoed.
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

API = "https://api.github.com"


def parse_draft(path):
    with open(path, encoding="utf-8") as f:
        text = f.read()
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", text, re.DOTALL)
    if not m:
        raise ValueError(f"{path}: no frontmatter block found")
    return m.group(1), m.group(2)


def get_field(fm, key):
    # [ \t]* not \s* — \s would eat the newline of an empty field and capture the next line
    m = re.search(rf"^{re.escape(key)}:[ \t]*(.*)$", fm, re.MULTILINE)
    return m.group(1).strip() if m else ""


def build_title(fm):
    t = get_field(fm, "title")
    if len(t) >= 2 and t[0] in "\"'" and t[-1] == t[0]:
        t = t[1:-1]
    if len(t) > 250:  # GitHub hard limit is 256
        t = t[:250].rsplit(" ", 1)[0]
    return t


def build_body(fm, body):
    return body.strip("\n") + "\n\n```\n" + fm.strip("\n") + "\n```\n"


def mark_filed(path, number, url, date):
    with open(path, encoding="utf-8") as f:
        text = f.read()
    m = re.match(r"^(---\n)(.*?)(\n---\n)(.*)$", text, re.DOTALL)
    fm = m.group(2)
    fm = re.sub(r"^status:.*$", "status: filed", fm, count=1, flags=re.MULTILINE)
    fm = re.sub(r"^github_issue_url:.*$", f'github_issue_url: "{url}"', fm, count=1, flags=re.MULTILINE)
    fm = re.sub(r"^github_issue_number:.*$", f"github_issue_number: {number}", fm, count=1, flags=re.MULTILINE)
    if not re.search(r"^filed_date:", fm, re.MULTILINE):
        fm = re.sub(r"^(github_issue_number:.*)$", rf'\1\nfiled_date: "{date}"', fm, count=1, flags=re.MULTILINE)
    with open(path, "w", encoding="utf-8") as f:
        f.write(m.group(1) + fm + m.group(3) + m.group(4))


def resolve_milestone(repo, token, title):
    """Resolve a milestone TITLE (e.g. '0.28.0') to its number. Exits if absent."""
    req = urllib.request.Request(
        f"{API}/repos/{repo}/milestones?state=open&per_page=100",
        headers={"Authorization": f"token {token}", "Accept": "application/vnd.github+json",
                 "User-Agent": "odd-team-issue-filing"})
    with urllib.request.urlopen(req, timeout=30) as r:
        milestones = json.load(r)
    for m in milestones:
        if m["title"] == title:
            return m["number"]
    sys.exit(f"milestone '{title}' not found among open milestones: {[m['title'] for m in milestones]}")


def post_issue(repo, token, title, body, labels, milestone=None):
    payload = {"title": title, "body": body, "labels": labels}
    if milestone is not None:
        payload["milestone"] = milestone
    req = urllib.request.Request(
        f"{API}/repos/{repo}/issues",
        data=json.dumps(payload).encode(),
        headers={
            "Authorization": f"token {token}",
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
            "User-Agent": "odd-team-issue-filing",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--manifest", required=True)
    ap.add_argument("--issues-dir", default="issues/odd-platform")
    ap.add_argument("--repo", default="opendatadiscovery/odd-platform")
    ap.add_argument("--milestone", default="",
                    help="milestone TITLE to attach to every created issue (e.g. 0.28.0); "
                         "maintainer's decision per issues/README.md milestone-at-filing")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--allow-non-ascii", action="store_true")
    ap.add_argument("--sleep", type=float, default=3.0, help="seconds between creations (secondary-rate-limit safety)")
    args = ap.parse_args()

    token = os.environ.get("GITHUB_TOKEN", "")
    if not args.dry_run and not token:
        sys.exit("GITHUB_TOKEN is not set (run: GITHUB_TOKEN=<token> python3 scripts/file-issue-batch.py ...)")

    entries = []
    with open(args.manifest, encoding="utf-8") as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split("\t")
            item_id = parts[0].strip()
            labels = [l.strip() for l in parts[1].split(";")] if len(parts) > 1 and parts[1].strip() else []
            entries.append((item_id, labels))

    milestone_number = None
    if args.milestone and not args.dry_run:
        milestone_number = resolve_milestone(args.repo, token, args.milestone)
        print(f"milestone '{args.milestone}' -> number {milestone_number}")

    filed, skipped, failed = [], [], []
    today = time.strftime("%Y-%m-%d")

    for item_id, labels in entries:
        path = os.path.join(args.issues_dir, f"{item_id}.md")
        try:
            fm, body = parse_draft(path)
        except (OSError, ValueError) as e:
            print(f"FAIL  {item_id}: {e}")
            failed.append(item_id)
            continue

        if get_field(fm, "github_issue_number"):
            print(f"SKIP  {item_id}: already filed as #{get_field(fm, 'github_issue_number')}")
            skipped.append(item_id)
            continue

        title = build_title(fm)
        full_body = build_body(fm, body)
        ufv = get_field(fm, "user_facing_verified") or "?"

        if not full_body.isascii() and not args.allow_non_ascii:
            bad = sorted({c for c in full_body if not c.isascii()})
            print(f"FAIL  {item_id}: non-ASCII chars {bad[:10]} (issues/README.md discipline; use --allow-non-ascii to override)")
            failed.append(item_id)
            continue

        if args.dry_run:
            ms = f" milestone={args.milestone}" if args.milestone else ""
            print(f"DRY   {item_id}: title[{len(title)}] ufv={ufv} labels={labels} body={len(full_body)}B{ms}")
            continue

        try:
            resp = post_issue(args.repo, token, title, full_body, labels, milestone_number)
        except urllib.error.HTTPError as e:
            detail = e.read().decode(errors="replace")[:300]
            print(f"FAIL  {item_id}: HTTP {e.code} {detail}")
            failed.append(item_id)
            continue
        except urllib.error.URLError as e:
            print(f"FAIL  {item_id}: {e}")
            failed.append(item_id)
            continue

        number, url = resp["number"], resp["html_url"]
        mark_filed(path, number, url, today)
        print(f"FILED {item_id} -> #{number} {url}")
        filed.append((item_id, number))
        time.sleep(args.sleep)

    print(f"\nSummary: filed={len(filed)} skipped={len(skipped)} failed={len(failed)}")
    if filed:
        print("Filed: " + ", ".join(f"{i}->#{n}" for i, n in filed))
    if failed:
        print("Failed: " + ", ".join(failed))
        sys.exit(1)


if __name__ == "__main__":
    main()
