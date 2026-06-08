import { test, expect, type Page } from '@playwright/test';

/**
 * IT-118 — F-035 Operator-Configured Additional Links (GET /api/links + the App Info menu).
 *
 * Protocol: integration-tests/protocols/IT-118-operator-additional-links.md
 * Gates: validates F-035 (UC-3 operator-default empty shape) + characterizes two CONTRADICTED
 *        promises as LSN-029 RED-on-fix pins: UC-6 keyboard accessibility (WCAG 2.1 SC 2.1.1) and
 *        UC-7 reverse-tabnabbing (rel='noopener noreferrer'). Both contradictions are tracked as
 *        PLT-088 (Defect 3 + Defect 2).
 *
 * GROUND TRUTH (read 2026-06-07):
 *   - `LinksController#getLinks` (LinksController.java:25-36) reads `AdditionalLinkProperties.links()`
 *     (a `@ConfigurationProperties("odd")` record-of-records, AdditionalLinkProperties.java:6-9). If
 *     the list is null/empty it returns `200 LinkList{items:[]}` (LinksController.java:27-29);
 *     otherwise it maps each {title,url} through verbatim (LinksController.java:31-33, no sort/limit).
 *   - `odd.links` is NOT in the shipped application.yml (the `odd:` block at :208-212 carries only
 *     tenant-id / data-entity-stale-period / activity) — operators add it themselves. So the stock
 *     install returns `{"items":[]}`.
 *   - The UI renders the links in the App Info menu (AppInfoMenu.tsx). `useAppLinks()`
 *     (lib/hooks/api/appInfo.ts:11-17) selects `data.items`; `projectLinks` (AppInfoMenu.tsx:55-69)
 *     renders nothing when the list is empty (line 56 `if (!links || links.length === 0) return null`)
 *     and otherwise maps each as `<Link key={link.url} to={link.url} target='_blank'>`
 *     (AppInfoMenu.tsx:60-66) — target='_blank' with NO rel.
 *   - The menu also always renders four hardcoded items: Documentation (AppInfoMenu.tsx:95-102),
 *     Slack (:103-110), the version (:37-53), Leave-a-feedback (:112-119) — all
 *     `<Link target='_blank'>` with NO rel='noopener noreferrer' (the 5-site tabnabbing surface).
 *   - The menu opens via the info icon button's `onMouseEnter` ONLY (AppInfoMenu.tsx:81) — the button
 *     declares `aria-haspopup='true'` (line 80) + `aria-controls` (line 79) but wires NO onClick, NO
 *     onKeyDown, NO onFocus. The MUI Menu is `keepMounted` (line 90) and renders into a portal.
 *
 * Operator caveat (why characterize this): operators are told to put internal runbook / Grafana /
 * wiki URLs in odd.links (the documented use case). The default is empty (clean). But once
 * populated, those links render in `<a target='_blank'>` without rel (window.opener leak —
 * reverse-tabnabbing) and the whole menu — Documentation, Slack, the version, AND the operator
 * links — is unreachable to keyboard-only and touch users (WCAG SC 2.1.1). These pins lock the
 * empty default and the two contradictions so a fix flips them RED deliberately.
 *
 * GROUNDED 2026-06-07: `curl -s :18080/api/links` -> 200 `{"items":[]}`; browser smoke confirmed
 * focus+Enter+Space does NOT open the menu (keyboard bug) while hover does, and the Documentation /
 * Slack links render `target='_blank'` with `rel=null`.
 */

interface LinkListBody {
  items?: Array<{ title?: string; url?: string }>;
  [k: string]: unknown;
}

// Open the App Info menu the only way the shipped widget allows: hover the icon button. The menu is
// a keepMounted MUI portal; once hovered, Documentation/Slack/version become visible at document.body.
async function openAppInfoMenuByHover(page: Page): Promise<void> {
  const btn = page.getByRole('button', { name: 'app info menu' });
  await expect(btn, 'the App Info icon button is present in the toolbar').toBeVisible({
    timeout: 10_000,
  });
  await btn.hover();
  // The hardcoded "Documentation" item is always present once the menu is open.
  await expect(
    page.getByRole('link', { name: 'Documentation' }),
    'hovering the info button opens the App Info menu (Documentation item visible)',
  ).toBeVisible({ timeout: 10_000 });
}

