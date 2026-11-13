import pytest

from jobwatcher.title_rule import in_role

IN_ROLE = [
    "Credit Analyst II",
    "Commercial Credit Analyst - Oil & Gas",
    "Commercial Credit Analyst - Energy",
    "Associate - Energy Banking PM",
    "Investment Banking Analyst - Financial Services - Depositories",
    "Investment & Corporate Banking – Energy - Oil & Gas, Analyst (Houston, TX)",
    "Credit Products Specialized Industries Associate - Oil & Gas",
    "Corporate Banking Analyst II",
    "M&A Associate",
    "Treasury and Trade Finance Analyst",
    "Underwriting Associate",
    "Banker Development Program",
    "Credit Risk Analyst",
    "Analyst, Leveraged Finance Group",
]

NOT_IN_ROLE = [
    "Credit Analyst Intern",                          # internship
    "2028 Investment Banking Summer Analyst",         # summer program
    "Senior Credit Analyst",                          # senior level
    "Credit Analyst III",                             # senior level
    "Vice President - Underwriting & Portfolio Management",
    "Director, Energy Banking Portfolio Manager",
    "Commercial Loan Officer",
    "Cyber Risk Mgmt Sr Analyst",                     # technology risk
    "Third Party Risk Analyst I",                     # vendor risk, not credit
    "Corporate Banking Operations Analyst",           # operations
    "Trade Finance Servicing, Analyst",               # servicing
    "Credit Analyst (6 Months Contract)",             # contract
    "Personal Banker Associate I",                    # retail branch
    "HR Intern",
    "Software Engineer",
    "Financial Analyst",                              # FP&A is not the chosen role
    "",
]


@pytest.mark.parametrize("title", IN_ROLE)
def test_in_role(title):
    assert in_role(title)


@pytest.mark.parametrize("title", NOT_IN_ROLE)
def test_not_in_role(title):
    assert not in_role(title)


def test_case_insensitive():
    assert in_role("CREDIT ANALYST") and in_role("credit analyst")
