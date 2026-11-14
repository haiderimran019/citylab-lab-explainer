"""Step 1 — CLEAN: drop the legal/boilerplate appendix and keep original line numbers."""

import re

NumberedLine = tuple[int, str]
"""A line of text paired with its original 1-based line number (kept for citations)."""

_APPENDIX = re.compile(r"\bAPPENDIX\b")


def clean(text: str) -> list[NumberedLine]:
    """Return `(line_no, line)` for every line before the first line containing `APPENDIX`.

    Only the part above the appendix holds real data; the rest is ~14 KB of noise.
    Text without an appendix is returned whole. Line numbers start at 1.
    """
    kept: list[NumberedLine] = []
    for line_no, line in enumerate(text.splitlines(), start=1):
        if _APPENDIX.search(line):
            break
        kept.append((line_no, line.rstrip()))
    return kept
