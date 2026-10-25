"""Cached, validated downloads from NYC Open Data (Socrata).

Every fetch is paged with an explicit order, cached as Parquet under
research/data/, and checked against an independent count(*) query for the
same filter. A manifest records when each file was fetched and how many rows
the API reported, so the notebook can show its provenance.
"""

from __future__ import annotations

import io
import json
import time
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import requests

DATA = Path(__file__).parent / "data"
MANIFEST = DATA / "manifest.json"
API = "https://data.cityofnewyork.us"

SIGHTINGS_2010_2019 = "76ig-c548"
SIGHTINGS_2020_ON = "erm2-nwe9"
PLUTO = "64uk-42ks"
INSPECTIONS = "p937-wjvj"

RAT_SIGHTING = "complaint_type='Rodent' AND descriptor='Rat Sighting'"
RAT_ACTIVITY = "result in('Failed for Rat Activity','Failed for Rat Activity and Other Reason')"


def _get(url: str, params: dict, attempts: int = 4) -> requests.Response:
    for attempt in range(attempts):
        try:
            response = requests.get(url, params=params, timeout=300)
            if response.status_code in (408, 429) or response.status_code >= 500:
                raise requests.HTTPError(f"{response.status_code} from {url}")
            response.raise_for_status()
            return response
        except (requests.ConnectionError, requests.Timeout, requests.HTTPError):
            if attempt == attempts - 1:
                raise
            time.sleep(2 * 2**attempt)
    raise RuntimeError("unreachable")


def count(dataset: str, where: str) -> int:
    rows = _get(
        f"{API}/resource/{dataset}.json",
        {"$select": "count(*) as n", "$where": where},
    ).json()
    return int(rows[0]["n"])


def metadata(dataset: str) -> dict:
    meta = _get(f"{API}/api/views/{dataset}.json", {}).json()
    return {
        "name": meta.get("name"),
        "updated": datetime.fromtimestamp(
            meta.get("rowsUpdatedAt", 0), timezone.utc
        ).isoformat(),
        "url": f"{API}/d/{dataset}",
    }


def _manifest() -> dict:
    return json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}


def _record(name: str, entry: dict) -> None:
    manifest = _manifest()
    manifest[name] = entry
    MANIFEST.write_text(json.dumps(manifest, indent=2, sort_keys=True))


def fetch(
    name: str,
    dataset: str,
    select: str,
    where: str,
    order: str,
    group: str | None = None,
    total: str | None = None,
    page: int = 50_000,
    refresh: bool = False,
) -> pd.DataFrame:
    """Download every row matching `where` (or every group) and cache it.

    Ungrouped fetches are reconciled with count(*); grouped fetches must name
    a `total` column whose sum equals count(*). A mismatch raises, so a partial
    download can never be mistaken for the full record.
    """
    DATA.mkdir(exist_ok=True)
    path = DATA / f"{name}.parquet"
    if path.exists() and not refresh:
        return pd.read_parquet(path)
    frames, offset = [], 0
    while True:
        params = {
            "$select": select,
            "$where": where,
            "$order": order,
            "$limit": page,
            "$offset": offset,
        }
        if group:
            params["$group"] = group
        text = _get(f"{API}/resource/{dataset}.csv", params).text
        frame = pd.read_csv(io.StringIO(text), dtype=str)
        frames.append(frame)
        if len(frame) < page:
            break
        offset += page
    data = pd.concat(frames, ignore_index=True)
    expected = count(dataset, where)
    got = int(pd.to_numeric(data[total]).sum()) if group else len(data)
    if expected != got:
        raise ValueError(
            f"{name}: downloaded {got:,} records but the API counts {expected:,}"
        )
    data.to_parquet(path, index=False)
    _record(
        name,
        {
            "dataset": dataset,
            "where": where,
            "group": group,
            "rows": len(data),
            "api_count": expected,
            "fetched": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            **metadata(dataset),
        },
    )
    return data


def manifest() -> dict:
    return _manifest()


def normalize_bbl(values: pd.Series) -> pd.Series:
    """Ten-digit borough-block-lot strings; anything else becomes missing.

    Socrata serves BBLs as text or as decimals ("1000010010.00000000"), so
    they are parsed as numbers and re-padded. Valid BBLs have a borough code
    of 1-5 and non-zero block and lot.
    """
    numeric = pd.to_numeric(values, errors="coerce")
    whole = numeric.where(numeric.notna() & (numeric == numeric.round()))
    text = whole.dropna().astype("int64").astype(str).str.zfill(10)
    valid = (
        text.str.len().eq(10)
        & text.str[0].isin(list("12345"))
        & text.str[1:6].ne("00000")
        & text.str[6:].ne("0000")
    )
    return text.where(valid).reindex(values.index)


