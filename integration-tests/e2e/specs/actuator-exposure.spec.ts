import { test, expect, type APIRequestContext } from '@playwright/test';

/**
 * IT-065 — F-122 Operator Management-Endpoint Exposure Surface (Spring Boot Actuator). SECURITY-class.
 *
 * Protocol: integration-tests/protocols/IT-065-actuator-exposure.md
 * Gates: validates F-122 (UC-001 /actuator/** reachable unauthenticated · UC-009 which endpoints serve anon).
 *
 * `SecurityConstants.WHITELIST_PATHS` includes `/actuator/**` (SecurityConstants.java:26) — actuator is
 * reachable BEFORE auth in EVERY mode (DISABLED + LOGIN_FORM + OAUTH2 + LDAP). application.yml's management
 * block (application.yml:226-242) sets `enabled-by-default: false` and exposes ONLY `health, prometheus,
 * env, info`; there is NO `management.server.port` (actuator shares the main HTTP port) and NO `show-values`
 * key (so env value-masking is the Spring Boot framework default, NOT a platform contract — F-122 H-002).
 *
 * GROUNDED 2026-06-07 (curl :18080) — and the grounding surfaced a subtlety worth pinning:
 *   /actuator/health -> 200 {"status":"UP"}            (serves a real body anon)
 *   /actuator/info   -> 200 {"build":{...,"version":"0.27.13",...}}   (serves a real body anon — version leak)
 *   /actuator        -> 200 _links: self,info,health,health-path only
 *   /actuator/env, /actuator/prometheus  -> 500 SYS001 (NOT 401/403 — reached app code, NOT auth-gated)
 *   /actuator/beans|configprops|heapdump|threaddump|loggers|metrics -> 500 SYS001 too (disabled).
 *   /actuator/foobar123 (unknown id)     -> 500 SYS001 too.
 * i.e. the platform's catch-all ControllerAdvice (@ExceptionHandler(Exception.class) -> SERVER_EXCEPTION,
 * ControllerAdvice.java:62-66) SWALLOWS the actuator dispatcher: every /actuator/* except health+info returns
 * an indistinguishable 500 SYS001 over HTTP, whether the endpoint is enabled (env), disabled (beans), or
 * unknown (foobar123). So we CANNOT (and must not) assert a 200 credential dump from /actuator/env — it does
 * not currently happen. What IS verifiable and security-relevant: /actuator/** is NOT auth-gated (no 401/403).
 *
 * RESPONSIBLE DISCLOSURE: SECURITY characterization. The env/prometheus pins assert only THAT the path is
 * reachable unauthenticated (status is not an auth rejection) — a NON-sensitive marker. No body is read, no
 * value is asserted. Root cause + operator impact are ALREADY tracked in PLT-078 (restrict default exposure
 * list) + PLT-103 (env value leak); this spec adds the live regression guard, no new issue is minted. NB: the
 * env *value-dump* PLT-078/103 describe is not directly reproducible on :latest (env returns 500 via the
 * catch-all handler, matching the refactoring-scopes "actuator-leak refuted on Spring Boot 3.4.x" note); what
 * is real and pinned here is the reachability posture. No exploit recipe here.
 */

const ACTUATOR_MEDIA = 'application/vnd.spring-boot.actuator.v3+json';

/** Auth statuses: a request that the security layer rejected before reaching app code. */
const AUTH_REJECT = [401, 403];
/** A 302 to a login form is how LOGIN_FORM/OAUTH2 would gate a browser GET. */
const LOGIN_REDIRECT = 302;

/**
 * True iff the security layer did NOT gate the request — no 401/403 and no 302-to-login. Under the shipped
 * default auth.type=DISABLED nothing is gated; combined with the /actuator/** whitelist this is the posture
 * F-122 UC-001 characterizes. Reachability-only: the body is never read.
 */