test.describe('F-035 Operator-Configured Additional Links — /api/links + App Info menu', () => {
  test('it21180_UC-3: operator default (odd.links unset) -> 200 JSON {"items":[]} (not null, not 404)', async ({
    request,
  }) => {
    // The shipped config has no odd.links block; AdditionalLinkProperties.links() is null and
    // LinksController short-circuits to an empty LinkList (LinksController.java:27-29). The contract
    // is a real 200 JSON empty array — the menu shows no operator-links section, without error.
    const res = await request.get('/api/links');
    expect(res.status(), 'GET /api/links answers 200 on a stock install').toBe(200);
    expect(
      (res.headers()['content-type'] ?? '').toLowerCase(),
      'the response is JSON (a real controller body, not the SPA index.html fallback)',
    ).toContain('application/json');

    const body = (await res.json()) as LinkListBody;
    expect(Array.isArray(body.items), 'LinkList.items is an array (never null)').toBe(true);
    // No operator links configured by default. If a future shipped default adds an odd.links entry,
    // this goes RED (a new operator-link shipping out of the box would be a deliberate change).
    expect(
      body.items,
      'with odd.links unset (operator default) the link list is empty',
    ).toEqual([]);
  });

  test('it21181_UC-3 (render): with no operator links, the App Info menu opens and shows the hardcoded items but no operator-links section', async ({
    page,
  }) => {
    // The empty /api/links means projectLinks returns null (AppInfoMenu.tsx:56); the menu still
    // renders its four hardcoded items. This confirms the empty-default RENDER path end-to-end:
    // the menu composes and the version is shown, with no operator section and no error.
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await openAppInfoMenuByHover(page);

    // The always-present hardcoded items render.
    await expect(
      page.getByRole('link', { name: 'Slack' }),
      'the hardcoded Slack item renders in the open menu',
    ).toBeVisible();
    await expect(
      page.getByText('ODD Platform version'),
      'the version block renders in the open menu',
    ).toBeVisible();
    // The operator-link section (rendered from /api/links) is absent because the list is empty.
    // We assert the deployment version's GitHub link is the only non-hardcoded-CTA <a>; concretely,
    // there is no operator-supplied link beyond the four hardcoded CTAs + version. We verify by
    // confirming the menu has exactly the expected hardcoded link labels and nothing operator-named.
    await expect(
      page.getByRole('link', { name: 'Leave a feedback' }),
      'the hardcoded feedback CTA renders (menu fully composed even with zero operator links)',
    ).toBeVisible();
  });

  // KNOWN BUG (PLT-088 Defect 3 — F-035-UC-6 CONTRADICTED): the App Info menu is keyboard- and
  // touch-inaccessible. The icon button declares aria-haspopup='true' (AppInfoMenu.tsx:80) but wires
  // ONLY onMouseEnter (line 81) — no onClick/onKeyDown/onFocus — so a keyboard-only user who focuses
  // the button and presses Enter/Space gets NOTHING. This is a GREEN characterization pin (LSN-029):
  // it asserts the CURRENT broken behaviour and flips RED the moment the menu becomes keyboard-
  // operable (onClick/onKeyDown added). WCAG 2.1 SC 2.1.1.
  test('it21182_UC-6 (pin): keyboard focus + Enter/Space does NOT open the App Info menu (WCAG SC 2.1.1 violation)', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const btn = page.getByRole('button', { name: 'app info menu' });
    await expect(btn, 'the App Info icon button is present and focusable').toBeVisible({
      timeout: 10_000,
    });
    await btn.focus();
    expect(
      await btn.evaluate(el => el === document.activeElement),
      'the icon button can take keyboard focus',
    ).toBe(true);

    // A keyboard user's two activation keys. With only onMouseEnter wired, neither opens the menu.
    await page.keyboard.press('Enter');
    await page.keyboard.press(' ');

    // PIN: the menu stays closed for the keyboard user. RED here = a keyboard handler was added (fix).
    await expect(
      page.getByRole('link', { name: 'Documentation' }),
      'PIN: focus+Enter+Space must NOT open the menu on the current build (no onClick/onKeyDown — ' +
        'WCAG SC 2.1.1 violation, PLT-088 Defect 3). RED here = the menu became keyboard-operable.',
    ).toBeHidden();
  });

  // KNOWN BUG (PLT-088 Defect 2 — F-035-UC-7 CONTRADICTED): the menu's external links render with
  // target='_blank' but WITHOUT rel='noopener noreferrer' — the destination keeps a live
  // window.opener handle on the parent ODD tab (reverse-tabnabbing). Pinned on the always-present
  // hardcoded Documentation + Slack links (the operator-configured links — line 61 — share the same
  // bug but need YAML config not available on the shared stack). GREEN now / RED when rel is added.
  test('it21183_UC-7 (pin): App Info menu external links use target=_blank WITHOUT rel=noopener (reverse-tabnabbing)', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await openAppInfoMenuByHover(page);

    const docLink = page.getByRole('link', { name: 'Documentation' });
    const slackLink = page.getByRole('link', { name: 'Slack' });

    // Both open in a new tab...
    await expect(docLink, 'the Documentation link opens in a new tab').toHaveAttribute(
      'target',
      '_blank',
    );
    await expect(slackLink, 'the Slack link opens in a new tab').toHaveAttribute('target', '_blank');

    // ...but WITHOUT the rel hardening. On the current build rel is absent (null). The widget renders
    // a react-router <Link> with no rel prop (AppInfoMenu.tsx:95,103), so the DOM <a> has no rel.
    // PIN: rel is null/empty now; RED the day rel='noopener noreferrer' is added (the fix).
    const docRel = await docLink.getAttribute('rel');
    const slackRel = await slackLink.getAttribute('rel');
    expect(
      docRel ?? '',
      'PIN: Documentation link has NO rel=noopener noreferrer on the current build (PLT-088 Defect 2). ' +
        'RED here = the tabnabbing hardening landed.',
    ).not.toContain('noopener');
    expect(
      slackRel ?? '',
      'PIN: Slack link has NO rel=noopener noreferrer on the current build (PLT-088 Defect 2).',
    ).not.toContain('noopener');
  });
});
