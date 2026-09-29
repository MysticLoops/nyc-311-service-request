# NYC 311 Dataset Schema

## 1. Overview

The final cleaned NYC 311 dataset contains **29 fields**.

The dataset is produced by the Apache Pig preprocessing stage and stored year-wise in HDFS under:

```text
/nyc311/cleaned_final/
```

The cleaned dataset is used as the common input for:

- Apache Hive historical analytics
- Apache Spark feature engineering
- Spark MLlib machine learning

---

## 2. Complete Schema

| # | Field | Description |
|---:|---|---|
| 1 | `unique_key` | Unique identifier for the service request |
| 2 | `created_date` | Date and time when the service request was created |
| 3 | `closed_date` | Date and time when the service request was closed |
| 4 | `agency` | Agency responsible for the service request |
| 5 | `agency_name` | Name of the responsible agency |
| 6 | `complaint_type` | Type of complaint or service request |
| 7 | `descriptor` | Additional description of the complaint |
| 8 | `descriptor_2` | Secondary description associated with the complaint |
| 9 | `location_type` | Type of location associated with the request |
| 10 | `incident_zip` | ZIP code associated with the incident |
| 11 | `incident_address` | Address associated with the incident |
| 12 | `street_name` | Street name associated with the incident |
| 13 | `cross_street_1` | First cross street |
| 14 | `cross_street_2` | Second cross street |
| 15 | `intersection_street_1` | First intersection street |
| 16 | `intersection_street_2` | Second intersection street |
| 17 | `address_type` | Type of address associated with the request |
| 18 | `city` | City associated with the request |
| 19 | `landmark` | Landmark associated with the request |
| 20 | `facility_type` | Type of facility associated with the request |
| 21 | `status` | Current status of the service request |
| 22 | `community_board` | NYC community board associated with the request |
| 23 | `council_district` | NYC council district associated with the request |
| 24 | `police_precinct` | Police precinct associated with the request |
| 25 | `borough` | NYC borough associated with the request |
| 26 | `latitude` | Geographic latitude of the request |
| 27 | `longitude` | Geographic longitude of the request |
| 28 | `resolution_hours` | Calculated time taken to resolve the request, in hours |
| 29 | `resolution_category` | Resolution-time category used as the machine learning target |

---

## 3. Field Groups

The fields can be grouped according to their role in the project.

### 3.1 Identification

```text
unique_key
```

Used to uniquely identify service requests and perform deduplication.

---

### 3.2 Temporal Fields

```text
created_date
closed_date
resolution_hours
resolution_category
```

These fields describe the temporal lifecycle and resolution of a service request.

`resolution_hours` is calculated from:

```text
closed_date - created_date
```

---

### 3.3 Agency and Complaint Information

```text
agency
agency_name
complaint_type
descriptor
descriptor_2
```

These fields describe the agency handling the request and the nature of the complaint.

---

### 3.4 Location Information

```text
location_type
incident_zip
incident_address
street_name
cross_street_1
cross_street_2
intersection_street_1
intersection_street_2
address_type
city
landmark
facility_type
```

These fields describe the physical location and address information associated with the service request.

---

### 3.5 Administrative and Geographic Information

```text
status
community_board
council_district
police_precinct
borough
latitude
longitude
```

These fields provide administrative and geographic information associated with the request.

---

## 4. Derived Fields

Two fields are derived during preprocessing.

### `resolution_hours`

The resolution duration is calculated from the difference between the request creation and closure timestamps.

```text
resolution_hours =
    (closed_date - created_date) / 3600
```

The resulting value represents the resolution time in hours.

---

### `resolution_category`

The continuous resolution time is converted into three categories:

| Category | Condition |
|---|---|
| `FAST` | `resolution_hours < 24` |
| `MODERATE` | `24 ≤ resolution_hours ≤ 72` |
| `SLOW` | `resolution_hours > 72` |

This field is the primary target variable for the machine learning classification task.

---

## 5. Machine Learning Usage

The machine learning objective is to predict:

```text
resolution_category
```

using characteristics that are available when the service request is submitted.

Potential predictive features include:

```text
agency
complaint_type
descriptor
descriptor_2
location_type
incident_zip
address_type
city
facility_type
community_board
council_district
police_precinct
borough
latitude
longitude
```

Temporal features can also be derived from:

```text
created_date
```

Examples include:

```text
created_year
created_month
created_day
created_hour
day_of_week
```

---

## 6. Data Leakage Prevention

The following fields must **not** be used as predictive input features because they contain information about the outcome or are directly derived from the outcome:

```text
closed_date
resolution_hours
resolution_category
```

### Target

```text
resolution_category
```

### Excluded from Features

```text
closed_date
resolution_hours
resolution_category
```

The model should use only information that would have been available at the time the service request was submitted.

This prevents the model from receiving information that directly reveals the actual resolution outcome.

---

## 7. Data Cleaning Rules Related to the Schema

The final schema is produced after the following preprocessing operations:

### Required fields

Records must contain valid values for:

```text
unique_key
created_date
closed_date
agency
complaint_type
```

### Deduplication

Duplicate records are removed using:

```text
unique_key
```

### Temporal filtering

Only records satisfying:

```text
2 minutes ≤ resolution time ≤ 180 days
```

are retained.

Equivalent resolution-hour boundary:

```text
0.033333 ≤ resolution_hours ≤ 4320
```

### Spatial filtering

Records are retained within the project's NYC geographic boundary:

```text
40.47 ≤ latitude ≤ 40.92
-74.26 ≤ longitude ≤ -73.70
```

---

## 8. Output Format

The cleaned records are stored as tab-separated values (TSV) in HDFS.

Year-wise output locations:

```text
/nyc311/cleaned_final/2020
/nyc311/cleaned_final/2021
/nyc311/cleaned_final/2022
/nyc311/cleaned_final/2023
/nyc311/cleaned_final/2024
/nyc311/cleaned_final/2025
/nyc311/cleaned_final/2026
```

Each record contains the same 29 fields in the order documented in this file.

---

## 9. Schema Order

For processing and interoperability between Pig, Hive, and Spark, the field order is:

```text
1.  unique_key
2.  created_date
3.  closed_date
4.  agency
5.  agency_name
6.  complaint_type
7.  descriptor
8.  descriptor_2
9.  location_type
10. incident_zip
11. incident_address
12. street_name
13. cross_street_1
14. cross_street_2
15. intersection_street_1
16. intersection_street_2
17. address_type
18. city
19. landmark
20. facility_type
21. status
22. community_board
23. council_district
24. police_precinct
25. borough
26. latitude
27. longitude
28. resolution_hours
29. resolution_category
```

This ordering should be preserved when loading the cleaned data into Hive or Spark.
