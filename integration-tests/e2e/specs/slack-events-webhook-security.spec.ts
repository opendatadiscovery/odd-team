import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * IT-116 — F-098 Slack Events inbound webhook (`POST /api/slack/events`) — inbound security.
 *
 * Protocol: integration-tests/protocols/IT-116-slack-events-webhook-security.md
 * Gates: validates F-098 (UC-001 no-signature-verification + UC-003 flag-is-the-sole-gate +
 *        UC-010 unsigned-challenge-echo fingerprint oracle). SECURITY-class — responsible disclosure.
 *
 * GROUND-BEFORE-ASSERT (read at authoring time):
 *  - EventApiController.java:22-27 — `@PostMapping("/api/slack/events")` binds ONLY
 *    `@RequestBody Mono<String> rawRequestBody`. It reads NO header: no @RequestHeader,
 *    no ServerHttpRequest, no HttpHeaders. A handler that never sees the request headers
 *    CANNOT verify `X-Slack-Signature` even in principle. (Verified live: grep for
 *    @RequestHeader/HttpHeaders/ServerHttpRequest/getHeaders in the controller = ZERO matches.)
 *  - SlackEventParser.java:22-23 — `parse(final String rawJson)` takes only the body; no
 *    timestamp, no signature. The url_verification branch (lines 28-35) echoes
 *    `requestMap.get("challenge")` straight back with 200 — BEFORE any signature check
 *    (there is none) → an unauthenticated challenge echo (endpoint-existence oracle).
 *  - The whole codebase contains ZERO X-Slack-Signature / signing-secret / HMAC-SHA256
 *    handling (the canonical grep below; mirrors F-098 verification_targets_re_read).
 *  - EventApiController + SlackEventParser are `@ConditionalOnDataCollaboration`
 *    (DataCollaborationFeatureCondition reads FeatureResolver.DATA_COLLABORATION_ENABLED_PROPERTY,
 *    i.e. `datacollaboration.enabled`, default FALSE — application.yml:205). When the flag is
 *    OFF the controller bean is NOT registered, so `/api/slack/events` is an UNMAPPED route.
 *  - SecurityConstants.WHITELIST_PATHS contains `/api/slack/events` (line 95-96) — so WHEN the
 *    feature is enabled the endpoint is anonymously reachable in every UI auth mode; the
 *    signing-secret check is the only intended defence, and it does not exist.
 *
 * GROUNDED LIVE (2026-06-07, no-credential, auth.type=DISABLED, datacollaboration.enabled=false):
 *  - POST /api/slack/events {type:url_verification,challenge:...} → HTTP 500 SYS001.
 *  - POST /api/slack/events {type:event_callback} → HTTP 500 SYS001.
 *  - POST /api/slack/THIS_DOES_NOT_EXIST (a control, definitely-unmapped sibling) → HTTP 500 SYS001.
 *    => the 500 is NOT a fault in the Slack handler; it is the platform's response to ANY unmapped
 *       `/api/**` POST. With datacollaboration.enabled=false the Slack receiver is simply not mounted.
 *
 * WHAT THIS SPEC PINS, and why it is honest under THIS engine:
 *  The shared external stack runs the SHIPPED DEFAULT `datacollaboration.enabled=false`. Bringing the
 *  feature up would be a stack/config change this protocol is forbidden from making. So the spec pins
 *  the two observable security facts that hold on the shipped engine WITHOUT enabling the feature:
 *   (UC-003) The receiver's EXISTENCE is gated SOLELY by `datacollaboration.enabled` — there is no auth
 *            gate; when the flag is OFF the route is unmapped (behaves identically to an unmapped sibling).
 *            This is the operator-observable proof that the flag is the sole control over whether an
 *            unauthenticated, unsigned inbound receiver is exposed at all.
 *   (UC-001) There is ZERO signature-verification code on the path (source ground truth: the canonical
 *            HMAC grep returns nothing AND the controller binds no header). A grep is a legitimate,
 *            reproducible observation the protocol's human-executable steps also specify; it is the
 *            load-bearing characterization of "any internet host can forge events" once the flag is on.
 *
 * All three assertions are LSN-029 characterization pins: GREEN under the current code; they FLIP RED
 * the day a signing-secret WebFilter is added (UC-001/UC-010 grep starts matching) or the receiver is
 * mounted+gated differently (UC-003 equivalence breaks). The flip IS the regression-closure signal.
 *
 * Operator caveat (why pin it): F-098 is a user-facing, internet-reachable, forge-able feature. Once an
 * operator sets `datacollaboration.enabled=true`, `/api/slack/events` is whitelisted from auth in EVERY
 * mode and performs NO Slack HMAC verification — any host that can reach the HTTP port can forge Slack
 * events (and echo the url_verification challenge to fingerprint the deployment). Filed: PLT-054 +
 * PLT-099 (no HMAC on /api/slack/events) + PLT-035 (at-least-once dedup).
 *
 * Responsible disclosure: this spec NEVER forges a valid Slack signature and NEVER dumps secrets. It
 * asserts the verification-path's observable behaviour: that no verification code exists (grep) and that
 * the endpoint's exposure is flag-gated (live equivalence). No exploit recipe.
 *
 * Namespacing: it116_ markers, ids 21160-21169 (none needed — no DB seed; the feature is unmounted here).
 */
const BASE = process.env.ODD_BASE_URL ?? 'http://localhost:18080';
// Resolve the platform source WITHOUT hardcoding any absolute path: this spec lives at
// odd-team/integration-tests/e2e/specs/ and odd-platform is its sibling checkout (__dirname works
// under the CommonJS transpile). ODD_PLATFORM_DIR overrides for non-standard layouts.
const PLATFORM_DIR = process.env.ODD_PLATFORM_DIR ?? resolve(__dirname, '../../../../odd-platform');
const PLATFORM_SRC = resolve(PLATFORM_DIR, 'odd-platform-api/src/main/java');

