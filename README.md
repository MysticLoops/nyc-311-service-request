# Large-Scale Predictive Analytics for NYC 311 Service Requests

A Big Data pipeline for processing NYC 311 service requests at scale, performing historical analytics, and predicting service-request resolution-time categories using distributed machine learning.

---

## Project Overview

This project uses the **NYC 311 Service Requests from 2020 to Present** dataset from NYC Open Data.

The project processes millions of municipal service requests through a distributed Big Data pipeline using:

```text
HDFS → Apache Pig → Apache Hive → Apache Spark / Spark MLlib
```

The primary objective is to investigate whether characteristics available when a service request is submitted can be used to predict its eventual resolution-time category.

### Research Question

> Can large-scale machine learning predict the resolution-time category of NYC 311 service requests using request characteristics available at the time of submission?

### Resolution-Time Categories

| Category | Resolution Time |
|---|---|
| FAST | < 24 hours |
| MODERATE | 24–72 hours |
| SLOW | > 72 hours |

---

## Dataset

### Source

**NYC 311 Service Requests from 2020 to Present**

NYC Open Data API:

```text
https://data.cityofnewyork.us/resource/erm2-nwe9
```

### Data Coverage

The project processes:

```text
2020
2021
2022
2023
2024
2025
2026
```

The dataset contains service-request information including:

- Request creation and closure dates
- Agency
- Complaint type
- Descriptors
- Location information
- Borough
- Administrative information
- Geographic coordinates
- Request status

---

## Technology Stack

| Technology | Role |
|---|---|
| **HDFS** | Distributed storage of raw and cleaned data |
| **Apache Pig** | Large-scale data cleaning and preprocessing |
| **Apache Hive** | Historical and descriptive analytics using SQL |
| **Apache Spark** | Distributed feature engineering |
| **Spark MLlib** | Distributed machine learning and model evaluation |
| **Git / GitHub** | Source-code and documentation management |

---

## System Architecture

```text
                         NYC Open Data
                              │
                              ▼
                       NYC 311 Dataset
                              │
                              ▼
                             HDFS
                       Raw Data Storage
                              │
                              ▼
                         Apache Pig
                   Cleaning & Preprocessing
                              │
                              ▼
                      Cleaned HDFS Data
                              │
                 ┌────────────┴────────────┐
                 │                         │
                 ▼                         ▼
            Apache Hive              Apache Spark
       Historical Analytics        Feature Engineering
                                           │
                                           ▼
                                      Spark MLlib
                                           │
                                           ▼
                                   Model Evaluation
                                           │
                                           ▼
                                        Dashboard
```

---

## Data Processing Pipeline

### 1. HDFS

Raw NYC 311 data is stored year-wise in HDFS:

```text
/nyc311/raw/full/2020/
/nyc311/raw/full/2021/
/nyc311/raw/full/2022/
/nyc311/raw/full/2023/
/nyc311/raw/full/2024/
/nyc311/raw/full/2025/
/nyc311/raw/full/2026/
```

---

### 2. Apache Pig

Apache Pig performs large-scale preprocessing of the raw data.

The final preprocessing script is:

```text
pig/clean_311_final.pig
```

The preprocessing stage includes:

- Header removal
- Required-field filtering
- Duplicate removal using `unique_key`
- Date parsing
- Resolution-time calculation
- Temporal outlier filtering
- Spatial outlier filtering
- Resolution-category generation
- Final 29-field projection

The cleaned data is written to:

```text
/nyc311/cleaned_final/
```

with year-wise directories:

```text
/nyc311/cleaned_final/2020
/nyc311/cleaned_final/2021
/nyc311/cleaned_final/2022
/nyc311/cleaned_final/2023
/nyc311/cleaned_final/2024
/nyc311/cleaned_final/2025
/nyc311/cleaned_final/2026
```

---

### 3. Apache Hive

Hive provides SQL-based historical analysis over the cleaned dataset.

Planned analytics include:

- Service requests by year
- Resolution category distribution
- Average resolution time
- Resolution time by borough
- Complaint-type frequency
- Agency-level statistics
- Year-over-year trends
- FAST, MODERATE, and SLOW distributions

Hive is used for descriptive and historical analysis rather than machine learning.

---

### 4. Apache Spark

Spark reads the cleaned data from HDFS and performs distributed feature engineering.

Potential features include:

- Agency
- Complaint type
- Descriptor
- Location type
- Incident ZIP
- Address type
- City
- Facility type
- Community board
- Council district
- Police precinct
- Borough
- Latitude
- Longitude
- Features derived from `created_date`

Temporal features may include:

```text
created_year
created_month
created_day
created_hour
day_of_week
```