def sightings(refresh: bool = False) -> pd.DataFrame:
    """Every 311 rat-sighting report, 2010 onward, with its lot and date."""
    select = "unique_key, created_date, bbl, borough, incident_zip, location_type"
    early = fetch(
        "sightings_2010_2019",
        SIGHTINGS_2010_2019,
        select,
        f"{RAT_SIGHTING} AND created_date >= '2010-01-01T00:00:00' "
        "AND created_date < '2020-01-01T00:00:00'",
        "unique_key",
        refresh=refresh,
    )
    late = fetch(
        "sightings_2020_on",
        SIGHTINGS_2020_ON,
        select,
        f"{RAT_SIGHTING} AND created_date >= '2020-01-01T00:00:00'",
        "unique_key",
        refresh=refresh,
    )
    data = pd.concat([early, late], ignore_index=True)
    data["created_date"] = pd.to_datetime(data["created_date"])
    data["bbl_raw"] = data["bbl"]
    data["bbl"] = normalize_bbl(data["bbl"])
    return data


def pluto(refresh: bool = False) -> pd.DataFrame:
    """Every tax lot in the current PLUTO release, with a few lot traits."""
    data = fetch(
        "pluto",
        PLUTO,
        "bbl, borocode, block, lot, landuse, bldgclass, unitsres, unitstotal, "
        "numbldgs, lotarea, bldgarea, condono, latitude, longitude, version",
        "bbl IS NOT NULL",
        "bbl",
        refresh=refresh,
    )
    data["bbl"] = normalize_bbl(data["bbl"])
    for column in ["unitsres", "unitstotal", "numbldgs", "lotarea", "bldgarea"]:
        data[column] = pd.to_numeric(data[column], errors="coerce")
    for column in ["latitude", "longitude"]:
        data[column] = pd.to_numeric(data[column], errors="coerce")
    return data


def inspections(start: str, end: str, refresh: bool = False) -> pd.DataFrame:
    """Initial DOHMH rodent inspections per lot in [start, end): how many,
    and how many found active rat signs. Grouped on the server."""
    data = fetch(
        f"inspections_{start}_{end}",
        INSPECTIONS,
        "bbl, count(*) as inspections, "
        f"sum(case({RAT_ACTIVITY}, 1, true, 0)) as rat_activity",
        f"inspection_type='Initial' AND inspection_date >= '{start}T00:00:00' "
        f"AND inspection_date < '{end}T00:00:00' AND bbl IS NOT NULL",
        "bbl",
        group="bbl",
        total="inspections",
        refresh=refresh,
    )
    data["bbl"] = normalize_bbl(data["bbl"])
    data["inspections"] = pd.to_numeric(data["inspections"])
    data["rat_activity"] = pd.to_numeric(data["rat_activity"])
    return data.dropna(subset=["bbl"]).groupby("bbl", as_index=False).sum()


def treatments(start: str, end: str, refresh: bool = False) -> pd.DataFrame:
    """Lots that received a DOHMH treatment (baiting) in [start, end)."""
    data = fetch(
        f"treatments_{start}_{end}",
        INSPECTIONS,
        "bbl, count(*) as treatments",
        f"inspection_type='Treatments' AND inspection_date >= '{start}T00:00:00' "
        f"AND inspection_date < '{end}T00:00:00' AND bbl IS NOT NULL",
        "bbl",
        group="bbl",
        total="treatments",
        refresh=refresh,
    )
    data["bbl"] = normalize_bbl(data["bbl"])
    data["treatments"] = pd.to_numeric(data["treatments"])
    return data.dropna(subset=["bbl"]).groupby("bbl", as_index=False).sum()


def rodent_complaints(start: str, end: str, refresh: bool = False) -> pd.DataFrame:
    """Every 311 Rodent complaint per lot and descriptor in [start, end),
    for testing which complaint definition the original study used."""
    data = fetch(
        f"rodent_{start}_{end}",
        SIGHTINGS_2010_2019,
        "bbl, descriptor, count(*) as complaints",
        f"complaint_type='Rodent' AND created_date >= '{start}T00:00:00' "
        f"AND created_date < '{end}T00:00:00' AND bbl IS NOT NULL",
        "bbl, descriptor",
        group="bbl, descriptor",
        total="complaints",
        refresh=refresh,
    )
    data["bbl"] = normalize_bbl(data["bbl"])
    data["complaints"] = pd.to_numeric(data["complaints"])
    return data.dropna(subset=["bbl"])
