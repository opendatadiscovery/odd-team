#!/usr/bin/env python3
"""
probe-runtime/runner.py — local-only probe execution wrapper.

Per `adrs/drafts/dynamic-verification-layer.md` slice 2. Reads a probe
definition (YAML), executes its arrange / act / observe / assert / cleanup
blocks against an ephemeral local docker-compose mirror, and emits a
probe-run artefact recording every step's outcome with timestamps + evidence.

Operational invariant: LOCAL-ONLY. The runner shells out to:
  - Docker Compose (probe-stack lifecycle; prefers the v2 plugin 'docker compose')
  - docker exec ... psql (SQL queries against the ephemeral Postgres)
  - python requests (REST against the ephemeral backend)
That's the entire surface. No remote calls, no managed services, nothing
that produces a recurring bill. Per APPROACH.md section 5 rule 12.

The runner is invoked by the probe-runner subagent via Bash; the subagent's
Bash scope is restricted to this wrapper (no arbitrary commands). Probe
definitions are declarative YAML; this runner is the only thing executing
shell commands from those definitions.

Usage:
  python3 runner.py <probe_id> [--workspace-root <path>] [--verbose] [--dry-run]
  python3 runner.py --validate <probe_id>     # parse + scope-check, no execution

Exit code: 0 = PASS, 1 = FAIL (asserts failed), 2 = ERROR (probe broken),
          3 = TIMEOUT, 4 = SCOPE_VIOLATION
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import shlex
import shutil
import subprocess
import sys
import time
import traceback
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:
    print("FATAL: PyYAML required. Install via: pip3 install --user pyyaml", file=sys.stderr)
    sys.exit(2)

try:
    import requests
except ImportError:
    print("FATAL: requests required. Install via: pip3 install --user requests", file=sys.stderr)
    sys.exit(2)


# ============================================================================
# Constants — local-only, no remote URLs anywhere
# ============================================================================

WORKSPACE_ROOT_DEFAULT = Path(__file__).resolve().parents[3]   # lineage/_extractor/probe-runtime/ → workspace
PROBE_STACK_DIR_DEFAULT = WORKSPACE_ROOT_DEFAULT / "lineage" / "_extractor" / "probe-stacks"
PROBES_DIR_TEMPLATE = "lineage/{repo}/probes"
PROBE_RUNS_DIR_TEMPLATE = "lineage/{repo}/probe-runs"


def _rel_to_workspace(p: Path | str) -> str:
    """Workspace-relative path for trace artefacts. Run traces are committed (the
    reproducible evidence trail) and the workspace is public OSS — never leak an
    absolute home-directory path into one. Falls back to the basename if p is outside
    the workspace."""
    try:
        return str(Path(p).resolve().relative_to(WORKSPACE_ROOT_DEFAULT))
    except (ValueError, OSError):
        return Path(p).name

# Stack profile → docker-compose file mapping. Add new profiles as new
# entries; never accept arbitrary file paths from probe definitions.
STACK_PROFILES = {
    "odd-minimal": "odd-minimal.docker-compose.yml",
}

# Allowed shell verbs the runner will execute, in order of preference.
# Anything outside this list is a SCOPE_VIOLATION (exit 4).
ALLOWED_VERBS = {"docker-compose", "docker", "wget", "curl"}

# Per-session isolation (parallel /contribute + /review): when run-suite.sh exports ODD_STREAM=<id>, the runner
# targets that stream's isolated stack (its base URL + container names) instead of the shared probe-* stack on
# :18080. Outside a stream (ODD_STREAM unset) these stay the original literals, so non-stream runs are unchanged.
# (adrs/drafts/parallel-contribution-infra.md §4-5.)
_STREAM = os.environ.get("ODD_STREAM") or ""
DEFAULT_BACKEND_BASE = (os.environ.get("ODD_BASE_URL") or "http://localhost:18080") if _STREAM else "http://localhost:18080"
DEFAULT_DB_CONTAINER = (os.environ.get("ODD_DB_CONTAINER") or "probe-database") if _STREAM else "probe-database"
DEFAULT_BACKEND_CONTAINER = (os.environ.get("ODD_BACKEND_CONTAINER") or "probe-odd-platform") if _STREAM else "probe-odd-platform"


def _resolve_base(step: dict) -> str:
    """Base URL for a probe HTTP step. In an isolated stream, force the stream's stack (ODD_BASE_URL), overriding
    any per-step ``base`` hardcoded for the shared :18080 stack; outside a stream, honour the step's base
    (unchanged behaviour). A UI probe's ``xhr_filter_regex`` that hardcodes :18080 is NOT rewritten here — that
    is a per-probe concern (logged follow-up); api ``base``+``path`` steps are fully covered."""
    if _STREAM:
        return os.environ.get("ODD_BASE_URL") or DEFAULT_BACKEND_BASE
    return step.get("base", DEFAULT_BACKEND_BASE)

# Wait-for-ready loop bounds (seconds)
STACK_READY_TIMEOUT = 180
STACK_READY_POLL_INTERVAL = 5


# ============================================================================
# Data classes
# ============================================================================

@dataclass
class StepOutcome:
    kind: str
    started_at: str
    duration_ms: int
    success: bool
    detail: dict[str, Any] = field(default_factory=dict)
    error: str | None = None


@dataclass
class ProbeRun:
    probe_run_id: str
    probe_id: str
    feature_id: str | None
    test_class: str
    ran_at: str
    ran_against_substrate_commit: str | None
    ran_against_docker_compose_tag: str
    stack_profile: str
    arrange_outcomes: list[StepOutcome] = field(default_factory=list)
    act_outcomes: list[StepOutcome] = field(default_factory=list)
    observe_outcomes: dict[str, Any] = field(default_factory=dict)
    assert_outcomes: list[dict[str, Any]] = field(default_factory=list)
    cleanup_outcomes: list[StepOutcome] = field(default_factory=list)
    outcome: str = "PENDING"   # PASS | FAIL | ERROR | TIMEOUT | SCOPE_VIOLATION
    verdict_reason: str = ""
    total_duration_ms: int = 0
    artefacts_updated: list[str] = field(default_factory=list)


# ============================================================================
# Utility — local-only command execution
# ============================================================================

def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def run_shell(argv: list[str], *, timeout: int = 60, capture: bool = True, env: dict | None = None) -> tuple[int, str, str]:
    """Run a local shell command. Verb gate enforces local-only surface.

    Returns (returncode, stdout, stderr).
    """
    if not argv:
        raise ValueError("run_shell: empty argv")
    verb = Path(argv[0]).name
    if verb not in ALLOWED_VERBS:
        raise PermissionError(f"verb {verb!r} not in ALLOWED_VERBS; refusing to execute {argv!r}")
    full_env = os.environ.copy()
    if env:
        full_env.update(env)
    try:
        proc = subprocess.run(
            argv,
            capture_output=capture,
            text=True,
            timeout=timeout,
            env=full_env,
            check=False,
        )
        return proc.returncode, (proc.stdout or "").strip(), (proc.stderr or "").strip()
    except subprocess.TimeoutExpired as exc:
        return 124, "", f"TIMEOUT: {exc}"


def docker_exec_sql(query: str, *, db_container: str = DEFAULT_DB_CONTAINER, db_name: str = "odd-platform", db_user: str = "odd-platform", timeout: int = 30) -> tuple[int, list[dict[str, Any]], str]:
    """Run a SQL query inside the postgres container via docker exec.

    Returns (rc, rows-as-dicts, stderr). Uses psql -A -t -F'\\t' for tab-separated
    rows, then parses into dicts via the column header from a separate metadata query.
    """
    # Two-step: first get column names; then fetch rows. For SELECTs this is
    # fine; for UPDATE/INSERT/DDL we just want the row count.
    query_stripped = query.strip().rstrip(";")
    is_select = query_stripped.upper().startswith("SELECT")
    if is_select:
        sql = f"COPY ({query_stripped}) TO STDOUT WITH (FORMAT CSV, HEADER true)"
        argv = [
            "docker", "exec", "-i", db_container,
            "psql", "-U", db_user, "-d", db_name, "-c", sql,
        ]
    else:
        argv = [
            "docker", "exec", "-i", db_container,
            "psql", "-U", db_user, "-d", db_name, "-c", query_stripped,
        ]
    rc, stdout, stderr = run_shell(argv, timeout=timeout)
    rows: list[dict[str, Any]] = []
    if rc == 0 and is_select and stdout:
        # CSV with header
        import csv
        import io
        reader = csv.DictReader(io.StringIO(stdout))
        for row in reader:
            rows.append(dict(row))
    return rc, rows, stderr


# ============================================================================
# Stack lifecycle — local docker-compose only
# ============================================================================

def compose_path_for_profile(profile: str, *, stack_dir: Path) -> Path:
    if profile not in STACK_PROFILES:
        raise ValueError(f"unknown stack profile {profile!r}; allowed: {sorted(STACK_PROFILES)}")
    path = stack_dir / STACK_PROFILES[profile]
    if not path.is_file():
        raise FileNotFoundError(f"compose file missing: {path}")
    return path


_COMPOSE_CMD: tuple[str, ...] | None = None


def compose_command() -> list[str]:
    """Resolve the Docker Compose CLI once per process.

    Prefer the v2 plugin ('docker compose'): the legacy v1 python binary crashes with
    KeyError: 'ContainerConfig' when RECREATING a container against modern Docker
    engines (the image-inspect key v1 reads was removed) — which kills any 'up -d'
    over a running stack whose image/config drifted (2026-06-10, P-001 arrange).
    Fall back to v1 (fresh up/down still works there) with a loud warning.
    """
    global _COMPOSE_CMD
    if _COMPOSE_CMD is None:
        rc, _, _ = run_shell(["docker", "compose", "version"], timeout=10)
        if rc == 0:
            _COMPOSE_CMD = ("docker", "compose")
        elif shutil.which("docker-compose"):
            print("[runner] WARNING: Compose v2 plugin not found — falling back to legacy "
                  "docker-compose v1, which crashes on container recreate (ContainerConfig) "
                  "against modern Docker engines.", file=sys.stderr)
            _COMPOSE_CMD = ("docker-compose",)
        else:
            raise FileNotFoundError(
                "no Docker Compose CLI found: need the v2 plugin ('docker compose') "
                "or the legacy 'docker-compose' binary")
    return list(_COMPOSE_CMD)


def stack_up(compose_file: Path, *, verbose: bool = False) -> StepOutcome:
    started = time.monotonic()
    started_at = now_iso()
    argv = [*compose_command(), "-f", str(compose_file), "up", "-d"]
    if verbose:
        print(f"[runner] stack_up: {' '.join(shlex.quote(a) for a in argv)}", file=sys.stderr)
    rc, stdout, stderr = run_shell(argv, timeout=120)
    dur_ms = int((time.monotonic() - started) * 1000)
    return StepOutcome(
        kind="docker-compose-up",
        started_at=started_at,
        duration_ms=dur_ms,
        success=(rc == 0),
        detail={"stdout_tail": stdout[-1000:], "stderr_tail": stderr[-1000:], "compose_file": _rel_to_workspace(compose_file)},
        error=None if rc == 0 else f"rc={rc}",
    )


def stack_wait_healthy(*, backend_base: str = DEFAULT_BACKEND_BASE, timeout_s: int = STACK_READY_TIMEOUT, poll_s: int = STACK_READY_POLL_INTERVAL, verbose: bool = False) -> StepOutcome:
    started = time.monotonic()
    started_at = now_iso()
    health_url = f"{backend_base}/actuator/health"
    deadline = started + timeout_s
    last_status: int | None = None
    last_body: str = ""
    while time.monotonic() < deadline:
        try:
            r = requests.get(health_url, timeout=5)
            last_status = r.status_code
            last_body = r.text[:500]
            if r.status_code == 200 and '"status":"UP"' in r.text:
                dur_ms = int((time.monotonic() - started) * 1000)
                if verbose:
                    print(f"[runner] stack healthy after {dur_ms}ms", file=sys.stderr)
                return StepOutcome(
                    kind="wait-healthy",
                    started_at=started_at,
                    duration_ms=dur_ms,
                    success=True,
                    detail={"final_status": last_status, "final_body": last_body},
                )
        except requests.RequestException as exc:
            last_body = f"request_exception: {exc}"
        time.sleep(poll_s)
    dur_ms = int((time.monotonic() - started) * 1000)
    return StepOutcome(
        kind="wait-healthy",
        started_at=started_at,
        duration_ms=dur_ms,
        success=False,
        detail={"final_status": last_status, "final_body": last_body, "timeout_s": timeout_s},
        error=f"stack did not become healthy within {timeout_s}s (last_status={last_status})",
    )


def stack_down(compose_file: Path, *, destroy_volumes: bool = True, verbose: bool = False) -> StepOutcome:
    started = time.monotonic()
    started_at = now_iso()
    argv = [*compose_command(), "-f", str(compose_file), "down"]
    if destroy_volumes:
        argv.append("-v")
    if verbose:
        print(f"[runner] stack_down: {' '.join(shlex.quote(a) for a in argv)}", file=sys.stderr)
    rc, stdout, stderr = run_shell(argv, timeout=60)
    dur_ms = int((time.monotonic() - started) * 1000)
    return StepOutcome(
        kind="docker-compose-down",
        started_at=started_at,
        duration_ms=dur_ms,
        success=(rc == 0),
        detail={"stdout_tail": stdout[-500:], "stderr_tail": stderr[-500:], "destroy_volumes": destroy_volumes},
        error=None if rc == 0 else f"rc={rc}",
    )


# ============================================================================
# Probe step execution
# ============================================================================

def execute_arrange(steps: list[dict], compose_file: Path, *, captures: dict[str, Any], verbose: bool) -> list[StepOutcome]:
    outcomes: list[StepOutcome] = []
    for step in steps:
        kind = step.get("kind")
        started = time.monotonic()
        started_at = now_iso()
        try:
            if kind == "docker-compose-up":
                # Bring up the stack + wait healthy. The compose file is
                # determined by the probe's stack_profile (caller passes here).
                up = stack_up(compose_file, verbose=verbose)
                outcomes.append(up)
                if not up.success:
                    return outcomes
                ready = stack_wait_healthy(verbose=verbose)
                outcomes.append(ready)
                if not ready.success:
                    return outcomes
            elif kind == "sql":
                rc, rows, stderr = docker_exec_sql(step["query"])
                dur_ms = int((time.monotonic() - started) * 1000)
                if "capture_as" in step and rows:
                    # Capture the first cell of the first row + try numeric coercion
                    # (CSV output gives strings; assert exprs work with ints/floats)
                    first_row = rows[0]
                    first_value = next(iter(first_row.values()))
                    try:
                        first_value = int(first_value)
                    except (ValueError, TypeError):
                        try:
                            first_value = float(first_value)
                        except (ValueError, TypeError):
                            pass
                    captures[step["capture_as"]] = first_value
                outcomes.append(StepOutcome(
                    kind="sql",
                    started_at=started_at,
                    duration_ms=dur_ms,
                    success=(rc == 0),
                    detail={"query": step["query"], "row_count": len(rows), "rows_preview": rows[:3]},
                    error=stderr if rc != 0 else None,
                ))
                if rc != 0:
                    return outcomes
            elif kind == "rest":
                method = step["method"].upper()
                path = step["path"]
                # Substitute ${var} from captures (recursive over dict/list/str)
                path = substitute_captures(path, captures)
                url = _resolve_base(step) + path
                body = substitute_captures(step.get("body"), captures) if step.get("body") is not None else None
                headers = step.get("headers", {})
                r = requests.request(method, url, json=body, headers=headers, timeout=step.get("timeout", 30))
                dur_ms = int((time.monotonic() - started) * 1000)
                if "capture_as" in step:
                    try:
                        captures[step["capture_as"]] = r.json()
                    except ValueError:
                        captures[step["capture_as"]] = r.text
                outcomes.append(StepOutcome(
                    kind="rest",
                    started_at=started_at,
                    duration_ms=dur_ms,
                    success=(200 <= r.status_code < 300),
                    detail={
                        "request": {"method": method, "url": url, "body": body},
                        "response_status": r.status_code,
                        "response_size_bytes": len(r.content),
                    },
                    error=None if 200 <= r.status_code < 300 else f"HTTP {r.status_code}: {r.text[:200]}",
                ))
            elif kind == "config_override":
                # Slice-2 implementation: config overrides are baked into the
                # compose file (env vars). Runtime config-flip requires a
                # stack restart or a backend admin endpoint; deferred to a
                # later slice. Record the request but mark as DEFERRED.
                dur_ms = int((time.monotonic() - started) * 1000)
                outcomes.append(StepOutcome(
                    kind="config_override",
                    started_at=started_at,
                    duration_ms=dur_ms,
                    success=True,
                    detail={"requested": step, "actual": "DEFERRED — slice-2 uses compose-baked config"},
                    error=None,
                ))
            else:
                raise ValueError(f"arrange: unknown step kind {kind!r}")
        except Exception as exc:
            dur_ms = int((time.monotonic() - started) * 1000)
            outcomes.append(StepOutcome(
                kind=kind or "unknown",
                started_at=started_at,
                duration_ms=dur_ms,
                success=False,
                detail={"step": step},
                error=f"{type(exc).__name__}: {exc}",
            ))
            return outcomes
    return outcomes


# ============================================================================
# Browser step — Playwright, local Chromium only
# ============================================================================

def _run_browser_step(step: dict, *, captures: dict[str, Any]) -> dict[str, Any]:
    """Launch local headless Chromium via Playwright; navigate; observe network.

    LOCAL-ONLY: uses the Chromium binary installed by `playwright install
    chromium` in the maintainer's ~/.cache/ms-playwright/. No remote browser
    farm; no Selenium grid.

    Returns a dict with keys: success, navigated_to, xhr_count, xhr_urls_sample,
    page_status, console_errors, error (None on success).
    """
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        return {
            "success": False,
            "navigated_to": None,
            "xhr_count": 0,
            "xhr_urls_sample": [],
            "page_status": None,
            "console_errors": [],
            "error": f"playwright not installed: {exc}. Install via: pip3 install --user playwright && playwright install chromium",
        }

    path = substitute_captures(step["path"], captures)
    base = _resolve_base(step)
    full_url = base + path
    # xhr_filter accepts substring OR regex. If `xhr_filter_regex` is set, use re.search;
    # otherwise use substring (backward-compat with v0.1 probes).
    xhr_filter_substr = step.get("xhr_filter", "/api/")
    xhr_filter_regex_str = step.get("xhr_filter_regex")
    xhr_filter_regex = re.compile(xhr_filter_regex_str) if xhr_filter_regex_str else None
    # Slice-6: leak_filter_regex matches requests routed OFF-PLATFORM (XSS leak
    # vectors — e.g. attacker.example/leak callbacks fired by injected scripts).
    # Default matches anything NOT pointing at the local stack base.
    leak_filter_regex_str = step.get("leak_filter_regex")
    leak_filter_regex = re.compile(leak_filter_regex_str) if leak_filter_regex_str else None
    wait_until = step.get("wait_until", "networkidle")   # one of: load, domcontentloaded, networkidle, commit
    timeout_ms = step.get("timeout_ms", 30_000)

    xhr_urls: list[str] = []
    console_errors: list[str] = []
    dialog_messages: list[dict[str, str]] = []   # slice-6: page.on('dialog') captures
    leak_urls: list[str] = []                    # slice-6: page.on('request') matching leak filter
    page_status = None

    def match_xhr(url: str) -> bool:
        if xhr_filter_regex is not None:
            return bool(xhr_filter_regex.search(url))
        return xhr_filter_substr in url

    dom_html: str | None = None
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            try:
                context = browser.new_context(ignore_https_errors=True)
                page = context.new_page()

                page.on("request", lambda req: xhr_urls.append(req.url) if match_xhr(req.url) else None)
                page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

                # Slice-6: dialog hook captures alert/confirm/prompt firings —
                # the direct execution signal for script-based XSS. The handler
                # must dismiss the dialog or the page hangs.
                def _on_dialog(dialog):
                    try:
                        dialog_messages.append({"type": dialog.type, "message": dialog.message})
                    finally:
                        try:
                            dialog.dismiss()
                        except Exception:
                            pass
                page.on("dialog", _on_dialog)

                # Slice-6: leak-filter hook captures off-platform requests
                # (XSS exfil callbacks). Only enabled when leak_filter_regex
                # is set so unrelated probes don't pay for the comparison.
                if leak_filter_regex is not None:
                    def _on_leak_request(req):
                        if leak_filter_regex.search(req.url):
                            leak_urls.append(req.url)
                    page.on("request", _on_leak_request)

                response = page.goto(full_url, wait_until=wait_until, timeout=timeout_ms)
                page_status = response.status if response else None

                # Additional settle time after networkidle — some bug patterns
                # involve a delayed re-fetch fired by a state update (the
                # useEffect dep-array case). 1000ms post-settle is enough for
                # such patterns to surface.
                page.wait_for_timeout(step.get("post_settle_ms", 1000))

                # Slice-5: capture the post-settle DOM so observe steps can
                # assert against rendered content (browser_dom_query). The
                # DOM is captured AFTER post_settle_ms so client-side hydration
                # has produced its final visible markup.
                try:
                    dom_html = page.content()
                except Exception:
                    dom_html = None

                context.close()
            finally:
                browser.close()
    except Exception as exc:
        return {
            "success": False,
            "navigated_to": full_url,
            "xhr_count": len(xhr_urls),
            "xhr_urls_sample": xhr_urls[:10],
            "page_status": page_status,
            "console_errors": console_errors[:10],
            "dom_html_len": 0,
            "xss_dialog_count": len(dialog_messages),
            "xss_dialog_messages": dialog_messages,
            "xss_leak_count": len(leak_urls),
            "xss_leak_urls": leak_urls[:10],
            "error": f"{type(exc).__name__}: {exc}",
        }

    captures["_last_xhr_urls"] = xhr_urls
    captures["xhr_count"] = len(xhr_urls)
    captures["_last_page_status"] = page_status
    if dom_html is not None:
        captures["dom_html"] = dom_html
        captures["dom_html_len"] = len(dom_html)
    # Slice-6: expose dialog + leak captures for browser_events observe kind.
    captures["xss_dialog_count"] = len(dialog_messages)
    captures["xss_dialog_messages"] = dialog_messages
    captures["xss_leak_urls"] = leak_urls
    captures["xss_leak_count"] = len(leak_urls)
    captures["console_error_count"] = len(console_errors)
    captures["console_errors"] = console_errors

    return {
        "success": True,
        "navigated_to": full_url,
        "xhr_count": len(xhr_urls),
        "xhr_urls_sample": xhr_urls[:10],
        "page_status": page_status,
        "console_errors": console_errors[:10],
        "dom_html_len": len(dom_html) if dom_html else 0,
        "xss_dialog_count": len(dialog_messages),
        "xss_dialog_messages": dialog_messages,
        "xss_leak_count": len(leak_urls),
        "xss_leak_urls": leak_urls[:10],
        "error": None,
    }


def execute_act(steps: list[dict], *, captures: dict[str, Any], verbose: bool) -> list[StepOutcome]:
    outcomes: list[StepOutcome] = []
    for step in steps:
        kind = step.get("kind")
        count = step.get("count", 1)
        inter_step_pause_ms = step.get("inter_step_pause_ms", 0)
        latencies: list[float] = []
        for i in range(count):
            started = time.monotonic()
            started_at = now_iso()
            try:
                if kind == "rest":
                    method = step["method"].upper()
                    path = substitute_captures(step["path"], captures)
                    url = _resolve_base(step) + path
                    body = substitute_captures(step.get("body"), captures) if step.get("body") is not None else None
                    headers = step.get("headers", {})
                    r = requests.request(method, url, json=body, headers=headers, timeout=step.get("timeout", 30))
                    dur_ms = (time.monotonic() - started) * 1000
                    latencies.append(dur_ms)
                    captures["_last_response_status"] = r.status_code
                    captures["last_response_status"] = r.status_code   # public alias for assert namespace
                    try:
                        response_body = r.json()
                    except ValueError:
                        response_body = r.text
                    captures["_last_response_body"] = response_body
                    if "capture_as" in step:
                        captures[step["capture_as"]] = response_body
                    outcomes.append(StepOutcome(
                        kind="rest",
                        started_at=started_at,
                        duration_ms=int(dur_ms),
                        success=(200 <= r.status_code < 300) if not step.get("expect_any_status") else True,
                        detail={
                            "iteration": i,
                            "request": {"method": method, "url": url},
                            "response_status": r.status_code,
                            "response_size_bytes": len(r.content),
                            "response_body_excerpt": (r.text[:500] if not (200 <= r.status_code < 300) else None),
                        },
                        error=None if (200 <= r.status_code < 300 or step.get("expect_any_status")) else f"HTTP {r.status_code}: {r.text[:200]}",
                    ))
                elif kind == "browser":
                    # Headless Chromium via Playwright. Loads `path` against the
                    # local probe stack and measures network activity + page-ready.
                    # Captures the count of XHR requests to the backend API so
                    # probes can assert UI dispatch-multiplicity.
                    bo = _run_browser_step(step, captures=captures)
                    dur_ms = (time.monotonic() - started) * 1000
                    latencies.append(dur_ms)
                    outcomes.append(StepOutcome(
                        kind="browser",
                        started_at=started_at,
                        duration_ms=int(dur_ms),
                        success=bo["success"],
                        detail={
                            "iteration": i,
                            "navigated_to": bo["navigated_to"],
                            "xhr_count": bo["xhr_count"],
                            "xhr_urls_sample": bo["xhr_urls_sample"],
                            "page_status": bo["page_status"],
                            "console_errors": bo["console_errors"],
                            # Slice-6: surface XSS-execution telemetry in the
                            # per-act-step record so it lands in the probe-run
                            # artefact (not just in `captures`).
                            "xss_dialog_count": bo.get("xss_dialog_count", 0),
                            "xss_dialog_messages": bo.get("xss_dialog_messages", []),
                            "xss_leak_count": bo.get("xss_leak_count", 0),
                            "xss_leak_urls": bo.get("xss_leak_urls", []),
                        },
                        error=bo.get("error"),
                    ))
                else:
                    raise ValueError(f"act: unknown step kind {kind!r}")
            except Exception as exc:
                dur_ms = (time.monotonic() - started) * 1000
                outcomes.append(StepOutcome(
                    kind=kind or "unknown",
                    started_at=started_at,
                    duration_ms=int(dur_ms),
                    success=False,
                    detail={"step": step, "iteration": i},
                    error=f"{type(exc).__name__}: {exc}",
                ))
            if inter_step_pause_ms:
                time.sleep(inter_step_pause_ms / 1000.0)
        # Capture aggregated latency for the act step block under a fixed name
        if latencies:
            captures.setdefault("_act_latencies_ms", []).extend(latencies)
    return outcomes


def execute_observe(steps: list[dict], *, captures: dict[str, Any], verbose: bool) -> dict[str, Any]:
    observed: dict[str, Any] = {}
    for step in steps:
        kind = step.get("kind")
        try:
            if kind == "sql":
                rc, rows, stderr = docker_exec_sql(substitute_captures(step["query"], captures))
                if rc != 0:
                    observed[step.get("capture_as", "sql_unnamed")] = {"_error": stderr}
                    continue
                first_row = rows[0] if rows else {}
                if "capture_as" in step:
                    if len(first_row) == 1:
                        v = next(iter(first_row.values()))
                        # Try numeric coercion
                        try:
                            v = int(v)
                        except (ValueError, TypeError):
                            try:
                                v = float(v)
                            except (ValueError, TypeError):
                                pass
                        observed[step["capture_as"]] = v
                        captures[step["capture_as"]] = v
                    else:
                        observed[step["capture_as"]] = first_row
                        captures[step["capture_as"]] = first_row
            elif kind == "response_field":
                # Pull a captured response (from arrange or a previous step)
                source = captures.get(step.get("from"))
                if source is None:
                    observed[step.get("capture_as", "field_unnamed")] = {"_error": f"no captured response named {step.get('from')!r}"}
                    continue
                path = step["json_path"]
                value = jsonpath_simple(source, path)
                observed[step["capture_as"]] = value
                captures[step["capture_as"]] = value
            elif kind == "response_list_field":
                # Source is a list (or has a list at json_path); extract one
                # field from each item. Returns a list of field-values, suitable
                # for `target in extracted` membership assertions in safe_eval.
                source = captures.get(step.get("from"))
                if source is None:
                    observed[step.get("capture_as", "list_unnamed")] = {"_error": f"no captured response named {step.get('from')!r}"}
                    continue
                path = step.get("list_json_path", "$")
                items = jsonpath_simple(source, path)
                if not isinstance(items, list):
                    observed[step.get("capture_as", "list_unnamed")] = {"_error": f"list_json_path {path!r} did not resolve to a list (got {type(items).__name__})"}
                    continue
                field = step["item_field"]
                values = []
                for item in items:
                    if isinstance(item, dict) and field in item:
                        values.append(item[field])
                observed[step["capture_as"]] = values
                captures[step["capture_as"]] = values
            elif kind == "response_contains":
                # Cleaner alternative: directly observe whether a value appears in
                # a list-of-dicts response. Captures a boolean.
                source = captures.get(step.get("from"))
                if source is None:
                    observed[step.get("capture_as", "contains_unnamed")] = {"_error": f"no captured response named {step.get('from')!r}"}
                    continue
                items = source if isinstance(source, list) else jsonpath_simple(source, step.get("list_json_path", "$"))
                if not isinstance(items, list):
                    observed[step.get("capture_as", "contains_unnamed")] = {"_error": "not a list"}
                    continue
                field = step["item_field"]
                target = step["target_value"]
                found = any(isinstance(it, dict) and it.get(field) == target for it in items)
                observed[step["capture_as"]] = found
                captures[step["capture_as"]] = found
            elif kind == "latency_distribution":
                latencies = captures.get("_act_latencies_ms", [])
                if not latencies:
                    observed[step.get("capture_as", "latency_unnamed")] = {"_error": "no act-step latencies captured"}
                    continue
                pcts = step.get("capture_percentiles", ["p50", "p95", "p99"])
                summary = compute_percentiles(latencies, pcts)
                observed[step["capture_as"]] = summary
                captures[step["capture_as"]] = summary
            elif kind == "browser_events":
                # Slice-6: read the Playwright-captured events (dialog firings +
                # off-platform leak requests) into observe outputs so probes can
                # explicitly state which event they're asserting on. The browser
                # act step already places these into captures under fixed names;
                # this observe kind copies them into the observed dict + lets the
                # probe alias them via capture_as.
                event_kind = step.get("event")   # "dialog" | "leak" | "console_error"
                src_map = {
                    "dialog": ("xss_dialog_count", "xss_dialog_messages"),
                    "leak":   ("xss_leak_count",   "xss_leak_urls"),
                    "console_error": ("console_error_count", "console_errors"),
                }
                if event_kind not in src_map:
                    observed[step.get("capture_as", "browser_events_unnamed")] = {
                        "_error": f"browser_events: unknown event {event_kind!r}; allowed: {sorted(src_map)}"
                    }
                    continue
                count_key, list_key = src_map[event_kind]
                count = captures.get(count_key, 0)
                values = captures.get(list_key, [])
                observed[step["capture_as"]] = count
                captures[step["capture_as"]] = count
                # Also expose a *_messages or *_urls list alias if requested.
                if "capture_list_as" in step:
                    observed[step["capture_list_as"]] = values
                    captures[step["capture_list_as"]] = values
            elif kind == "browser_dom_query":
                # Assert against the DOM captured by a preceding `browser` act
                # step. Slice-5 introduction: enables real UI-render-side
                # checks (e.g. "is the dangerous <script> tag present in the
                # rendered page?").
                #
                # Two query modes:
                #   - `text_contains: "<substr>"` — substring presence check.
                #     Captures a boolean. Use for "is X in the rendered DOM?"
                #   - `text_count: "<substr>"` — count of occurrences.
                #     Captures an int. Use for "how many times does X appear?"
                #
                # Source is `from: <capture-name>` (defaults to `dom_html`,
                # the post-settle DOM captured by the most recent browser step).
                src_name = step.get("from", "dom_html")
                source = captures.get(src_name)
                if source is None:
                    observed[step.get("capture_as", f"dom_query_{src_name}")] = {
                        "_error": f"no captured DOM named {src_name!r} (run a `browser` act step first)"
                    }
                    continue
                if not isinstance(source, str):
                    observed[step.get("capture_as", f"dom_query_{src_name}")] = {
                        "_error": f"capture {src_name!r} is {type(source).__name__}, not str"
                    }
                    continue
                if "text_contains" in step:
                    needle = step["text_contains"]
                    present = needle in source
                    observed[step["capture_as"]] = present
                    captures[step["capture_as"]] = present
                elif "text_count" in step:
                    needle = step["text_count"]
                    n = source.count(needle)
                    observed[step["capture_as"]] = n
                    captures[step["capture_as"]] = n
                else:
                    observed[step.get("capture_as", "dom_query_unnamed")] = {
                        "_error": "browser_dom_query needs either text_contains or text_count"
                    }
            else:
                observed[step.get("capture_as", f"unknown_{kind}")] = {"_error": f"unknown observe step kind {kind!r}"}
        except Exception as exc:
            observed[step.get("capture_as", f"err_{kind}")] = {"_error": f"{type(exc).__name__}: {exc}"}
    return observed


def execute_assert(asserts: list[str], *, captures: dict[str, Any], observed: dict[str, Any]) -> list[dict[str, Any]]:
    """Evaluate each assert expression in a restricted namespace.

    The namespace contains: every captured value + the observed dict.
    Evaluation uses a sandboxed eval — only literals, comparisons, arithmetic,
    boolean ops, attribute access on captured values. NO function calls,
    NO imports.
    """
    results: list[dict[str, Any]] = []
    namespace = {**captures, **observed}
    # Strip private leading underscores from namespace for assert convenience
    namespace = {k: v for k, v in namespace.items() if not k.startswith("_")}
    for expr in asserts:
        try:
            # Use a safe eval — restrict __builtins__
            value = safe_eval(expr, namespace)
            results.append({"expr": expr, "passed": bool(value), "value": value})
        except Exception as exc:
            results.append({"expr": expr, "passed": False, "error": f"{type(exc).__name__}: {exc}"})
    return results


# ============================================================================
# Safe eval + minimal jsonpath
# ============================================================================

_SAFE_AST_NODES = None

def _init_safe_ast():
    global _SAFE_AST_NODES
    import ast
    _SAFE_AST_NODES = {
        ast.Expression, ast.BoolOp, ast.BinOp, ast.UnaryOp, ast.Compare,
        ast.Name, ast.Load, ast.Constant, ast.Num, ast.Str,
        ast.And, ast.Or, ast.Not, ast.Eq, ast.NotEq, ast.Lt, ast.LtE,
        ast.Gt, ast.GtE, ast.In, ast.NotIn, ast.Is, ast.IsNot,
        ast.Add, ast.Sub, ast.Mult, ast.Div, ast.FloorDiv, ast.Mod, ast.Pow,
        ast.Subscript, ast.Index, ast.Slice,
        ast.Attribute,
        ast.List, ast.Tuple, ast.Dict,
        ast.USub, ast.UAdd,
    }


def safe_eval(expr: str, namespace: dict[str, Any]) -> Any:
    """Evaluate an arithmetic / comparison / membership expression.

    Refuses anything that requires function calls or imports.
    """
    import ast
    if _SAFE_AST_NODES is None:
        _init_safe_ast()
    tree = ast.parse(expr, mode="eval")
    for node in ast.walk(tree):
        if type(node) not in _SAFE_AST_NODES:
            raise ValueError(f"safe_eval: disallowed AST node {type(node).__name__} in expr {expr!r}")
    return eval(compile(tree, "<assert>", "eval"), {"__builtins__": {}}, dict(namespace))


def jsonpath_simple(source: Any, path: str) -> Any:
    """Tiny jsonpath subset: $.foo, $.foo.bar, $.list[0], $.list[*].id.

    Sufficient for the slice-2 probe set; replace with a proper jsonpath
    library in slice 3+ if needed.
    """
    if not path.startswith("$"):
        raise ValueError(f"jsonpath must start with $, got {path!r}")
    cur = source
    # Strip leading $
    remainder = path[1:]
    if remainder.startswith("."):
        remainder = remainder[1:]
    if not remainder:
        return cur
    parts = re.split(r"\.(?![^\[]*\])", remainder)
    for part in parts:
        if not part:
            continue
        # Handle [n] or [*]
        m = re.match(r"^([^\[\]]+)(\[(.*?)\])?$", part)
        if not m:
            raise ValueError(f"jsonpath: cannot parse part {part!r} in {path!r}")
        key, _, idx = m.groups()
        if isinstance(cur, dict):
            cur = cur.get(key)
        else:
            raise ValueError(f"jsonpath: expected dict for {key!r}, got {type(cur).__name__}")
        if idx is not None:
            if idx == "*":
                # Return list of all elements (caller handles)
                if not isinstance(cur, list):
                    raise ValueError(f"jsonpath: [*] expects list, got {type(cur).__name__}")
                # Continue without further descent
                return cur
            cur = cur[int(idx)]
    return cur


def substitute_captures(template: Any, captures: dict[str, Any]) -> Any:
    """Replace ${var} with captures[var]. Missing → KeyError.

    Recursive over dicts and lists. For string templates that are EXACTLY a
    single ${var} (no surrounding text), returns the captured value with its
    original type preserved (int / float / bool / None). Otherwise stringifies.
    """
    if isinstance(template, dict):
        return {k: substitute_captures(v, captures) for k, v in template.items()}
    if isinstance(template, list):
        return [substitute_captures(v, captures) for v in template]
    if not isinstance(template, str):
        return template

    # Whole-string substitution: preserve type.
    m_whole = re.fullmatch(r"\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}", template)
    if m_whole:
        name = m_whole.group(1)
        if name not in captures:
            raise KeyError(f"substitute_captures: missing {name!r}; available: {sorted(captures)}")
        return captures[name]

    # Partial substitution within a string: stringify each placeholder.
    def replacer(m: re.Match) -> str:
        name = m.group(1)
        if name not in captures:
            raise KeyError(f"substitute_captures: missing {name!r}; available: {sorted(captures)}")
        return str(captures[name])
    return re.sub(r"\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}", replacer, template)


def compute_percentiles(values: list[float], pcts: list[str]) -> dict[str, float]:
    if not values:
        return {}
    sorted_v = sorted(values)
    n = len(sorted_v)
    out = {}
    for p in pcts:
        match = re.match(r"^p(\d+)$", p)
        if not match:
            continue
        pct = int(match.group(1))
        idx = min(n - 1, int(round(pct / 100.0 * n)) - 1)
        idx = max(0, idx)
        out[p] = round(sorted_v[idx], 2)
    out["count"] = n
    out["min"] = round(sorted_v[0], 2)
    out["max"] = round(sorted_v[-1], 2)
    out["mean"] = round(sum(sorted_v) / n, 2)
    return out


# ============================================================================
# Validation — Rule 4 (probe scope declared on write)
# ============================================================================

def validate_probe(probe: dict) -> list[str]:
    """Return list of validation errors. Empty list = probe is well-formed.

    Slice 2: enforce required fields + ensure each step's `kind` is in the
    allowed set + verify stack_profile is registered.
    """
    errors: list[str] = []
    required = ["probe_id", "feature_id", "test_class", "stack_profile", "act", "assert"]
    for f in required:
        if f not in probe:
            errors.append(f"missing required field: {f!r}")
    if probe.get("stack_profile") and probe["stack_profile"] not in STACK_PROFILES:
        errors.append(f"unknown stack_profile {probe['stack_profile']!r}; allowed: {sorted(STACK_PROFILES)}")
    allowed_kinds_arrange = {"docker-compose-up", "sql", "rest", "config_override"}
    allowed_kinds_act = {"rest", "browser"}
    allowed_kinds_observe = {"sql", "response_field", "response_list_field", "response_contains", "latency_distribution", "browser_dom_query", "browser_events"}
    for i, step in enumerate(probe.get("arrange", [])):
        if step.get("kind") not in allowed_kinds_arrange:
            errors.append(f"arrange[{i}]: kind {step.get('kind')!r} not allowed")
    for i, step in enumerate(probe.get("act", [])):
        if step.get("kind") not in allowed_kinds_act:
            errors.append(f"act[{i}]: kind {step.get('kind')!r} not allowed")
    for i, step in enumerate(probe.get("observe", [])):
        if step.get("kind") not in allowed_kinds_observe:
            errors.append(f"observe[{i}]: kind {step.get('kind')!r} not allowed")
    return errors


# ============================================================================
# Probe loading + run orchestration
# ============================================================================

def parse_probe_yaml(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    # Front-matter style: --- ... --- + body (body ignored for execution)
    if text.lstrip().startswith("---"):
        # Split at second ---
        parts = text.split("---", 2)
        if len(parts) < 3:
            raise ValueError(f"probe yaml: malformed front-matter in {path}")
        front = yaml.safe_load(parts[1])
        # The execution-relevant blocks live in the body as a YAML doc too
        body = yaml.safe_load(parts[2]) if parts[2].strip() else {}
        merged = {**(front or {}), **(body or {})}
        return merged
    return yaml.safe_load(text) or {}


def run_probe(probe_path: Path, *, workspace_root: Path, verbose: bool = False, dry_run: bool = False) -> ProbeRun:
    probe = parse_probe_yaml(probe_path)
    errors = validate_probe(probe)
    if errors:
        return ProbeRun(
            probe_run_id="<invalid>",
            probe_id=probe.get("probe_id", "<unknown>"),
            feature_id=probe.get("feature_id"),
            test_class=probe.get("test_class", "<unknown>"),
            ran_at=now_iso(),
            ran_against_substrate_commit=probe.get("verified_against_commit"),
            ran_against_docker_compose_tag="<n/a>",
            stack_profile=probe.get("stack_profile", "<n/a>"),
            outcome="SCOPE_VIOLATION",
            verdict_reason=f"validation errors: {errors}",
        )

    stack_dir = workspace_root / "lineage" / "_extractor" / "probe-stacks"
    compose_file = compose_path_for_profile(probe["stack_profile"], stack_dir=stack_dir)
    run_id = f"R-{dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ')}-{probe['probe_id']}"

    if dry_run:
        return ProbeRun(
            probe_run_id=run_id,
            probe_id=probe["probe_id"],
            feature_id=probe.get("feature_id"),
            test_class=probe["test_class"],
            ran_at=now_iso(),
            ran_against_substrate_commit=probe.get("verified_against_commit"),
            ran_against_docker_compose_tag=str(compose_file.name),
            stack_profile=probe["stack_profile"],
            outcome="DRY-RUN-OK",
            verdict_reason=f"probe validates; would execute against {compose_file}",
        )

    start = time.monotonic()
    run = ProbeRun(
        probe_run_id=run_id,
        probe_id=probe["probe_id"],
        feature_id=probe.get("feature_id"),
        test_class=probe["test_class"],
        ran_at=now_iso(),
        ran_against_substrate_commit=probe.get("verified_against_commit"),
        ran_against_docker_compose_tag=str(compose_file.name),
        stack_profile=probe["stack_profile"],
    )
    captures: dict[str, Any] = {}

    # ---- arrange ----
    arrange_steps = probe.get("arrange", [])
    run.arrange_outcomes = execute_arrange(arrange_steps, compose_file, captures=captures, verbose=verbose)
    if any(not o.success for o in run.arrange_outcomes):
        run.outcome = "ERROR"
        run.verdict_reason = "arrange step failed; see arrange_outcomes for details"
        run.cleanup_outcomes = [stack_down(compose_file, destroy_volumes=True, verbose=verbose)]
        run.total_duration_ms = int((time.monotonic() - start) * 1000)
        return run

    # ---- act ----
    run.act_outcomes = execute_act(probe.get("act", []), captures=captures, verbose=verbose)
    if any(not o.success for o in run.act_outcomes):
        run.outcome = "ERROR"
        run.verdict_reason = "act step failed; see act_outcomes for details"
        run.cleanup_outcomes = [stack_down(compose_file, destroy_volumes=True, verbose=verbose)]
        run.total_duration_ms = int((time.monotonic() - start) * 1000)
        return run

    # ---- observe ----
    run.observe_outcomes = execute_observe(probe.get("observe", []), captures=captures, verbose=verbose)

    # ---- assert ----
    run.assert_outcomes = execute_assert(probe.get("assert", []), captures=captures, observed=run.observe_outcomes)
    failed = [a for a in run.assert_outcomes if not a.get("passed")]
    if failed:
        run.outcome = "FAIL"
        run.verdict_reason = f"{len(failed)} assert(s) failed; first: {failed[0]['expr']!r}"
    else:
        run.outcome = "PASS"
        run.verdict_reason = "all assertions passed"

    # ---- cleanup ----
    cleanup_steps = probe.get("cleanup", [{"kind": "docker-compose-down", "destroy_volumes": True}])
    for step in cleanup_steps:
        if step.get("kind") == "docker-compose-down":
            run.cleanup_outcomes.append(stack_down(compose_file, destroy_volumes=step.get("destroy_volumes", True), verbose=verbose))
    run.total_duration_ms = int((time.monotonic() - start) * 1000)
    return run


def write_probe_run(run: ProbeRun, *, workspace_root: Path, repo: str) -> Path:
    runs_dir = workspace_root / PROBE_RUNS_DIR_TEMPLATE.format(repo=repo)
    runs_dir.mkdir(parents=True, exist_ok=True)
    out_path = runs_dir / f"{dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%d')}-{run.probe_id}.yaml"
    payload = {
        "probe_run_id": run.probe_run_id,
        "probe_id": run.probe_id,
        "feature_id": run.feature_id,
        "test_class": run.test_class,
        "ran_at": run.ran_at,
        "ran_against_substrate_commit": run.ran_against_substrate_commit,
        "ran_against_docker_compose_tag": run.ran_against_docker_compose_tag,
        "stack_profile": run.stack_profile,
        "outcome": run.outcome,
        "verdict_reason": run.verdict_reason,
        "total_duration_ms": run.total_duration_ms,
        "arrange_outcomes": [step_outcome_to_dict(o) for o in run.arrange_outcomes],
        "act_outcomes_summary": {
            "count": len(run.act_outcomes),
            "success_count": sum(1 for o in run.act_outcomes if o.success),
            "fail_count": sum(1 for o in run.act_outcomes if not o.success),
            "first_failure": next((step_outcome_to_dict(o) for o in run.act_outcomes if not o.success), None),
            "latency_ms_summary": compute_percentiles([o.duration_ms for o in run.act_outcomes], ["p50", "p95", "p99"]),
        },
        "observe_outcomes": run.observe_outcomes,
        "assert_outcomes": run.assert_outcomes,
        "cleanup_outcomes": [step_outcome_to_dict(o) for o in run.cleanup_outcomes],
        "artefacts_updated": run.artefacts_updated,
    }
    out_path.write_text(yaml.safe_dump(payload, sort_keys=False, default_flow_style=False), encoding="utf-8")
    return out_path


def step_outcome_to_dict(o: StepOutcome) -> dict:
    return {
        "kind": o.kind,
        "started_at": o.started_at,
        "duration_ms": o.duration_ms,
        "success": o.success,
        "detail": o.detail,
        "error": o.error,
    }


# ============================================================================
# Batch mode — shared docker-compose lifecycle across multiple probes
# Per dynamic-verification ADR slice 5 prep. Cuts ~50s of per-probe overhead.
# ============================================================================

def run_probe_batch(
    probe_ids: list[str],
    *,
    workspace_root: Path,
    repo: str,
    verbose: bool = False,
) -> list[ProbeRun]:
    """Run multiple probes against a single shared stack lifecycle.

    All probes must share the same stack_profile. The runner brings the stack
    up once, runs each probe's arrange (skipping docker-compose-up steps),
    act, observe, assert, then runs each probe's cleanup (skipping docker-
    compose-down). Tears the stack down once at the end.

    Seed IDs must be unique across probes (slice-2 probes use 100N where
    N is the probe number; convention).
    """
    if not probe_ids:
        return []

    # Resolve + parse all probes; validate; group by stack_profile.
    probes_data: list[tuple[str, Path, dict]] = []
    profiles_seen: set[str] = set()
    for pid in probe_ids:
        probe_path = workspace_root / PROBES_DIR_TEMPLATE.format(repo=repo) / f"{pid}.yaml"
        if not probe_path.is_file():
            raise FileNotFoundError(f"probe file not found: {probe_path}")
        probe = parse_probe_yaml(probe_path)
        errors = validate_probe(probe)
        if errors:
            raise ValueError(f"probe {pid} validation errors: {errors}")
        probes_data.append((pid, probe_path, probe))
        profiles_seen.add(probe.get("stack_profile", "odd-minimal"))

    if len(profiles_seen) != 1:
        raise ValueError(f"all probes in a batch must share a stack_profile; got {profiles_seen!r}")

    stack_profile = profiles_seen.pop()
    compose_file = compose_path_for_profile(stack_profile, stack_dir=workspace_root / "lineage" / "_extractor" / "probe-stacks")

    if verbose:
        print(f"[batch] {len(probes_data)} probes, shared profile {stack_profile!r}", file=sys.stderr)

    # Bring the stack up ONCE
    if verbose:
        print(f"[batch] bringing stack up: {compose_file}", file=sys.stderr)
    shared_up = stack_up(compose_file, verbose=verbose)
    if not shared_up.success:
        # Each probe gets an ERROR run noting the shared-up failure.
        runs: list[ProbeRun] = []
        for pid, _, probe in probes_data:
            run = ProbeRun(
                probe_run_id=f"R-{dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ')}-{pid}",
                probe_id=pid,
                feature_id=probe.get("feature_id"),
                test_class=probe.get("test_class", "<unknown>"),
                ran_at=now_iso(),
                ran_against_substrate_commit=probe.get("verified_against_commit"),
                ran_against_docker_compose_tag=str(compose_file.name),
                stack_profile=stack_profile,
                outcome="ERROR",
                verdict_reason="shared stack failed to come up (batch aborted)",
                arrange_outcomes=[shared_up],
            )
            runs.append(run)
        return runs

    shared_ready = stack_wait_healthy(verbose=verbose)
    if not shared_ready.success:
        stack_down(compose_file, destroy_volumes=True, verbose=verbose)
        runs = []
        for pid, _, probe in probes_data:
            run = ProbeRun(
                probe_run_id=f"R-{dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ')}-{pid}",
                probe_id=pid,
                feature_id=probe.get("feature_id"),
                test_class=probe.get("test_class", "<unknown>"),
                ran_at=now_iso(),
                ran_against_substrate_commit=probe.get("verified_against_commit"),
                ran_against_docker_compose_tag=str(compose_file.name),
                stack_profile=stack_profile,
                outcome="ERROR",
                verdict_reason="shared stack did not become healthy (batch aborted)",
                arrange_outcomes=[shared_up, shared_ready],
            )
            runs.append(run)
        return runs

    # Run each probe (filter out their docker-compose-up/down steps).
    runs: list[ProbeRun] = []
    for pid, probe_path, probe in probes_data:
        if verbose:
            print(f"[batch] running {pid}", file=sys.stderr)
        run_id = f"R-{dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ')}-{pid}"
        captures: dict[str, Any] = {}
        run = ProbeRun(
            probe_run_id=run_id,
            probe_id=pid,
            feature_id=probe.get("feature_id"),
            test_class=probe["test_class"],
            ran_at=now_iso(),
            ran_against_substrate_commit=probe.get("verified_against_commit"),
            ran_against_docker_compose_tag=str(compose_file.name),
            stack_profile=stack_profile,
        )
        # Pre-pend the shared-up outcomes so each run records that it shared a stack.
        run.arrange_outcomes = [shared_up, shared_ready]

        # Filter out docker-compose-up steps from arrange (shared lifecycle handles it)
        arrange_steps = [s for s in probe.get("arrange", []) if s.get("kind") != "docker-compose-up"]
        run.arrange_outcomes += execute_arrange(arrange_steps, compose_file, captures=captures, verbose=verbose)
        # Only mark batch-arrange as failed for steps that aren't the shared-up duplicates.
        arrange_per_probe = run.arrange_outcomes[2:]
        if any(not o.success for o in arrange_per_probe):
            run.outcome = "ERROR"
            run.verdict_reason = "arrange step failed in batch context"
            runs.append(run)
            continue

        # act
        run.act_outcomes = execute_act(probe.get("act", []), captures=captures, verbose=verbose)
        if any(not o.success for o in run.act_outcomes):
            run.outcome = "ERROR"
            run.verdict_reason = "act step failed in batch context"
            runs.append(run)
            continue

        # observe + assert
        run.observe_outcomes = execute_observe(probe.get("observe", []), captures=captures, verbose=verbose)
        run.assert_outcomes = execute_assert(probe.get("assert", []), captures=captures, observed=run.observe_outcomes)
        failed = [a for a in run.assert_outcomes if not a.get("passed")]
        if failed:
            run.outcome = "FAIL"
            run.verdict_reason = f"{len(failed)} assert(s) failed; first: {failed[0]['expr']!r}"
        else:
            run.outcome = "PASS"
            run.verdict_reason = "all assertions passed"

        # Skip docker-compose-down in cleanup (shared lifecycle handles it).
        cleanup_steps_filtered = [s for s in probe.get("cleanup", []) if s.get("kind") != "docker-compose-down"]
        # In slice-4 the only cleanup kind beyond docker-compose-down isn't yet defined;
        # leave the door open for future cleanup actions.
        run.cleanup_outcomes = []  # nothing to do per-probe in batch mode
        runs.append(run)

    # Tear down the shared stack
    if verbose:
        print(f"[batch] tearing down shared stack", file=sys.stderr)
    shared_down = stack_down(compose_file, destroy_volumes=True, verbose=verbose)
    for run in runs:
        run.cleanup_outcomes.append(shared_down)

    return runs


# ============================================================================
# Sidecar confidence merge — feeds measured truth back into per-node sidecars
# Per dynamic-verification ADR Rule 4. Closes the layer-5 → layer-2 loop.
# ============================================================================

def _node_id_to_sidecar_slug(node_id: str) -> str:
    """Convert a substrate node_id to its sidecar filename slug.

    Format: spaces and colons → double underscores.
    `odd-platform java DataEntityController controller-method:getDataEntityDetails`
    → `odd-platform__java__DataEntityController__controller-method__getDataEntityDetails`
    """
    return node_id.replace(" ", "__").replace(":", "__")


def merge_probe_into_sidecars(
    run: ProbeRun,
    *,
    workspace_root: Path,
    repo: str,
    verbose: bool = False,
) -> list[Path]:
    """Append a `## probe_verifications` entry to each contributing sidecar.

    Reads feature-flows.yaml; finds the feature matching run.feature_id; walks
    contributing_nodes; for each resolved node (sidecar exists on disk),
    appends a structured entry. Skips UNRESOLVED placeholders.

    Returns the list of sidecar paths that were updated. Side-effect-free if
    the run's outcome is not in {PASS, FAIL} or feature-flows.yaml is missing.
    """
    if run.outcome not in {"PASS", "FAIL"}:
        return []
    if not run.feature_id:
        return []

    feature_flows_path = workspace_root / "lineage" / repo / "feature-flows.yaml"
    if not feature_flows_path.is_file():
        return []

    try:
        ff_docs = list(yaml.safe_load_all(feature_flows_path.read_text(encoding="utf-8")))
    except yaml.YAMLError as exc:
        if verbose:
            print(f"[runner] WARNING: feature-flows.yaml parse error: {exc}", file=sys.stderr)
        return []

    # feature-flows.yaml has 2 docs: frontmatter + body
    body = ff_docs[1] if len(ff_docs) > 1 else {}
    features = body.get("features", [])
    feature = next((f for f in features if f.get("feature_id") == run.feature_id), None)
    if feature is None:
        if verbose:
            print(f"[runner] feature {run.feature_id} not in feature-flows.yaml; skipping sidecar merge", file=sys.stderr)
        return []

    sidecar_dir = workspace_root / "lineage" / repo / "understanding"
    updated_paths: list[Path] = []

    # Parse contributing_nodes to extract the node_id portion (strip parenthetical notes).
    # Format examples:
    #   "odd-platform java DataEntityController controller-method:getDataEntityDetails"
    #   "odd-platform java DataEntityController controller-method:getDataEntityDetails (note)"
    #   "ts react-component:DataEntityDetails.tsx (UNRESOLVED — sidecar not yet enriched; ref only)"
    for raw in feature.get("contributing_nodes", []):
        if not isinstance(raw, str):
            continue
        node_id = re.sub(r"\s*\([^)]*\)\s*$", "", raw).strip()
        # Skip references that are clearly UNRESOLVED in the raw notation
        if "UNRESOLVED" in raw or "not yet enriched" in raw:
            continue
        slug = _node_id_to_sidecar_slug(node_id) + ".md"
        sidecar_path = sidecar_dir / slug
        if not sidecar_path.is_file():
            if verbose:
                print(f"[runner] sidecar not found, skipping: {slug}", file=sys.stderr)
            continue

        # Append the verification entry
        verdict_escaped = yaml.safe_dump(run.verdict_reason, default_style='"').strip()
        verification_entry = (
            f"- probe_id: {run.probe_id}\n"
            f"  probe_run_id: {run.probe_run_id}\n"
            f"  outcome: {run.outcome}\n"
            f"  test_class: {run.test_class}\n"
            f"  feature_id: {run.feature_id}\n"
            f"  ran_at: {run.ran_at}\n"
            f"  verdict: {verdict_escaped}\n"
        )

        sidecar_text = sidecar_path.read_text(encoding="utf-8")
        if "## probe_verifications" in sidecar_text:
            # Idempotency: if this exact probe_run_id is already recorded, skip.
            if run.probe_run_id in sidecar_text:
                continue
            # Append the entry inside the existing section. We append AFTER the
            # section header + any existing entries — simplest: insert before the
            # NEXT top-level `##` header OR at file end.
            section_idx = sidecar_text.index("## probe_verifications")
            # Find the next top-level `##` after this section, or EOF
            next_section_match = re.search(r"\n## ", sidecar_text[section_idx + 1:])
            if next_section_match:
                insert_at = section_idx + 1 + next_section_match.start()
                new_text = sidecar_text[:insert_at] + verification_entry + sidecar_text[insert_at:]
            else:
                # Append at file end
                new_text = sidecar_text.rstrip() + "\n" + verification_entry
        else:
            # Section doesn't exist; create it at the end of the file
            section_header = (
                "\n## probe_verifications\n\n"
                "<!-- Auto-managed by lineage/_extractor/probe-runtime/runner.py — "
                "appended after each layer-5 probe-run that touches this node's "
                "contributing-features. Each entry cites a probe-run artefact "
                "under lineage/{repo}/probe-runs/. Per dynamic-verification ADR Rule 4. -->\n\n"
            )
            new_text = sidecar_text.rstrip() + "\n" + section_header + verification_entry

        sidecar_path.write_text(new_text, encoding="utf-8")
        updated_paths.append(sidecar_path)
        if verbose:
            print(f"[runner] merged probe-verification into {slug}", file=sys.stderr)

    return updated_paths


# ============================================================================
# Slice-6: substrate staleness gate (dynamic-verification ADR Rule 5).
# A probe's `verified_against_commit` must equal (or lag by ≤ STALE_THRESHOLD)
# the substrate's current `last_scan_commit`. The runner refuses to execute
# stale probes unless --allow-stale is set. The staleness count comes from
# `git rev-list --count <probe-commit>..<substrate-commit>` in the substrate's
# source repo. If the repo isn't reachable (LOCAL-ONLY operation; no remote
# clone forced), the gate degrades to "commits-match-or-warn".
# ============================================================================

STALE_THRESHOLD_DEFAULT = 5


def read_substrate_last_scan_commit(workspace_root: Path, repo: str) -> str | None:
    manifest_path = workspace_root / "lineage" / repo / "manifest.yaml"
    if not manifest_path.is_file():
        return None
    text = manifest_path.read_text(encoding="utf-8")
    m = re.search(r"^\s*last_scan_commit:\s*([0-9a-f]+)\s*$", text, re.MULTILINE)
    return m.group(1) if m else None


def measure_commit_lag(
    probe_commit: str,
    substrate_commit: str,
    *,
    source_repo_path: Path,
) -> int | None:
    """Count commits between probe_commit and substrate_commit (exclusive .. inclusive).

    Returns None if either commit is unreachable in the source repo, or if
    the source repo doesn't exist on disk (local-only — never clone remote).
    Returns 0 if commits match.
    """
    if probe_commit == substrate_commit:
        return 0
    if not source_repo_path.is_dir():
        return None
    # `git` is a safe local-binary verb (not in ALLOWED_VERBS because that gate
    # is for stack-touching commands; this is a read-only history query).
    try:
        proc = subprocess.run(
            ["git", "-C", str(source_repo_path), "rev-list", "--count",
             f"{probe_commit}..{substrate_commit}"],
            capture_output=True, text=True, timeout=10, check=False,
        )
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return None
    if proc.returncode != 0:
        return None
    try:
        return int(proc.stdout.strip())
    except ValueError:
        return None


def evaluate_probe_staleness(
    probe: dict,
    *,
    workspace_root: Path,
    repo: str,
    threshold: int = STALE_THRESHOLD_DEFAULT,
) -> dict[str, Any]:
    """Return a staleness verdict dict.

    Shape:
      {
        "probe_commit": "<sha or null>",
        "substrate_commit": "<sha or null>",
        "lag_commits": <int or null>,
        "is_stale": bool,
        "reason": str (one-line summary)
      }

    A None lag means we couldn't measure (substrate source repo not on disk);
    that's NOT stale — the gate is informational in that case.
    """
    probe_commit = probe.get("verified_against_commit")
    substrate_commit = read_substrate_last_scan_commit(workspace_root, repo)
    source_repo_path = workspace_root.parent / repo
    if not probe_commit:
        return {
            "probe_commit": None, "substrate_commit": substrate_commit,
            "lag_commits": None, "is_stale": True,
            "reason": "probe has no verified_against_commit",
        }
    if not substrate_commit:
        return {
            "probe_commit": probe_commit, "substrate_commit": None,
            "lag_commits": None, "is_stale": False,
            "reason": "substrate manifest.yaml missing last_scan_commit; staleness undetermined",
        }
    lag = measure_commit_lag(probe_commit, substrate_commit, source_repo_path=source_repo_path)
    if lag is None:
        return {
            "probe_commit": probe_commit, "substrate_commit": substrate_commit,
            "lag_commits": None, "is_stale": False,
            "reason": f"source repo {source_repo_path} not on disk; staleness undetermined",
        }
    return {
        "probe_commit": probe_commit, "substrate_commit": substrate_commit,
        "lag_commits": lag, "is_stale": lag > threshold,
        "reason": (
            f"probe at {probe_commit[:8]} lags substrate {substrate_commit[:8]} by "
            f"{lag} commits (threshold={threshold})"
        ),
    }


# ============================================================================
# Slice-6: feature-flows.yaml probe-stamp merge.
# Parallel to the slice-4 sidecar merge: after each PASS/FAIL probe-run, the
# runner appends a `probe_verifications:` entry to the matching feature's
# block in feature-flows.yaml. The maintainer keeps authoring narrative
# facets manually; the auto-stamp is the audit trail (run-IDs, outcomes,
# test-classes empirically covered).
#
# Per dynamic-verification ADR slice-5 "feature-flows.yaml updates" spec:
#   "After a probe run, the orchestrator merges measured values into the
#    static artefacts."
# Slice 6 lands this for feature-flows.yaml. Test-map.yaml automation is
# deferred to slice 7+ (currently maintainer-authored).
#
# The merge operates on raw YAML text (not parsed-and-rewritten) to preserve
# comments, key order, and the maintainer's manual structure. We insert a
# `    probe_verifications:` block inside the matching feature's mapping;
# if the block already exists, we append (or skip if probe_run_id is already
# present — idempotency).
# ============================================================================

def merge_probe_into_feature_flows(
    run: ProbeRun,
    *,
    workspace_root: Path,
    repo: str,
    verbose: bool = False,
) -> Path | None:
    """Append a probe_verifications entry to the matching feature in feature-flows.yaml.

    Returns the file path if appended; None if the file is missing OR the
    feature isn't present OR the run outcome is not in {PASS, FAIL}.
    """
    if run.outcome not in {"PASS", "FAIL"}:
        return None
    if not run.feature_id:
        return None

    ff_path = workspace_root / "lineage" / repo / "feature-flows.yaml"
    if not ff_path.is_file():
        return None

    text = ff_path.read_text(encoding="utf-8")

    # Locate the feature entry: "  - feature_id: F-NNN"
    feature_marker = f"  - feature_id: {run.feature_id}"
    f_start = text.find(feature_marker)
    if f_start == -1:
        if verbose:
            print(f"[runner] feature {run.feature_id} not in feature-flows.yaml; skipping merge", file=sys.stderr)
        return None

    # The feature block runs from f_start to the next "  - feature_id: " OR EOF.
    next_feature = text.find("\n  - feature_id: ", f_start + len(feature_marker))
    f_end = next_feature if next_feature != -1 else len(text)
    feature_block = text[f_start:f_end]

    # Replace-by-probe-id semantic: feature_flows.yaml carries the CURRENT measured
    # state per probe; probe-runs/ holds the full run history. If this probe_id
    # already has an entry for this feature, drop the old one before appending
    # the fresh one. (Drops by probe_id, not by probe_run_id — the run_id is
    # timestamp-based and changes every run.)
    old_entry_pattern = re.compile(
        r"      - probe_id: " + re.escape(run.probe_id) + r"\n"
        r"(?:        [^\n]*\n)+",
        re.MULTILINE,
    )
    feature_block, n_removed = old_entry_pattern.subn("", feature_block)
    if n_removed > 0 and verbose:
        print(f"[runner] feature-flows: replacing {n_removed} prior entry for {run.probe_id}", file=sys.stderr)

    # Compose the new entry (4-space indent for the list item under the
    # feature's `probe_verifications:` key at 4-space indent).
    verdict_escaped = yaml.safe_dump(run.verdict_reason, default_style='"').strip()
    entry_lines = [
        f"      - probe_id: {run.probe_id}",
        f"        probe_run_id: {run.probe_run_id}",
        f"        outcome: {run.outcome}",
        f"        test_class: {run.test_class}",
        f"        ran_at: {run.ran_at}",
        f"        ran_against_substrate_commit: {run.ran_against_substrate_commit}",
        f"        verdict: {verdict_escaped}",
        f"        artefact: lineage/{repo}/probe-runs/{dt.datetime.fromisoformat(run.ran_at).strftime('%Y-%m-%d')}-{run.probe_id}.yaml",
    ]
    entry_text = "\n".join(entry_lines) + "\n"

    # Check whether `    probe_verifications:` already exists in the feature block.
    pv_marker = "    probe_verifications:"
    pv_idx_in_block = feature_block.find(pv_marker)
    if pv_idx_in_block == -1:
        # Insert the section before `    maintainer_curated:` (if present) or at end.
        anchor_in_block = feature_block.find("    maintainer_curated:")
        if anchor_in_block == -1:
            # Append at end of block (before any trailing newlines)
            new_feature_block = feature_block.rstrip() + "\n\n" + (
                "    probe_verifications:    # auto-managed by lineage/_extractor/probe-runtime/runner.py — slice-6\n"
                + entry_text
            )
        else:
            new_feature_block = (
                feature_block[:anchor_in_block]
                + "probe_verifications:    # auto-managed by lineage/_extractor/probe-runtime/runner.py — slice-6\n".replace(
                    "probe_verifications:", "    probe_verifications:")
                + entry_text
                + "\n"
                + feature_block[anchor_in_block:]
            )
    else:
        # Append to existing section. Find the section's end: the next "    <key>:"
        # at the same 4-space indent, or end of feature block.
        section_start_in_block = pv_idx_in_block
        rest = feature_block[section_start_in_block + len(pv_marker):]
        # The section body ends at the next sibling key under the feature ("    key:" at 4-space indent).
        # Sibling keys begin with "\n    " followed by a non-space. The body itself is "\n      ..." (6-space).
        # Find the first "\n    X" where X != " " (so not "      ").
        m_sib = re.search(r"\n    (?=[A-Za-z_])", rest)
        if m_sib is not None:
            section_end_in_block = section_start_in_block + len(pv_marker) + m_sib.start()
        else:
            # No more siblings — the section extends to the end of the feature block.
            section_end_in_block = len(feature_block.rstrip())
        new_feature_block = (
            feature_block[:section_end_in_block].rstrip()
            + "\n"
            + entry_text
            + feature_block[section_end_in_block:]
        )

    new_text = text[:f_start] + new_feature_block + text[f_end:]
    ff_path.write_text(new_text, encoding="utf-8")
    if verbose:
        print(f"[runner] merged probe-verification into feature-flows.yaml#{run.feature_id}", file=sys.stderr)
    return ff_path


# ============================================================================
# Slice-5: probe resolution by feature + per-feature aggregated reporting +
# investigator-log integration. The /probe-run --feature F-NNN form lets the
# maintainer ask "run every probe that empirically grounds F-NNN" without
# carrying probe IDs in their head; aggregated reporting turns a batch into
# a feature-level audit; the investigator-log entry preserves the trail.
# ============================================================================

def resolve_probe_ids_by_feature(feature_id: str, *, workspace_root: Path, repo: str) -> list[str]:
    """Return probe IDs whose frontmatter feature_id matches.

    Reads every lineage/{repo}/probes/*.yaml; parses frontmatter; returns the
    IDs in lexical order so batch runs are deterministic.
    """
    probes_dir = workspace_root / PROBES_DIR_TEMPLATE.format(repo=repo)
    if not probes_dir.is_dir():
        raise FileNotFoundError(f"probes dir missing: {probes_dir}")
    matches: list[str] = []
    for path in sorted(probes_dir.glob("*.yaml")):
        try:
            probe = parse_probe_yaml(path)
        except Exception:
            continue
        if probe.get("feature_id") == feature_id:
            matches.append(probe.get("probe_id") or path.stem)
    return matches


def aggregate_runs_per_feature(runs: list[ProbeRun]) -> dict[str, dict[str, Any]]:
    """Group a list of probe-runs by feature_id; summarise per feature.

    Per-feature dict shape:
      {
        "feature_id": "F-001",
        "total_runs": 4,
        "pass_count": 4,
        "fail_count": 0,
        "error_count": 0,
        "test_classes_covered": ["integration", "performance", "security"],
        "runs": [
          {"probe_id": "P-001", "test_class": "integration", "outcome": "PASS", "run_id": "R-...", "verdict": "..."},
          ...
        ],
      }
    """
    by_feature: dict[str, dict[str, Any]] = {}
    for run in runs:
        fid = run.feature_id or "(no-feature)"
        entry = by_feature.setdefault(fid, {
            "feature_id": fid,
            "total_runs": 0,
            "pass_count": 0,
            "fail_count": 0,
            "error_count": 0,
            "test_classes_covered": set(),
            "runs": [],
        })
        entry["total_runs"] += 1
        if run.outcome == "PASS":
            entry["pass_count"] += 1
        elif run.outcome == "FAIL":
            entry["fail_count"] += 1
        else:
            entry["error_count"] += 1
        if run.outcome in {"PASS", "FAIL"}:
            entry["test_classes_covered"].add(run.test_class)
        entry["runs"].append({
            "probe_id": run.probe_id,
            "test_class": run.test_class,
            "outcome": run.outcome,
            "run_id": run.probe_run_id,
            "verdict": run.verdict_reason,
        })
    # Normalise sets to sorted lists for serialisation
    for entry in by_feature.values():
        entry["test_classes_covered"] = sorted(entry["test_classes_covered"])
    return by_feature


def write_batch_summary(
    runs: list[ProbeRun],
    *,
    workspace_root: Path,
    repo: str,
    trigger: str,
) -> Path:
    """Write a per-batch summary artefact next to the probe-runs.

    The summary is a markdown file at:
      lineage/{repo}/probe-runs/{date}-batch-{trigger-slug}.md

    Captures:
      - Trigger (which CLI invocation produced this batch)
      - One row per run (probe → outcome → verdict)
      - Per-feature aggregation (which features got measured, which test-classes per feature)

    Per dynamic-verification ADR slice 5 ("per-feature aggregated measurement reporting").
    """
    runs_dir = workspace_root / PROBE_RUNS_DIR_TEMPLATE.format(repo=repo)
    runs_dir.mkdir(parents=True, exist_ok=True)
    date_str = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d")
    trigger_slug = re.sub(r"[^A-Za-z0-9._-]+", "-", trigger).strip("-").lower() or "batch"
    # Avoid stuttering `batch-batch-...` when the trigger string itself starts with "batch ".
    trigger_slug = re.sub(r"^batch-", "", trigger_slug)
    out_path = runs_dir / f"{date_str}-batch-{trigger_slug}.md"

    by_feature = aggregate_runs_per_feature(runs)
    pass_total = sum(1 for r in runs if r.outcome == "PASS")
    fail_total = sum(1 for r in runs if r.outcome == "FAIL")
    error_total = sum(1 for r in runs if r.outcome not in {"PASS", "FAIL"})

    lines: list[str] = []
    lines.append(f"# Probe batch summary — {date_str} — `{trigger}`")
    lines.append("")
    lines.append(f"- **Probes run**: {len(runs)}")
    lines.append(f"- **PASS**: {pass_total}")
    lines.append(f"- **FAIL**: {fail_total}")
    lines.append(f"- **ERROR / TIMEOUT / SCOPE_VIOLATION**: {error_total}")
    lines.append(f"- **Features measured**: {len(by_feature)} ({', '.join(sorted(by_feature))})")
    lines.append("")
    lines.append("## Per-run outcomes")
    lines.append("")
    lines.append("| Probe | Feature | Test class | Outcome | Run ID | Verdict |")
    lines.append("|---|---|---|---|---|---|")
    for run in runs:
        verdict_oneline = run.verdict_reason.replace("|", "\\|").replace("\n", " ")[:200]
        lines.append(
            f"| `{run.probe_id}` | `{run.feature_id or '-'}` | {run.test_class} | "
            f"**{run.outcome}** | `{run.probe_run_id}` | {verdict_oneline} |"
        )
    lines.append("")
    lines.append("## Per-feature aggregation")
    lines.append("")
    for fid in sorted(by_feature):
        entry = by_feature[fid]
        classes = ", ".join(entry["test_classes_covered"]) or "(none — all runs failed)"
        lines.append(f"### {fid}")
        lines.append("")
        lines.append(
            f"- **Runs**: {entry['total_runs']} "
            f"(PASS={entry['pass_count']} / FAIL={entry['fail_count']} / ERROR={entry['error_count']})"
        )
        lines.append(f"- **Test classes empirically covered this batch**: {classes}")
        lines.append("- **Per-probe**:")
        for r in entry["runs"]:
            lines.append(
                f"  - `{r['probe_id']}` ({r['test_class']}) → **{r['outcome']}** — "
                f"{r['verdict']} (run `{r['run_id']}`)"
            )
        lines.append("")

    lines.append("## Layer-5 → layer-2 feedback")
    lines.append("")
    lines.append(
        "Each PASS/FAIL run above triggered a sidecar confidence merge "
        "(`## probe_verifications` section appended to each contributing sidecar "
        "in `lineage/{repo}/understanding/`). Per dynamic-verification ADR Rule 4."
    )
    lines.append("")
    lines.append("## Cross-references")
    lines.append("")
    lines.append(f"- Per-run artefacts: `lineage/{repo}/probe-runs/{date_str}-P-*.yaml`")
    lines.append(f"- Feature catalog: `lineage/{repo}/feature-flows.yaml`")
    lines.append(f"- Investigator log (slice-5 probe-run section): `lineage/{repo}/investigator-log.md`")
    lines.append("")

    out_path.write_text("\n".join(lines), encoding="utf-8")
    return out_path


def append_to_investigator_log(
    runs: list[ProbeRun],
    *,
    workspace_root: Path,
    repo: str,
    trigger: str,
    batch_summary_path: Path,
) -> Path | None:
    """Append a `## Probe-runs YYYY-MM-DD — <trigger>` section to investigator-log.md.

    Per dynamic-verification ADR slice 5: "integration with the existing
    investigator-log.md format (each batch's investigator-log entry now carries
    a probe-runs section alongside reducer diffs)".

    Returns the log path if appended; None if the log doesn't exist (silent skip).
    """
    log_path = workspace_root / "lineage" / repo / "investigator-log.md"
    if not log_path.is_file():
        return None

    date_str = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d")
    by_feature = aggregate_runs_per_feature(runs)
    pass_total = sum(1 for r in runs if r.outcome == "PASS")
    fail_total = sum(1 for r in runs if r.outcome == "FAIL")
    error_total = sum(1 for r in runs if r.outcome not in {"PASS", "FAIL"})

    block: list[str] = []
    block.append("")
    block.append(f"## Probe-runs {date_str} — `{trigger}` (layer-5 dynamic verification)")
    block.append("")
    block.append(
        "Per dynamic-verification ADR slice 5: each batch's investigator-log "
        "entry now records the probe-runs that empirically grounded the static "
        "ontology updates. This block is appended automatically by "
        "`lineage/_extractor/probe-runtime/runner.py` after every batch run."
    )
    block.append("")
    block.append(f"- **Trigger**: `{trigger}`")
    block.append(f"- **Probes run**: {len(runs)} ({pass_total} PASS / {fail_total} FAIL / {error_total} ERROR)")
    block.append(f"- **Features measured**: {len(by_feature)} (`{'`, `'.join(sorted(by_feature))}`)")
    block.append(f"- **Batch summary**: `{batch_summary_path.relative_to(workspace_root)}`")
    block.append("")
    block.append("### Probe-run outcomes")
    block.append("")
    block.append("| Probe | Feature | Test class | Outcome | Run ID |")
    block.append("|---|---|---|---|---|")
    for run in runs:
        block.append(
            f"| `{run.probe_id}` | `{run.feature_id or '-'}` | {run.test_class} | "
            f"**{run.outcome}** | `{run.probe_run_id}` |"
        )
    block.append("")
    block.append("### Layer-5 → layer-2 feedback closure")
    block.append("")
    block.append(
        "Each PASS/FAIL run merged a `## probe_verifications` entry into the "
        "contributing sidecars under `lineage/" + repo + "/understanding/` "
        "(per dynamic-verification ADR Rule 4)."
    )
    block.append("")
    block.append("---")
    block.append("")

    existing = log_path.read_text(encoding="utf-8")
    # Idempotency: if a probe-runs section for this exact trigger + date already
    # exists, don't append a duplicate. The runner is expected to be re-runnable
    # in the same day; the first run writes, the second amends the summary file
    # only.
    marker = f"## Probe-runs {date_str} — `{trigger}` (layer-5"
    if marker in existing:
        # Replace the existing block. Locate its bounds: from marker line to the
        # next `## ` heading or EOF.
        start = existing.index(marker)
        # find the preceding "\n" to keep prior blank line:
        # Look for the closing "---\n" that we emit, plus the next "## " or EOF.
        # Easiest: find from `start` the next "\n## " AFTER skipping our own line.
        after = existing[start:]
        next_h2 = re.search(r"\n## ", after[1:])
        if next_h2:
            end = start + 1 + next_h2.start() + 1   # newline before next ##
        else:
            end = len(existing)
        new_existing = existing[:start].rstrip() + "\n" + "\n".join(block) + existing[end:]
        log_path.write_text(new_existing, encoding="utf-8")
    else:
        log_path.write_text(existing.rstrip() + "\n" + "\n".join(block), encoding="utf-8")
    return log_path


# ============================================================================
# CLI
# ============================================================================

def main(argv: list[str]) -> int:
    p = argparse.ArgumentParser(description="Run a local probe against an ephemeral docker-compose mirror.")
    p.add_argument("probe_id", nargs="*", help="One or more probe IDs (P-001 P-002 ...). With --batch, all probes must share a stack_profile and are run against a single shared docker-compose lifecycle. Mutually exclusive with --feature.")
    p.add_argument("--feature", help="Resolve probe IDs from feature_id (e.g. --feature F-001 runs every probe whose frontmatter feature_id=F-001). Implies --batch when more than one probe matches.")
    p.add_argument("--repo", default="odd-platform", help="Substrate repo (default: odd-platform)")
    p.add_argument("--workspace-root", default=str(WORKSPACE_ROOT_DEFAULT), help="Workspace root (default: this script's grandparent)")
    p.add_argument("--verbose", "-v", action="store_true")
    p.add_argument("--dry-run", action="store_true", help="Validate probe + show what would execute, but do not bring up the stack")
    p.add_argument("--validate", action="store_true", help="Parse + scope-check; exit 0 if valid")
    p.add_argument("--no-merge", action="store_true", help="Skip the sidecar confidence merge after the probe completes")
    p.add_argument("--batch", action="store_true", help="Run multiple probes against a single shared docker-compose lifecycle (~50s overhead saved per probe after the first).")
    p.add_argument("--no-summary", action="store_true", help="Skip writing the per-batch summary artefact + investigator-log append (slice-5 outputs).")
    p.add_argument("--allow-stale", action="store_true", help="Override the substrate-staleness gate (dynamic-verification ADR Rule 5). The runner refuses by default to execute probes whose verified_against_commit lags the substrate's last_scan_commit by more than 5 commits.")
    p.add_argument("--show", action="store_true", help="Read-only: print the probe definition + the most recent probe-run artefact (no execution).")
    args = p.parse_args(argv)

    workspace_root = Path(args.workspace_root).resolve()
    probes_dir = workspace_root / PROBES_DIR_TEMPLATE.format(repo=args.repo)

    # Slice-5: --feature resolves to a list of probe IDs; mutually exclusive with positional probe_ids
    if args.feature:
        if args.probe_id:
            print(f"FATAL: --feature and positional probe IDs are mutually exclusive", file=sys.stderr)
            return 2
        resolved = resolve_probe_ids_by_feature(args.feature, workspace_root=workspace_root, repo=args.repo)
        if not resolved:
            print(f"FATAL: no probes found with feature_id={args.feature}", file=sys.stderr)
            return 2
        args.probe_id = resolved
        print(f"--feature {args.feature} → {len(resolved)} probe(s): {' '.join(resolved)}")

    if not args.probe_id:
        print(f"FATAL: must provide probe_id(s) or --feature F-NNN", file=sys.stderr)
        return 2

    # Validate all named probe files exist
    for pid in args.probe_id:
        probe_path = probes_dir / f"{pid}.yaml"
        if not probe_path.is_file():
            print(f"FATAL: probe file not found: {probe_path}", file=sys.stderr)
            return 2

    if args.validate:
        had_error = False
        for pid in args.probe_id:
            probe_path = probes_dir / f"{pid}.yaml"
            probe = parse_probe_yaml(probe_path)
            errors = validate_probe(probe)
            if errors:
                had_error = True
                for e in errors:
                    print(f"VALIDATION ERROR ({pid}): {e}", file=sys.stderr)
            else:
                print(f"OK: {probe_path.name} validates")
        return 4 if had_error else 0

    # --- SHOW MODE (read-only) ---
    if args.show:
        for pid in args.probe_id:
            probe_path = probes_dir / f"{pid}.yaml"
            probe = parse_probe_yaml(probe_path)
            print(f"========== Probe {pid} ==========")
            print(f"Path: {probe_path}")
            print(f"Feature: {probe.get('feature_id')}")
            print(f"Test class: {probe.get('test_class')}")
            print(f"Verified against: {probe.get('verified_against_commit')}")
            print(f"Stack profile: {probe.get('stack_profile')}")
            staleness = evaluate_probe_staleness(probe, workspace_root=workspace_root, repo=args.repo)
            print(f"Staleness: {staleness['reason']}{' [STALE]' if staleness['is_stale'] else ''}")
            print()
            print("Expected outcome:")
            print(probe.get("expected_outcome", "(none)").rstrip())
            print()
            runs_dir = workspace_root / PROBE_RUNS_DIR_TEMPLATE.format(repo=args.repo)
            last_run = None
            for candidate in sorted(runs_dir.glob(f"*-{pid}.yaml"), reverse=True):
                last_run = candidate
                break
            if last_run is None:
                print("No probe-run artefact on disk yet.")
            else:
                run_data = yaml.safe_load(last_run.read_text(encoding="utf-8"))
                print(f"Latest run: {last_run.name}")
                print(f"  Run ID:    {run_data.get('probe_run_id')}")
                print(f"  Ran at:    {run_data.get('ran_at')}")
                print(f"  Outcome:   {run_data.get('outcome')}")
                print(f"  Verdict:   {run_data.get('verdict_reason')}")
                obs = run_data.get("observe_outcomes") or {}
                if obs:
                    print("  Observed values:")
                    for k, v in obs.items():
                        v_repr = repr(v) if not isinstance(v, dict) else "{...}"
                        if len(v_repr) > 120:
                            v_repr = v_repr[:117] + "..."
                        print(f"    {k}: {v_repr}")
                asserts = run_data.get("assert_outcomes") or []
                if asserts:
                    print(f"  Assertions: {sum(1 for a in asserts if a.get('passed'))}/{len(asserts)} passed")
            print()
        return 0

    # --- STALENESS GATE (ADR Rule 5) — refuse stale probes unless --allow-stale ---
    staleness_per_probe: dict[str, dict[str, Any]] = {}
    for pid in args.probe_id:
        probe_path = probes_dir / f"{pid}.yaml"
        probe = parse_probe_yaml(probe_path)
        staleness = evaluate_probe_staleness(probe, workspace_root=workspace_root, repo=args.repo)
        staleness_per_probe[pid] = staleness
    stale_probes = [pid for pid, s in staleness_per_probe.items() if s["is_stale"]]
    if stale_probes and not args.allow_stale:
        print("FATAL: probe staleness gate refuses execution (per dynamic-verification ADR Rule 5):", file=sys.stderr)
        for pid in stale_probes:
            print(f"  - {pid}: {staleness_per_probe[pid]['reason']}", file=sys.stderr)
        print("Pass --allow-stale to override.", file=sys.stderr)
        return 4
    if stale_probes and args.allow_stale:
        print("WARNING: --allow-stale override engaged. Stale probes:", file=sys.stderr)
        for pid in stale_probes:
            print(f"  - {pid}: {staleness_per_probe[pid]['reason']}", file=sys.stderr)
    elif args.verbose:
        for pid, s in staleness_per_probe.items():
            print(f"[staleness] {pid}: {s['reason']}", file=sys.stderr)

    # --- BATCH MODE (shared docker-compose lifecycle) ---
    if args.batch or len(args.probe_id) > 1:
        if args.dry_run:
            print(f"DRY-RUN-OK: {len(args.probe_id)} probes would run in batch mode against shared stack")
            return 0
        try:
            runs = run_probe_batch(args.probe_id, workspace_root=workspace_root, repo=args.repo, verbose=args.verbose)
        except Exception as exc:
            traceback.print_exc(file=sys.stderr)
            return 2

        exit_code = 0
        merge_count = 0
        ff_merge_count = 0
        for run in runs:
            out_path = write_probe_run(run, workspace_root=workspace_root, repo=args.repo)
            print(f"  {run.probe_id} → {run.outcome} ({out_path.name}) — {run.verdict_reason}")
            if not args.no_merge and run.outcome in {"PASS", "FAIL"}:
                try:
                    updated = merge_probe_into_sidecars(run, workspace_root=workspace_root, repo=args.repo, verbose=args.verbose)
                    merge_count += len(updated)
                except Exception as exc:
                    print(f"    WARNING: sidecar merge failed for {run.probe_id}: {exc}", file=sys.stderr)
                try:
                    ff_merged = merge_probe_into_feature_flows(run, workspace_root=workspace_root, repo=args.repo, verbose=args.verbose)
                    if ff_merged is not None:
                        ff_merge_count += 1
                except Exception as exc:
                    print(f"    WARNING: feature-flows merge failed for {run.probe_id}: {exc}", file=sys.stderr)
            if run.outcome == "FAIL":
                exit_code = max(exit_code, 1)
            elif run.outcome in {"ERROR", "TIMEOUT", "SCOPE_VIOLATION"}:
                exit_code = max(exit_code, 2)

        pass_count = sum(1 for r in runs if r.outcome == "PASS")
        fail_count = sum(1 for r in runs if r.outcome == "FAIL")
        err_count = len(runs) - pass_count - fail_count
        print(f"\nBatch summary: {pass_count} PASS / {fail_count} FAIL / {err_count} ERROR. "
              f"{merge_count} sidecar verification entries appended; "
              f"{ff_merge_count} feature-flows.yaml verifications stamped.")

        # Slice-5: per-feature aggregated reporting + investigator-log integration.
        if not args.no_summary and runs:
            trigger = (f"--feature {args.feature}" if args.feature
                       else f"batch {' '.join(args.probe_id)}")
            try:
                summary_path = write_batch_summary(runs, workspace_root=workspace_root, repo=args.repo, trigger=trigger)
                print(f"Batch summary written: {summary_path.relative_to(workspace_root)}")
            except Exception as exc:
                print(f"WARNING: batch summary failed: {exc}", file=sys.stderr)
                summary_path = None
            if summary_path is not None:
                try:
                    log_path = append_to_investigator_log(runs, workspace_root=workspace_root, repo=args.repo, trigger=trigger, batch_summary_path=summary_path)
                    if log_path is not None:
                        print(f"Investigator log updated: {log_path.relative_to(workspace_root)}")
                except Exception as exc:
                    print(f"WARNING: investigator-log append failed: {exc}", file=sys.stderr)

        return exit_code

    # --- SINGLE MODE ---
    pid = args.probe_id[0]
    probe_path = probes_dir / f"{pid}.yaml"
    try:
        run = run_probe(probe_path, workspace_root=workspace_root, verbose=args.verbose, dry_run=args.dry_run)
    except Exception as exc:
        traceback.print_exc(file=sys.stderr)
        return 2

    # Dry-run never writes the probe-run artefact — it must not overwrite a real run.
    if args.dry_run:
        print(f"DRY-RUN-OK: {probe_path.name} — would execute against {compose_path_for_profile(parse_probe_yaml(probe_path).get('stack_profile', 'odd-minimal'), stack_dir=workspace_root / 'lineage' / '_extractor' / 'probe-stacks')}")
        return 0

    out_path = write_probe_run(run, workspace_root=workspace_root, repo=args.repo)
    print(f"Wrote: {out_path}")
    print(f"Outcome: {run.outcome} — {run.verdict_reason}")

    # Sidecar confidence merge — per dynamic-verification ADR Rule 4.
    if not args.no_merge and run.outcome in {"PASS", "FAIL"}:
        try:
            updated = merge_probe_into_sidecars(run, workspace_root=workspace_root, repo=args.repo, verbose=args.verbose)
            if updated:
                print(f"Merged probe-verification into {len(updated)} sidecar(s):")
                for sp in updated:
                    print(f"  - {sp.relative_to(workspace_root)}")
            elif args.verbose:
                print("[runner] no sidecars updated (feature missing OR all contributing nodes are UNRESOLVED)")
        except Exception as exc:
            print(f"WARNING: sidecar merge failed: {exc}", file=sys.stderr)
        # Slice-6: also stamp feature-flows.yaml.
        try:
            ff_merged = merge_probe_into_feature_flows(run, workspace_root=workspace_root, repo=args.repo, verbose=args.verbose)
            if ff_merged is not None:
                print(f"Stamped feature-flows.yaml: {ff_merged.relative_to(workspace_root)}")
        except Exception as exc:
            print(f"WARNING: feature-flows merge failed: {exc}", file=sys.stderr)

    return {
        "PASS": 0,
        "FAIL": 1,
        "ERROR": 2,
        "TIMEOUT": 3,
        "SCOPE_VIOLATION": 4,
        "DRY-RUN-OK": 0,
    }.get(run.outcome, 2)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
