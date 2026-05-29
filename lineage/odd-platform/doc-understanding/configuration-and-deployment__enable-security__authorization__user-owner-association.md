---
doc_page: "docs/configuration-and-deployment/enable-security/authorization/user-owner-association.md"
page_title: "User-owner association"
live_url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/user-owner-association"
live_url_verified_status: "200"
live_url_resolved_slug: "configuration-and-deployment/enable-security/authorization/user-owner-association"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "User-Owner Mapping"
  features:
    - "F-142"   # home-page user-binding request workflow (form/pending/declined/approved)
    - "F-075"   # POST /api/owner_association_request flow: branch A self-request + branch B DIRECT_OWNER_SYNC auto-approve
    - "F-171"   # New requests tab — Accept/Reject triage (OWNER_ASSOCIATION_MANAGE)
    - "F-172"   # Create association — admin direct-bind (OWNER_RELATION_MANAGE)
    - "F-173"   # Active associations tab — Remove binding
    - "F-174"   # History tab — resolved-request audit list
  code_nodes:
    - "odd-platform java OwnerAssociationRequestController controller-method:createOwnerAssociationRequest"
    - "odd-platform java OwnerAssociationRequestController controller-method:updateOwnerAssociationRequest"
    - "odd-platform java OwnerAssociationRequestController controller-method:createUserOwnerMapping"
    - "odd-platform java OwnerAssociationRequestController controller-method:deleteActiveUserOwnerMapping"
    - "odd-platform java OwnerAssociationRequestController controller-method:getOwnerAssociationRequestList"
    - "odd-platform java OwnerAssociationRequestController controller-method:getOwnerAssociationRequestActivityList"
    - "odd-platform java OwnerAssociationRequestController controller-method:getAuthProviders"
audience: [operator]
doc_claim_vs_code:
  - "DRIFT (page OVERSELLS a gap): the {% hint warning %} 'Known incompleteness' under #auditing-past-association-requests-history-tab claims admin direct-bind (Create association) and Active-tab Remove 'may not surface on the History sub-tab — the activity stream is written by the request-approval path, while the direct-bind and remove paths use a different controller.' Code contradicts this. (a) NO different controller: createUserOwnerMapping and deleteActiveUserOwnerMapping are methods on the SAME OwnerAssociationRequestController as the approval path (OwnerAssociationRequestController.java:65, :75). (b) Direct-bind DOES write an audit row: createUserOwnerMapping -> createManualAssociationRequest -> createOwnerAssociationRequestWithActivity(association, isManual=true, ...) -> createActivity writes REQUEST_MANUALLY_APPROVED with status APPROVED (OwnerAssociationRequestServiceImpl.java:109-114, 137-147, 150-155, 205-211). (c) Remove DOES write an audit row: deleteActiveUserOwnerMapping -> cancelAssociationByOwnerId writes REQUEST_MANUALLY_DECLINED (OwnerAssociationRequestServiceImpl.java:118-122, 164-172). (d) History reads the SAME owner_association_request_activity table these writes target, and its default (non-PENDING) filter is STATUS.ne(PENDING) which INCLUDES both APPROVED and DECLINED manual rows (ReactiveOwnerAssociationRequestActivityRepositoryImpl.java:72-77, 136-137). The Feature sidecars F-172 and F-075 carry the same stale 'no audit trail / UNDOCUMENTED' claim — substrate-refinement signal. Evidence: odd-platform java OwnerAssociationRequestController controller-method:createUserOwnerMapping / OwnerAssociationRequestServiceImpl.java:109-155,205-221 / ReactiveOwnerAssociationRequestActivityRepositoryImpl.java:65-141"
  - "CONFIRMED (page caveat is code-accurate — record for traceability): the Remove permission UI/backend mismatch under #removing-an-existing-binding-active-associations-tab. Backend gate on DELETE /api/owners/mapping/{owner_id} is OWNER_RELATION_MANAGE (SecurityConstants.java:159-162); the UI disables the Remove button on OWNER_ASSOCIATION_MANAGE (ActiveAssociationRequest.tsx:91 `disabled={!hasAccessTo(Permission.OWNER_ASSOCIATION_MANAGE)}`). Two different MANAGEMENT permissions (PolicyPermissionDto.java:68-69) — exactly the split the page documents. Evidence: SecurityConstants.java:159-162 / odd-platform-ui/.../ActiveAssociationRequest.tsx:91"
  - "CONFIRMED (PLT-065 cross-mode bleed — page does NOT mention it; caveat-gap): LOGIN_FORM and LDAP both resolve the principal with provider=null, and the mapping lookup matches `(provider=? OR provider IS NULL)`, so a user_owner_mapping row written under one provider-null mode is honoured under the other. The page treats Provider as a meaningful per-binding discriminator (New requests / Create association / History all surface a Provider column) but never warns that provider-null modes share an identity namespace across an auth.type migration. Evidence: concepts.yaml 'User-Owner Mapping'.security_aggregate (authorization_consistency.detail + weaknesses[0]); getMyObjects sidecar; UserOwnerMappingServiceImpl.java:15-17 (clear-active-then-insert, no provider disambiguation beyond the row's stored value)"
  - "CONFIRMED (page caveat is code-accurate — LSN-002-class operator hazard): under #creating-a-binding-directly-create-association the page states the admin-supplied User field is free text and 'an incorrect username is accepted at the API level and silently produces a binding nobody can sign in to.' Code confirms: createUserOwnerMapping -> createManualAssociationRequest writes the verbatim oidcUsername to the request pojo, and UserOwnerMappingServiceImpl.createRelation does deleteRelation-then-createRelation with NO identity-provider existence check on the username (OwnerAssociationRequestServiceImpl.java:109-148; UserOwnerMappingServiceImpl.java:15-17). Evidence: odd-platform java OwnerAssociationRequestController controller-method:createUserOwnerMapping / UserOwnerMappingServiceImpl.java:15-17"
  - "CONFIRMED (page caveat is code-accurate — self-mint-then-self-bind): under #how-direct_owner_sync-changes-the-user-side-flow the page warns a DIRECT_OWNER_SYNC holder 'can mint a brand-new owner name and self-bind to it in one POST.' Code confirms: createOwnerAssociationRequest calls ownerService.getOrCreate(ownerName) (creates the Owner row when novel) then, if the caller's MANAGEMENT permissions contain DIRECT_OWNER_SYNC, calls userOwnerMappingService.createRelation directly and returns mapToApprovedRequest — no PENDING state, no admin review, in one transaction (OwnerAssociationRequestServiceImpl.java:54-76, @ReactiveTransactional). Matches F-075 branch B. Evidence: odd-platform java OwnerAssociationRequestController controller-method:createOwnerAssociationRequest / OwnerAssociationRequestServiceImpl.java:54-76"
