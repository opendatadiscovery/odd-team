"""Shared Java tree-sitter parsing utilities.

Used by the `controllers` axis (emits controller + controller-method nodes)
and the `openapi_tags` axis (joins openapi operations to controller methods
via the method-name == operationId convention from the OpenAPI generator).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

import tree_sitter
import tree_sitter_java


@lru_cache(maxsize=1)
def java_language() -> tree_sitter.Language:
    return tree_sitter.Language(tree_sitter_java.language())


def parse_java(path: Path) -> tree_sitter.Tree:
    parser = tree_sitter.Parser(java_language())
    return parser.parse(path.read_bytes())


@dataclass
class JavaClass:
    """A parsed Java top-level class."""

    file_path: Path
    name: str
    package: str
    annotations: list[str] = field(default_factory=list)  # marker-annotation names like 'RestController'
    implements: list[str] = field(default_factory=list)
    methods: list["JavaMethod"] = field(default_factory=list)


@dataclass
class JavaMethod:
    name: str
    annotations: list[str] = field(default_factory=list)
    return_type: str | None = None
    line: int = 0


def parse_java_class(path: Path) -> JavaClass | None:
    """Return the first top-level class declared in `path`, or None."""
    tree = parse_java(path)
    root = tree.root_node

    package = _package_decl(root)

    for child in root.named_children:
        if child.type != "class_declaration":
            continue
        name = _identifier_text(_first_named_of_type(child, "identifier"))
        if name is None:
            continue
        annotations = _annotation_names(child)
        implements = _implements_list(child)
        methods = _class_methods(child)
        return JavaClass(
            file_path=path,
            name=name,
            package=package or "",
            annotations=annotations,
            implements=implements,
            methods=methods,
        )
    return None


def _package_decl(root) -> str | None:
    for child in root.named_children:
        if child.type == "package_declaration":
            for sub in child.named_children:
                if sub.type in ("scoped_identifier", "identifier"):
                    return sub.text.decode("utf-8") if sub.text else None
    return None


def _annotation_names(class_node) -> list[str]:
    """Return annotation names (e.g., 'RestController' for `@RestController`).

    Looks in the class_declaration's preceding `modifiers` block.
    """
    out: list[str] = []
    for child in class_node.named_children:
        if child.type != "modifiers":
            continue
        for sub in child.named_children:
            if sub.type in ("marker_annotation", "annotation"):
                name_node = _first_named_of_type(sub, "identifier") or _first_named_of_type(
                    sub, "scoped_identifier"
                )
                if name_node and name_node.text:
                    out.append(name_node.text.decode("utf-8"))
    return out


def _implements_list(class_node) -> list[str]:
    """Return implemented interface names from the `super_interfaces` clause."""
    out: list[str] = []
    for child in class_node.named_children:
        if child.type != "super_interfaces":
            continue
        for sub in child.named_children:
            if sub.type == "type_list":
                for type_node in sub.named_children:
                    if type_node.type in ("type_identifier", "scoped_type_identifier"):
                        if type_node.text:
                            out.append(type_node.text.decode("utf-8"))
                    elif type_node.type == "generic_type":
                        ident = _first_named_of_type(type_node, "type_identifier")
                        if ident and ident.text:
                            out.append(ident.text.decode("utf-8"))
    return out


def _class_methods(class_node) -> list[JavaMethod]:
    """Return method declarations in the class body."""
    methods: list[JavaMethod] = []
    body = _first_named_of_type(class_node, "class_body")
    if body is None:
        return methods
    for child in body.named_children:
        if child.type != "method_declaration":
            continue
        name_node = _first_named_of_type(child, "identifier")
        if name_node is None or name_node.text is None:
            continue
        method_name = name_node.text.decode("utf-8")
        annotations: list[str] = []
        for sub in child.named_children:
            if sub.type == "modifiers":
                for ann in sub.named_children:
                    if ann.type in ("marker_annotation", "annotation"):
                        ann_name = _first_named_of_type(ann, "identifier") or _first_named_of_type(
                            ann, "scoped_identifier"
                        )
                        if ann_name and ann_name.text:
                            annotations.append(ann_name.text.decode("utf-8"))
        methods.append(
            JavaMethod(
                name=method_name,
                annotations=annotations,
                line=child.start_point[0] + 1,
            )
        )
    return methods


def _first_named_of_type(node, type_name: str):
    for c in node.named_children:
        if c.type == type_name:
            return c
    return None


def _identifier_text(node) -> str | None:
    if node is None or node.text is None:
        return None
    return node.text.decode("utf-8")


def find_rest_controllers(repo_path: Path) -> list[JavaClass]:
    """Walk `*Controller.java` files under `odd-platform-api/src/main/java` and
    return the parsed `JavaClass` for each top-level class annotated with
    `@RestController`.
    """
    api_root = repo_path / "odd-platform-api" / "src" / "main" / "java"
    if not api_root.is_dir():
        return []
    out: list[JavaClass] = []
    for path in sorted(api_root.rglob("*Controller.java")):
        cls = parse_java_class(path)
        if cls is None:
            continue
        if "RestController" not in cls.annotations:
            continue
        out.append(cls)
    return out


# ----------------------------------------------------------------------------
# Config-prefix support: parse class-level @ConfigurationProperties and
# in-file @Value("${key}") annotations.
# ----------------------------------------------------------------------------


@dataclass
class ConfigPropertiesAnnotation:
    """A class-level `@ConfigurationProperties("prefix")` annotation."""

    prefix: str
    class_name: str
    package: str
    file_path: Path


@dataclass
class ValueAnnotation:
    """A `@Value("${key:default}")` annotation found anywhere in a file."""

    key: str
    default: str | None
    line: int
    enclosing_class: str
    file_path: Path
    field_or_param: str | None = None  # field name or constructor parameter name (best-effort)


def find_config_consumers(
    repo_path: Path,
) -> tuple[list[ConfigPropertiesAnnotation], list[ValueAnnotation]]:
    """Walk Java files under `odd-platform-api/src/main/java` that contain
    `@Value` or `@ConfigurationProperties` (text-prefiltered) and return the
    parsed annotations.

    Two-stage walk: text-grep narrows ~860 files to ~35, then tree-sitter
    parses each of those once to extract both annotation types in one pass.
    """
    api_root = repo_path / "odd-platform-api" / "src" / "main" / "java"
    if not api_root.is_dir():
        return [], []

    config_properties: list[ConfigPropertiesAnnotation] = []
    values: list[ValueAnnotation] = []

    for path in sorted(api_root.rglob("*.java")):
        try:
            text = path.read_bytes()
        except OSError:
            continue
        if (
            b"@Value" not in text
            and b"@ConfigurationProperties" not in text
            and b"@ConditionalOnProperty" not in text
        ):
            continue
        cps, vs = _parse_config_annotations(path, text)
        config_properties.extend(cps)
        values.extend(vs)
    return config_properties, values


def _parse_config_annotations(
    path: Path, text: bytes
) -> tuple[list[ConfigPropertiesAnnotation], list[ValueAnnotation]]:
    parser = tree_sitter.Parser(java_language())
    tree = parser.parse(text)
    root = tree.root_node

    package = _package_decl(root) or ""

    cps: list[ConfigPropertiesAnnotation] = []
    values: list[ValueAnnotation] = []

    # Walk class + record declarations to find class-level @ConfigurationProperties +
    # collect class/record names for @Value's enclosing class. Records are common in
    # modern Java config (e.g. AdditionalLinkProperties is a record, not a class).
    for child in root.named_children:
        if child.type in ("class_declaration", "record_declaration"):
            cps_in_class, values_in_class = _walk_class_for_config(
                child, path=path, package=package
            )
            cps.extend(cps_in_class)
            values.extend(values_in_class)
    return cps, values


def _walk_class_for_config(
    class_node, path: Path, package: str
) -> tuple[list[ConfigPropertiesAnnotation], list[ValueAnnotation]]:
    name_node = _first_named_of_type(class_node, "identifier")
    class_name = _identifier_text(name_node) or "UnknownClass"

    cps: list[ConfigPropertiesAnnotation] = []
    values: list[ValueAnnotation] = []

    # Class-level @ConfigurationProperties from the modifiers block.
    for child in class_node.named_children:
        if child.type == "modifiers":
            for ann in child.named_children:
                if ann.type != "annotation":
                    continue
                ann_name = _annotation_name(ann)
                if ann_name == "ConfigurationProperties":
                    prefix = _annotation_string_arg(ann, named_arg="prefix")
                    if prefix:
                        cps.append(
                            ConfigPropertiesAnnotation(
                                prefix=prefix,
                                class_name=class_name,
                                package=package,
                                file_path=path,
                            )
                        )

    # Walk the whole class declaration (modifiers + body) for @Value /
    # @ConditionalOnProperty annotations. Class-level @ConditionalOnProperty
    # lives in the modifiers block, not the body — body-only walk would miss
    # cases like IngestionDataEntitiesFilter.
    _collect_value_annotations(
        class_node, class_name=class_name, file_path=path, out=values
    )
    return cps, values


def _collect_value_annotations(
    node, class_name: str, file_path: Path, out: list[ValueAnnotation]
) -> None:
    """Recursively walk `node` and append every config-key consumer it finds.

    Two annotation flavours are picked up:
    - `@Value("${key:default}")` — Spring's classic property reference.
    - `@ConditionalOnProperty(value="key", havingValue="...")` — Spring Boot's
      conditional-bean gate. Treated as a config-key consumer because the key
      decides whether the surrounding bean/method is wired in.
    """
    if node.type == "annotation":
        ann_name = _annotation_name(node)
        if ann_name == "Value":
            spel = _annotation_string_arg(node)
            if spel:
                key, default = _parse_spel(spel)
                if key:
                    out.append(
                        ValueAnnotation(
                            key=key,
                            default=default,
                            line=node.start_point[0] + 1,
                            enclosing_class=class_name,
                            file_path=file_path,
                            field_or_param=_value_owner_name(node),
                        )
                    )
        elif ann_name == "ConditionalOnProperty":
            # Try `value = "..."`, then `name = "..."`, then positional string.
            key = (
                _annotation_string_arg(node, named_arg="value")
                or _annotation_string_arg(node, named_arg="name")
                or _annotation_string_arg(node)
            )
            if key:
                having = _annotation_string_arg(node, named_arg="havingValue")
                out.append(
                    ValueAnnotation(
                        key=key,
                        default=f"havingValue={having}" if having else None,
                        line=node.start_point[0] + 1,
                        enclosing_class=class_name,
                        file_path=file_path,
                        field_or_param=f"@ConditionalOnProperty",
                    )
                )
    for c in node.named_children:
        _collect_value_annotations(c, class_name=class_name, file_path=file_path, out=out)


def _annotation_name(ann_node) -> str | None:
    """Return the annotation's identifier (handles both marker and parameterised)."""
    for c in ann_node.named_children:
        if c.type == "identifier":
            return c.text.decode("utf-8") if c.text else None
        if c.type == "scoped_identifier":
            # e.g. org.springframework.beans.factory.annotation.Value — return last segment
            full = c.text.decode("utf-8") if c.text else ""
            return full.rsplit(".", 1)[-1] if full else None
    return None


