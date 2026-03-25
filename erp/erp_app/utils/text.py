import re


def normalize_text(value):
    """Normalize free-text values: trim, collapse spaces, and remove spaces around '-' and '_'"""
    if value in (None, ""):
        return ""

    text = str(value).strip()
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"\s*([-_])\s*", r"\1", text)
    return text


def to_title_case(value):
    """Normalize option-like values and store them in title case."""
    text = normalize_text(value)
    if not text:
        return ""
    return text.title()
