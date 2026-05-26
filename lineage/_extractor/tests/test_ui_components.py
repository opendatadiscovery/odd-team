"""Tests for the ui_components axis extractor.

Hermetic: each test writes a tiny synthetic odd-platform-ui/ tree under tmp_path,
invokes `extract_ui_components`, and asserts on the resulting nodes.
"""
from __future__ import annotations

from pathlib import Path

import pytest

from lineage_extractor.extractors.ui_components import extract_ui_components


def _write(path: Path, content: str) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)
    return path


def _components_root(repo_root: Path) -> Path:
    return repo_root / "odd-platform-ui" / "src" / "components"


def test_no_ui_dir_returns_empty(tmp_path: Path) -> None:
    nodes, edges = extract_ui_components(repo="testrepo", repo_path=tmp_path)
    assert nodes == []
    assert edges == []


def test_function_declaration_default_export(tmp_path: Path) -> None:
    comp = _components_root(tmp_path)
    _write(
        comp / "Foo" / "Foo.tsx",
        "import React from 'react';\n"
        "export default function Foo() { return <div />; }\n",
    )
    nodes, _ = extract_ui_components(repo="testrepo", repo_path=tmp_path)
    assert len(nodes) == 1
    n = nodes[0]
    assert n.axis == "ui_components"
    assert n.kind == "react-component"
    assert n.lang == "ts"
    assert n.descriptor == "Foo"
    assert n.package == "components/Foo"
    assert n.path == "odd-platform-ui/src/components/Foo/Foo.tsx"
    assert n.id == "testrepo ts components/Foo react-component:Foo"
    assert n.metadata["default_export_kind"] == "function-declaration"


def test_arrow_function_via_identifier_reference(tmp_path: Path) -> None:
    comp = _components_root(tmp_path)
    _write(
        comp / "Bar" / "Bar.tsx",
        "import React from 'react';\n"
        "const Bar = () => <span>hi</span>;\n"
        "export default Bar;\n",
    )
    nodes, _ = extract_ui_components(repo="testrepo", repo_path=tmp_path)
    assert len(nodes) == 1
    n = nodes[0]
    assert n.descriptor == "Bar"
    assert n.metadata["default_export_kind"] == "arrow-function"


def test_hoc_wrapped_default_export(tmp_path: Path) -> None:
    comp = _components_root(tmp_path)
    _write(
        comp / "Wrapped" / "Wrapped.tsx",
        "import { memo } from 'react';\n"
        "const Wrapped = () => <div />;\n"
        "export default memo(Wrapped);\n",
    )
    nodes, _ = extract_ui_components(repo="testrepo", repo_path=tmp_path)
    assert len(nodes) == 1
    n = nodes[0]
    # Inner identifier is what we record; the HOC wrap is captured in metadata.
    assert n.descriptor == "Wrapped"
    assert n.metadata["default_export_kind"] == "hoc-wrapped"


def test_re_export_aggregator_is_skipped(tmp_path: Path) -> None:
    """`export { default } from './X'` indicates a pure re-export; the real
    component lives in X.tsx and gets its own node — the aggregator does not.
    """
    comp = _components_root(tmp_path)
    _write(
        comp / "Group" / "index.tsx",
        "export { default } from './Real';\n",
    )
    _write(
        comp / "Group" / "Real.tsx",
        "export default function Real() { return null; }\n",
    )
    nodes, _ = extract_ui_components(repo="testrepo", repo_path=tmp_path)
    assert len(nodes) == 1
    assert nodes[0].descriptor == "Real"


def test_no_default_export_is_skipped(tmp_path: Path) -> None:
    """Files exporting only named symbols (utility / hook libraries) are not
    primary component anchors; the substrate skips them in this axis."""
    comp = _components_root(tmp_path)
    _write(
        comp / "utils.tsx",
        "export function helper() {}\n"
        "export const CONST_X = 42;\n",
    )
    nodes, _ = extract_ui_components(repo="testrepo", repo_path=tmp_path)
    assert nodes == []


