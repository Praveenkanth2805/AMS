"""Business rules for attendance day status."""

PERIODS_PER_DAY = 5

# Day is present iff:
#   - P5 (index 4) is present (compulsory), AND
#   - at least MIN_P1_P4_PRESENT of P1..P4 are present
MIN_P1_P4_PRESENT = 2


def compute_day_status(periods: list[bool]) -> str:
    """Return 'present' or 'absent' from a list of 5 period booleans."""
    if len(periods) != PERIODS_PER_DAY:
        raise ValueError(f"expected {PERIODS_PER_DAY} periods, got {len(periods)}")
    # P5 compulsory
    if not periods[4]:
        return "absent"
    # At least 2 of P1-P4
    first_four = sum(1 for p in periods[:4] if p)
    return "present" if first_four >= MIN_P1_P4_PRESENT else "absent"


def expand_legacy_status(status: str) -> list[bool]:
    """Legacy single-status rows → 5 identical periods."""
    return [status == "present"] * PERIODS_PER_DAY