maintainer_curated: false
---

# User-owner association — doc understanding

This page is the canonical operator guide for the **User-Owner Mapping** concept
(`concepts.yaml`: canonical_in_docs, doc alias "User-owner association"): the gate
that turns an authenticated principal (`oidc_username` + `provider`) into an Owner
identity for owner-scoped reads and Policy `is: dataEntity:owner` scoping. It
documents all three operator write-paths, each confirmed against the real graph
node on `OwnerAssociationRequestController`: (A) self-request →
`createOwnerAssociationRequest` (`OwnerAssociationRequestController.java:27`) then
admin approve via `updateOwnerAssociationRequest` (`:55`); (B) self-request +
`DIRECT_OWNER_SYNC` auto-approve short-circuit, same `createOwnerAssociationRequest`
method branching at `OwnerAssociationRequestServiceImpl.java:64`; (C) admin
direct-bind via `createUserOwnerMapping` (`:65`). Remove is
`deleteActiveUserOwnerMapping` (`:75`); History is fed by
`getOwnerAssociationRequestActivityList` (`:48`). These map to features F-142 /
F-075 / F-171 / F-172 / F-173 / F-174 (each confirmed via graph-node to document
exactly this page's surfaces).

The page's operator caveats are unusually strong and mostly **code-accurate**: the
backend-vs-UI permission split on Remove (`OWNER_RELATION_MANAGE` server-side vs
`OWNER_ASSOCIATION_MANAGE` UI-side), the free-text-username silent-dead-binding
hazard, and the `DIRECT_OWNER_SYNC` self-mint-then-self-bind chain all verify
against source. The one real **drift** is the History "Known incompleteness"
warning: it tells operators the direct-bind and remove paths "use a different
controller" and may not appear in History, but in the current code both paths are
methods on the same controller, both write `REQUEST_MANUALLY_APPROVED` /
`REQUEST_MANUALLY_DECLINED` rows into the same `owner_association_request_activity`
table, and History's default filter (`STATUS.ne(PENDING)`) returns them — so the
page understates the audit trail. A secondary caveat-gap: the page never warns that
the LOGIN_FORM/LDAP `provider=null` identity namespace lets a binding bleed across
an `auth.type` migration (PLT-065), despite surfacing Provider as a per-binding
column throughout.

## Maintainer notes