def test_excludes_test_and_styles_files(tmp_path: Path) -> None:
    comp = _components_root(tmp_path)
    _write(comp / "Foo" / "Foo.tsx",
           "export default function Foo() { return <div />; }\n")
    _write(comp / "Foo" / "Foo.test.tsx",
           "export default function FooTest() { return null; }\n")
    _write(comp / "Foo" / "Foo.stories.tsx",
           "export default function FooStory() { return null; }\n")
    _write(comp / "Foo" / "FooStyles.tsx",
           "export default function FooStyles() { return null; }\n")
    _write(comp / "Foo" / "Foo.styles.tsx",
           "export default function FooDotStyles() { return null; }\n")
    _write(comp / "Foo" / "__tests__" / "snap.tsx",
           "export default function Snap() { return null; }\n")
    nodes, _ = extract_ui_components(repo="testrepo", repo_path=tmp_path)
    descriptors = {n.descriptor for n in nodes}
    assert descriptors == {"Foo"}


def test_nested_package_paths_disambiguate_same_name(tmp_path: Path) -> None:
    """Two components named `Overview` at different paths should produce two
    distinct nodes with different `package` fields."""
    comp = _components_root(tmp_path)
    _write(
        comp / "Overview" / "Overview.tsx",
        "export default function Overview() { return <div>home</div>; }\n",
    )
    _write(
        comp / "DataEntityDetails" / "Overview" / "Overview.tsx",
        "export default function Overview() { return <div>detail</div>; }\n",
    )
    nodes, _ = extract_ui_components(repo="testrepo", repo_path=tmp_path)
    assert len(nodes) == 2
    packages = {n.package for n in nodes}
    assert packages == {"components/Overview", "components/DataEntityDetails/Overview"}
    ids = {n.id for n in nodes}
    assert ids == {
        "testrepo ts components/Overview react-component:Overview",
        "testrepo ts components/DataEntityDetails/Overview react-component:Overview",
    }


def test_hook_classification(tmp_path: Path) -> None:
    """Hooks are classified into react-query / redux / jotai buckets by name."""
    comp = _components_root(tmp_path)
    _write(
        comp / "Wired" / "Wired.tsx",
        "import { useEffect, useState } from 'react';\n"
        "import { useQuery } from '@tanstack/react-query';\n"
        "import { useDispatch, useSelector } from 'react-redux';\n"
        "import { useAtomValue } from 'jotai';\n"
        "export default function Wired() {\n"
        "  useEffect(() => {});\n"
        "  const [x, setX] = useState(0);\n"
        "  const q = useQuery({ queryKey: ['x'], queryFn: () => 1 });\n"
        "  const d = useDispatch();\n"
        "  const s = useSelector(() => 0);\n"
        "  const a = useAtomValue({});\n"
        "  return <div />;\n"
        "}\n",
    )
    nodes, _ = extract_ui_components(repo="testrepo", repo_path=tmp_path)
    assert len(nodes) == 1
    md = nodes[0].metadata
    assert set(md["hooks_used"]) == {"useEffect", "useState", "useQuery", "useDispatch", "useSelector", "useAtomValue"}
    assert md["react_query_hooks"] == ["useQuery"]
    assert md["redux_hooks"] == ["useDispatch", "useSelector"]
    assert md["jotai_hooks"] == ["useAtomValue"]


def test_child_jsx_extraction(tmp_path: Path) -> None:
    """PascalCase JSX tags are collected; HTML lowercase tags are ignored."""
    comp = _components_root(tmp_path)
    _write(
        comp / "Parent" / "Parent.tsx",
        "import Child from './Child';\n"
        "import { Modal, Tooltip } from '@mui/material';\n"
        "export default function Parent() {\n"
        "  return (\n"
        "    <div className='wrap'>\n"
        "      <Child />\n"
        "      <Modal>\n"
        "        <Tooltip>\n"
        "          <span>text</span>\n"
        "        </Tooltip>\n"
        "      </Modal>\n"
        "    </div>\n"
        "  );\n"
        "}\n",
    )
    nodes, _ = extract_ui_components(repo="testrepo", repo_path=tmp_path)
    assert len(nodes) == 1
    md = nodes[0].metadata
    children = md.get("child_jsx_top", [])
    assert set(children) == {"Child", "Modal", "Tooltip"}
    assert md["child_jsx_count"] == 3


def test_anonymous_arrow_export_uses_filename(tmp_path: Path) -> None:
    """`export default () => ...` is anonymous; descriptor falls back to the
    file's stem name."""
    comp = _components_root(tmp_path)
    _write(
        comp / "Anon" / "Anon.tsx",
        "export default () => <div>hi</div>;\n",
    )
    nodes, _ = extract_ui_components(repo="testrepo", repo_path=tmp_path)
    assert len(nodes) == 1
    n = nodes[0]
    assert n.descriptor == "Anon"
    assert n.metadata["default_export_kind"] == "anonymous"