def _annotation_string_arg(ann_node, named_arg: str | None = None) -> str | None:
    """Return the string value of an annotation argument.

    For `@Value("foo")` returns "foo".
    For `@ConfigurationProperties(prefix = "datacollaboration")` with named_arg="prefix"
    returns "datacollaboration".
    For `@ConfigurationProperties("auth.ldap")` (no named arg) also returns "auth.ldap"
    when called with named_arg="prefix" (we fall back to positional).
    """
    args_node = _first_named_of_type(ann_node, "annotation_argument_list")
    if args_node is None:
        return None
    # Positional case: a single string literal as direct child.
    for c in args_node.named_children:
        if c.type == "string_literal":
            return _string_literal_value(c)
    # Named-arg case: element_value_pair nodes.
    for c in args_node.named_children:
        if c.type == "element_value_pair":
            key_node = _first_named_of_type(c, "identifier")
            key = _identifier_text(key_node)
            if named_arg is None or key == named_arg:
                for sub in c.named_children:
                    if sub.type == "string_literal":
                        return _string_literal_value(sub)
    return None


def _string_literal_value(node) -> str | None:
    """Return the contents of a tree-sitter-java string_literal node.

    The grammar represents the inside as `string_fragment` children between
    quote tokens. Concatenate the fragments.
    """
    if node.text is None:
        return None
    raw = node.text.decode("utf-8")
    if len(raw) >= 2 and raw[0] == '"' and raw[-1] == '"':
        return raw[1:-1]
    return raw


