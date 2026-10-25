# Draft records request: NYC Health rodent inspection data

A draft Freedom of Information Law (FOIL) request to the NYC Department of
Health and Mental Hygiene, asking for the fields the public Rodent Inspection
dataset ([p937-wjvj](https://data.cityofnewyork.us/d/p937-wjvj)) leaves out.
Requests go through the city's portal, [OpenRecords](https://a860-openrecords.nyc.gov/),
addressed to the Department of Health and Mental Hygiene. Review and edit before
sending; nothing here has been submitted.

---

**Subject:** Rodent inspection records: inspection source, active-sign scores and burrow counts

To the Records Access Officer, NYC Department of Health and Mental Hygiene:

Under the New York State Freedom of Information Law (Public Officers Law,
Article 6), I request electronic copies, in CSV or another machine-readable
format, of the following records for all rodent inspections conducted from
January 1, 2009 to the present. This is for non-commercial research on
estimating New York City's rat population from public data.

1. **Inspection source:** for each inspection already published in the Rodent
   Inspection dataset on NYC Open Data (identified by its `JOB_ID` and
   inspection date), the field or code that records why it was made. Examples
   are a 311 complaint (with the service request number, if recorded),
   proactive neighborhood indexing, a rat mitigation zone sweep, or another
   program.
2. **Active rat sign scores:** for each of those inspections, the score recorded
   for each active rat sign (for example, the 0–3 scores for burrows, runways,
   gnawing, droppings and live rats described in CDC, *MMWR* 61(37), 2012).
3. **Burrow counts:** the number of active burrows recorded at each inspection,
   if that is recorded.
4. **Program areas:** the boundaries (or the lists of tax blocks) of each
   neighborhood indexing area and rat mitigation zone, with the dates each
   round of block-by-block inspections began and ended.
5. **Population estimates:** any internal estimates of rat abundance or
   population size for the city, a borough, or a program area, and the
   methodology documents behind them.

I do not need names, contact details or other personal information about
property owners or complainants, and they may be withheld or redacted. If any
part of this request is denied, please cite the exemption for that part and
release the rest. If fees will exceed $25, please tell me before processing.
If the records are large, I am happy to receive them in batches, starting
with items 1 and 2 for 2010–2011 and 2023–2024.

Thank you,

[Name]
[Email]

---

## Why each item matters

| Item | What it replaces in `rat_population.py` |
|:---|:---|
| 1. Inspection source | The inferred sweeps in §6.1 (≥5 lots a day, ≤20% complaint-preceded). A real flag removes assumption W1. |
| 2. Sign scores | Lets "infested" be graded rather than yes/no, a basis for estimating colony size per infested block (A6b). |
| 3. Burrow counts | Turns the burrow cross-check in §6.4 from a floor into an estimate, using NYC Health's 1–12 rats per burrow. |
| 4. Program areas | Defines the swept population exactly, so §6.3's strata and transfer assumptions (W2, W3) can be checked. |
| 5. Internal estimates | A direct comparison, if any exist. |