// POST helper with NO Authorization and NO X-Slack-Signature — the anonymous/adversary caller.
async function postAnon(path: string, body: unknown): Promise<number> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  await res.text().catch(() => undefined);
  return res.status;
}

test.describe('F-098 Slack Events inbound webhook — inbound security characterization', () => {
  test('UC-001 (source ground truth): ZERO Slack-signature / HMAC verification code exists, and the controller binds no header', () => {
    // The protocol's human-executable observation: grep the platform source for ANY signature-verification
    // primitive. F-098 cites this exact grep returning zero matches; we re-run it as the live gate.
    // (Skip gracefully only if the platform checkout is not where we expect — never fake-green.)
    test.skip(!existsSync(PLATFORM_SRC), `platform source not found at ${PLATFORM_SRC}; run from the odd-team workspace beside odd-platform`);

    let matches: string;
    try {
      matches = execFileSync(
        'grep',
        ['-rniE', 'X-Slack-Signature|signing.?secret|signingSecret|verifySignature|HMAC.?SHA256|HmacSha256|HmacUtils', PLATFORM_SRC],
        { encoding: 'utf8' },
      );
    } catch (e) {
      // grep exits 1 when there are NO matches — that is the PASS condition here.
      const err = e as { status?: number; stdout?: string };
      if (err.status === 1) matches = err.stdout ?? '';
      else throw e;
    }
    expect(
      matches.trim(),
      'UC-001: no X-Slack-Signature / signing-secret / HMAC-SHA256 handling anywhere in odd-platform main java (inbound_webhook_signature_unverified). FLIPS when a signing-secret filter is added.',
    ).toBe('');

    // Corroborate at the handler: EventApiController binds no header, so it cannot verify a signature.
    const controller = `${PLATFORM_SRC}/org/opendatadiscovery/oddplatform/datacollaboration/controller/EventApiController.java`;
    let headerBindings = '';
    try {
      headerBindings = execFileSync('grep', ['-nE', '@RequestHeader|HttpHeaders|ServerHttpRequest|getHeaders', controller], { encoding: 'utf8' });
    } catch (e) {
      const err = e as { status?: number; stdout?: string };
      if (err.status === 1) headerBindings = err.stdout ?? '';
      else throw e;
    }
    expect(
      headerBindings.trim(),
      'UC-001: EventApiController reads NO request header (@RequestBody Mono<String> only) — it is structurally incapable of verifying X-Slack-Signature.',
    ).toBe('');
  });

  test('UC-003 (live posture): the Slack receiver is gated SOLELY by datacollaboration.enabled — with the flag off the route is unmapped (no auth gate)', async () => {
    // On the shipped default (datacollaboration.enabled=false) the controller bean is not registered.
    // Prove the endpoint is UNMAPPED — not auth-rejected — by showing it behaves identically to a
    // definitely-unmapped sibling under the same /api/slack/ prefix. A real auth gate would 401/403;
    // a mounted receiver would 200/400. Instead both yield the platform's unmapped-route response.
    const slackEvents = await postAnon('/api/slack/events', { type: 'url_verification', challenge: 'it116-challenge-marker' });
    const unmappedSibling = await postAnon('/api/slack/it116_definitely_unmapped', { type: 'url_verification', challenge: 'it116-control' });

    // The load-bearing claim: NOT auth-rejected (the path is whitelisted / unmounted, never 401/403).
    expect(
      [401, 403].includes(slackEvents),
      `UC-003: /api/slack/events is NOT auth-rejected (got ${slackEvents}, not 401/403) — its exposure is controlled by the feature flag, not by auth.`,
    ).toBe(false);

    // And it is UNMAPPED (feature off), proven by equality with the control sibling: the 500 is the
    // unmapped-route response, not a Slack-handler fault. If DC were ON, slackEvents would diverge
    // (200 challenge echo) from the still-unmapped sibling — and THIS assertion would flip, correctly
    // signalling that the receiver is now mounted (re-scope to the enabled-feature matrix).
    expect(
      slackEvents,
      `UC-003: with datacollaboration.enabled=false the Slack receiver is unmapped — same response as a definitely-unmapped sibling (${unmappedSibling}). Flips when the feature is enabled (route becomes mounted).`,
    ).toBe(unmappedSibling);
  });

  test('UC-010 (live posture): an unsigned url_verification challenge is NOT auth-rejected — the echo oracle is gated only by the (absent) signature check', async () => {
    // Slack mandates verifying the signature BEFORE responding to a url_verification challenge. The code
    // echoes the challenge with 200 with no signature check (SlackEventParser.java:28-35) — so when the
    // feature is enabled the echo is an unauthenticated endpoint-existence oracle. On THIS engine the
    // feature is off, so the observable fact we can pin without enabling it is: the unsigned challenge is
    // never AUTH-rejected (no 401/403 gate stands in front of the path). Combined with UC-001 (no signature
    // code) this is the honest characterization of the fingerprint-oracle exposure.
    const noSigStatus = await postAnon('/api/slack/events', { type: 'url_verification', challenge: 'it116-no-signature' });
    expect(
      [401, 403].includes(noSigStatus),
      `UC-010: an UNSIGNED url_verification challenge is not rejected by an auth/signature gate (got ${noSigStatus}, not 401/403). With the feature enabled this path returns a 200 challenge echo with no signature check (endpoint_existence_enumeration_via_unsigned_challenge). Flips RED when a signing-secret filter rejects unsigned requests.`,
    ).toBe(false);
  });
});