def _parse_spel(spel: str) -> tuple[str | None, str | None]:
    """Parse a SpEL property reference like `${key:default}` into (key, default).

    Returns (None, None) for non-property-reference strings (no `${...}` wrapper).
    Default is None if no `:` separator is present. Defaults that contain `#{}`
    SpEL sub-expressions are returned verbatim (e.g. `#{null}`).
    """
    s = spel.strip()
    if not (s.startswith("${") and s.endswith("}")):
        return None, None
    inner = s[2:-1]
    if ":" in inner:
        # Find the FIRST `:` outside any nested `#{...}` block. The defaults we
        # see in odd-platform are simple — `${key:default}` or `${key:#{null}}`
        # — so this naive scan is fine.
        depth = 0
        for i, ch in enumerate(inner):
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
            elif ch == ":" and depth == 0:
                return inner[:i], inner[i + 1 :]
        return inner, None
    return inner, None


def _value_owner_name(ann_node) -> str | None:
    """Best-effort: return the field or parameter name that the @Value annotates.

    Walks up to the parent and looks at sibling identifiers.
    """
    parent = ann_node.parent
    if parent is None:
        return None
    # Field declaration: modifiers + type + variable_declarator
    if parent.type == "modifiers" and parent.parent is not None:
        decl = parent.parent
        for c in decl.named_children:
            if c.type == "variable_declarator":
                ident = _first_named_of_type(c, "identifier")
                if ident and ident.text:
                    return ident.text.decode("utf-8")
    # Formal parameter: modifiers + type + identifier
    if parent.type == "modifiers" and parent.parent is not None:
        param = parent.parent
        if param.type == "formal_parameter":
            for c in param.named_children:
                if c.type == "identifier" and c.text:
                    return c.text.decode("utf-8")
    return None