---

### 5. Spark MLlib

Spark MLlib is used for the classification task.

The machine learning pipeline is:

```text
Cleaned Data
     │
     ▼
Feature Engineering
     │
     ▼
String Indexing
     │
     ▼
One-Hot Encoding
     │
     ▼
Vector Assembly
     │
     ▼
Train/Test Split
     │
     ▼
Classification Model
     │
     ▼
Predictions
     │
     ▼
Evaluation
```

The target variable is:

```text
resolution_category
```

with three classes:

```text
FAST
MODERATE
SLOW
```

---

## Data Cleaning

The Pig preprocessing stage applies the following operational rules.

### Required Fields

Records are retained only when essential fields are available:

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

### Temporal Filtering

The accepted resolution-time range is:

```text
2 minutes ≤ resolution time ≤ 180 days
```

Equivalent range in hours:

```text
0.033333 ≤ resolution_hours ≤ 4320
```

This removes near-instantaneous closures and extremely long operational outliers.

### Spatial Filtering

The project uses the following NYC geographic boundary:

```text
40.47 ≤ latitude ≤ 40.92
-74.26 ≤ longitude ≤ -73.70
```

---

## Machine Learning Target

The continuous resolution time is converted into three categories:

```text
FAST
    resolution_hours < 24

MODERATE
    24 ≤ resolution_hours ≤ 72

SLOW
    resolution_hours > 72
```

The classification target is:

```text
resolution_category
```

---

## Data Leakage Prevention

The model must only use information that would have been available when the service request was submitted.

The following fields are therefore excluded from the predictive feature set:

```text
closed_date
resolution_hours
resolution_category
```

`resolution_category` is the target variable, while `closed_date` and `resolution_hours` contain information about the eventual outcome.

This prevents the model from using future information to predict the resolution category.

---

## Final Dataset Schema

The cleaned dataset contains **29 fields**:

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

For the complete schema documentation, see:

```text
docs/schema.md
```

---

## Repository Structure

```text
nyc-311-project/
│
├── data/
│   └── sample/
│       ├── nyc311_sample.csv
│       ├── nyc311_sample.json
│       └── nyc311_sample_local.csv
│
├── docs/
│   ├── pipeline.md
│   └── schema.md
│
├── hive/
│   ├── create_tables.hql
│   └── analytics.hql
│
├── output/
│
├── pig/
│   └── clean_311_final.pig
│
├── scripts/
│
├── spark/
│   └── src/
│
├── config/
│
├── README.md
└── .gitignore
```

---

## Team Responsibilities

### Person 1

Responsible for:

- HDFS setup
- Raw data storage
- Apache Pig preprocessing
- Data cleaning
- Data validation
- Apache Hive analytics
- Pipeline documentation

### Person 2

Responsible for:

- Apache Spark
- Feature engineering
- Spark MLlib
- Model training
- Model evaluation
- Dashboard and visualization

Both team members work from the same cleaned dataset produced by the Pig preprocessing stage.

---

## Data Management

The raw and processed datasets are large and are **not stored in GitHub**.

GitHub is used for:

- Source code
- Pig scripts
- Hive scripts
- Spark code
- Configuration
- Documentation
- Small sample datasets

Large datasets are transferred separately between team members using external storage and are excluded from Git using `.gitignore`.

---

## Documentation

Additional project documentation:

### Pipeline Documentation

```text
docs/pipeline.md
```

Contains the detailed HDFS → Pig → Hive → Spark pipeline and processing stages.

### Schema Documentation

```text
docs/schema.md
```

Contains the complete 29-field schema, field groups, derived fields, ML usage, and leakage-prevention rules.

---

## Expected Output

The completed system is intended to provide:

1. A cleaned, distributed NYC 311 dataset.
2. Historical analytics using Hive.
3. Distributed feature engineering using Spark.
4. A machine learning model for predicting resolution-time categories.
5. Model evaluation using classification metrics.
6. A dashboard presenting historical and predictive results.

Potential evaluation metrics include:

- Accuracy
- Precision
- Recall
- F1-score
- Confusion matrix

---

## Project Objective Summary

The project combines multiple Big Data technologies, with each tool serving a distinct role:

```text
HDFS
→ Distributed storage

Apache Pig
→ Data cleaning and preprocessing

Apache Hive
→ Historical SQL analytics

Apache Spark
→ Distributed feature engineering

Spark MLlib
→ Machine learning and prediction

Dashboard
→ Visualization and presentation
```

The cleaned dataset generated by Apache Pig serves as the common data layer for both the Hive analytics pipeline and the Spark machine learning pipeline.
