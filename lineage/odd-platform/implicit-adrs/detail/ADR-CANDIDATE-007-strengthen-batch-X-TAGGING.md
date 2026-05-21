## STRENGTHENS — Batch X-TAGGING (ADR-CANDIDATE-007 — 6 new tag-controller-method confirmations of the uniform Mono pipeline)

**Six new controller-method sidecars confirm the uniform `Mono<ResponseEntity<T>>` return type with no controller-level exception translation.**

- `createTag.md` — `tagFormData.collectList().map(tagService::bulkCreate).map(ResponseEntity::ok)` → `Mono<ResponseEntity<Flux<Tag>>>`, HTTP 200. (`TagController.java:22-28`)
- `getPopularTagList.md` — `tagService.listMostPopular(...).map(ResponseEntity::ok)` → `Mono<ResponseEntity<TagsResponse>>`. (`TagController.java:36-44`)
- `updateTag.md` — `tagFormData.flatMap(fd -> tagService.update(tagId, fd)).map(ResponseEntity::ok)` → `Mono<ResponseEntity<Tag>>`. (`TagController.java:46-52`)
- `deleteTag.md` — `tagService.delete(tagId).then(Mono.just(ResponseEntity.noContent().build()))` → `Mono<ResponseEntity<Void>>`, HTTP 204. **This is the documented delete sub-pattern** (`.then(...noContent()...)` for 204) the ADR already names.
- `createTermTagsRelations.md` — `Mono.just(ResponseEntity.ok(tagsFormData.flatMapMany(fd -> termService.upsertTags(termId, fd))))` → `Mono<ResponseEntity<Flux<Tag>>>`. (`TermController.java:129-136`)
- `updateDatasetFieldTags.md` — `Mono.just(ResponseEntity.ok(tags))` → `Mono<ResponseEntity<Flux<Tag>>>`. (`DatasetFieldController.java:55-63`)

**Architectural refinement**: none of the six methods carries `.onErrorResume`, `.switchIfEmpty`, or any status-code branching at the controller layer — all error mapping is global (`ExceptionUtils` / the global exception handler). The four read+write `TagController` methods plus the two sibling entity-tag write paths all conform. The `createTag`/`updateTag` methods return HTTP 200 (not 201) — a status-code drift against the OpenAPI 201 declaration (REFACTOR-492), but the `.map(ResponseEntity::ok)` SHAPE is the ADR's pattern; the drift is the OpenAPI-vs-code mismatch, not a pipeline deviation.

**Support count**: extended by 6 controller-method sidecars.

**Severity unchanged**: MEDIUM.

---