async function reachableUnauthenticated(request: APIRequestContext, path: string): Promise<number> {
  const res = await request.get(path, { headers: { accept: ACTUATOR_MEDIA }, maxRedirects: 0 });
  const status = res.status();
  expect(AUTH_REJECT, `${path} must not be auth-rejected (401/403) — it is whitelisted/open`).not.toContain(status);
  expect(status, `${path} must not redirect to a login form`).not.toBe(LOGIN_REDIRECT);
  return status;
}

test.describe('F-122 Operator Management-Endpoint Exposure Surface (actuator)', () => {
  test('it20650_UC-009: /actuator/health and /actuator/info serve a real body to an anonymous caller (info discloses the build version)', async ({
    request,
  }) => {
    // The two actuator endpoints that demonstrably serve content anonymously. health + info are exposed AND
    // return a 200 body with no credential (unlike env/prometheus which the global ControllerAdvice masks to 500).
    const health = await request.get('/actuator/health', { headers: { accept: ACTUATOR_MEDIA } });
    expect(health.status(), '/actuator/health is reachable (200) unauthenticated').toBe(200);
    expect(((await health.json()) as { status?: string }).status, '/actuator/health reports liveness').toBe('UP');

    const info = await request.get('/actuator/info', { headers: { accept: ACTUATOR_MEDIA } });
    expect(info.status(), '/actuator/info is reachable (200) unauthenticated').toBe(200);
    // info exposes build metadata incl. the version — part of the deployment fingerprint (NON-secret build coords).
    const infoBody = (await info.json()) as { build?: { version?: string } };
    expect(
      typeof infoBody.build?.version === 'string' && infoBody.build.version.length > 0,
      '/actuator/info discloses the build version to an anonymous caller (fingerprint surface)',
    ).toBe(true);
  });

  test('it20651_UC-001 [SECURITY pin]: /actuator/env is reachable UNAUTHENTICATED (whitelisted) and is NOT masked behind an auth gate', async ({
    request,
  }) => {
    // Characterization of the SECURITY posture (LSN-029). /actuator/env sits under the /actuator/** whitelist
    // (SecurityConstants.java:26), so the security layer never gates it: a GET reaches application code and
    // returns 500 SYS001, NOT a 401/403 auth rejection. We assert ONLY that non-auth-rejected posture — we do
    // NOT fetch the env body or assert any property value (the EnvEndpoint is enabled at application.yml:236 and
    // there is no show-values key, so masking rests on the framework default — an operator-removable guarantee).
    // Today the catch-all ControllerAdvice masks the env body to a 500, so no credential is returned over HTTP;
    // the SECURITY fact this pins is the reachability (auth does not protect /actuator/env), which is invariant
    // across DISABLED/LOGIN_FORM/OAUTH2/LDAP because the whitelist — not the auth mode — is what opens it.
    // GREEN while /actuator/env is whitelisted; goes RED when env is removed from WHITELIST_PATHS, moved to a
    // separate management port, or otherwise placed behind authentication — i.e. when the surface narrows.
    const status = await reachableUnauthenticated(request, '/actuator/env');
    // Confirm it reached app code (the documented current behaviour) rather than being absent/gated.
    expect(
      status,
      'SECURITY: /actuator/env is reachable unauthenticated; it reaches app code (500 via the catch-all handler), not an auth gate',
    ).toBe(500);
  });

  test('it20652_UC-005 [SECURITY pin]: /actuator/prometheus (operator metrics) is reachable UNAUTHENTICATED', async ({
    request,
  }) => {
    // Second whitelisted surface: the Prometheus scrape endpoint is configured-exposed
    // (application.yml:230 include list + management.endpoint.prometheus.enabled=true) and is reachable without
    // authentication. Reachability-only assertion (no metric body asserted).
    const status = await reachableUnauthenticated(request, '/actuator/prometheus');
    expect(
      status,
      'SECURITY: /actuator/prometheus is reachable unauthenticated (whitelisted) — operator metrics surface is open',
    ).toBe(500);
  });
});
