"""Title rule: is a posting in my role?

Role: entry-level, full-time credit / risk analyst, commercial or corporate
banking analyst, or investment banking / M&A analyst.

A title is in role when ALL of these hold:
  1. it names a credit, risk, lending, banking, M&A or trade-finance area
  2. it names an early-career level (analyst, associate, underwriter, program)
  3. it does not name an internship, a senior level, a technology-risk job,
     operations / support work, or a part-time or contract job

Location is not part of the rule; Houston is a location filter on the Browse
page and the first section of the daily issue.
"""

import re

AREA = re.compile(
    r"\bcredit\b|underwrit|\brisk\b|\bportfolio\b|\blending\b|\bloan\b"
    r"|commercial bank|corporate bank|energy bank|investment bank|\bib\b"
    r"|\bm&a\b|mergers|acquisitions|capital markets|leveraged finance"
    r"|trade finance|structured finance|project finance|restructuring"
    r"|banker development|development program|analyst program|rotational",
    re.I,
)
LEVEL = re.compile(r"\banalyst\b|\bassociate\b|\bunderwriter\b|\bprogram\b|\btrainee\b|\bdevelopment\b", re.I)
EXCLUDE = re.compile(
    r"\bintern(ship)?\b|\bsummer\b|\bco-?op\b|\bvice president\b|\bvp\b|\bavp\b|\bsvp\b"
    r"|\bdirector\b|\bmanaging\b|\bsenior\b|\bsr\.?\b|\blead\b|\bprincipal\b|\bhead\b"
    r"|\bofficer\b|\bmanager\b|\bsupervisor\b|\biii\b|\biv\b"
    r"|cyber|information security|technology risk|\bit\b|engineer|developer"
    # analyst titles that are operations / support work, not credit or deal work
    r"|operations|servicing|onboarding|\bdata\b|\bkyc\b|client services|client liaison"
    r"|administrator|third party|financial crimes|fraud|collections"
    r"|part-time|contract\b|temporary",
    re.I,
)


def in_role(title: str) -> bool:
    title = title or ""
    return bool(AREA.search(title) and LEVEL.search(title) and not EXCLUDE.search(title))
