"""JSONL nodes/edges I/O.

Each line in nodes.jsonl is a Node; each line in edges.jsonl is an Edge.
Stable IDs: `{repo} {lang} {package} {kind}:{descriptor}` (greppable, not opaque).
"""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Iterable, Iterator


@dataclass
class Node:
    id: str
    repo: str
    lang: str
    package: str
    kind: str
    descriptor: str
    path: str
    axis: str
    documents: list[str] | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    @staticmethod
    def make_id(repo: str, lang: str, package: str, kind: str, descriptor: str) -> str:
        return f"{repo} {lang} {package} {kind}:{descriptor}"


@dataclass
class Edge:
    src: str
    dst: str
    type: str
    metadata: dict[str, Any] = field(default_factory=dict)


def write_nodes(path: Path, nodes: Iterable[Node]) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    count = 0
    with path.open("w") as fh:
        for node in nodes:
            fh.write(json.dumps(asdict(node), ensure_ascii=False, sort_keys=True))
            fh.write("\n")
            count += 1
    return count


def write_edges(path: Path, edges: Iterable[Edge]) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    count = 0
    with path.open("w") as fh:
        for edge in edges:
            fh.write(json.dumps(asdict(edge), ensure_ascii=False, sort_keys=True))
            fh.write("\n")
            count += 1
    return count


def read_nodes(path: Path) -> Iterator[Node]:
    if not path.is_file():
        return
    with path.open("r") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            data = json.loads(line)
            yield Node(**data)


def read_edges(path: Path) -> Iterator[Edge]:
    if not path.is_file():
        return
    with path.open("r") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            data = json.loads(line)
            yield Edge(**data)
