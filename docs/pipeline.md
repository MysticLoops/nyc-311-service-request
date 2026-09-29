# NYC 311 Big Data Pipeline

## 1. Project Overview

This project implements a large-scale data processing and predictive analytics pipeline using the **NYC 311 Service Requests from 2020 to Present** dataset.

The objective is to process millions of municipal service requests, perform historical analysis, and build a machine learning model to predict the expected resolution-time category of a service request.

### Research Question

> Can large-scale machine learning predict the resolution-time category of NYC 311 service requests using request characteristics available at the time of submission?

### Resolution-Time Categories

| Category | Resolution Time |
|---|---|
| FAST | < 24 hours |
| MODERATE | 24–72 hours |
| SLOW | > 72 hours |

---

## 2. Data Source

The project uses the **NYC 311 Service Requests from 2020 to Present** dataset published through NYC Open Data.

Dataset API:

```text
https://data.cityofnewyork.us/resource/erm2-nwe9
```

The project processes data covering:

```text
2020
2021
2022
2023
2024
2025
2026
```

The dataset contains information about service requests such as:

- Request creation date
- Request closure date
- Agency
- Complaint type
- Descriptor
- Location information
- Borough
- Geographic coordinates
- Status
- Resolution information

---

## 3. Technology Stack

The project uses the following Big Data technologies:

```text
HDFS
  ↓
Apache Pig
  ↓
Apache Hive
  ↓
Apache Spark / Spark MLlib
```

| Technology | Purpose |
|---|---|
| HDFS | Distributed storage of large datasets |
| Apache Pig | Large-scale data cleaning and preprocessing |
| Apache Hive | SQL-based historical analysis |
| Apache Spark | Distributed feature engineering and machine learning |
| Spark MLlib | Classification and model evaluation |
| Git/GitHub | Source-code and documentation management |

---

## 4. Overall Pipeline

```text
                    NYC Open Data
                         │
                         ▼
                NYC 311 Raw Dataset
                         │
                         ▼
                    HDFS Raw Data
                         │
                         ▼
                 Apache Pig
              Data Cleaning
                         │
                         ▼
              Cleaned HDFS Data
                    /2020
                    /2021
                    /2022
                    /2023
                    /2024
                    /2025
                    /2026
                    │
              ┌──────────┴──────────┐
              ▼                     ▼
        Apache Hive            Apache Spark
     Historical Analytics     Feature Engineering
                                    │
                                    ▼
                               Spark MLlib
                                    │
                                    ▼
                             Model Evaluation
                                    │
                                    ▼
                              Final Dashboard
```

---

## 5. HDFS Data Storage

The raw NYC 311 data is stored in HDFS under:

```text
/nyc311/raw/full/
```

Year-wise raw data is organized as:

```text
/nyc311/raw/full/2020/
/nyc311/raw/full/2021/
/nyc311/raw/full/2022/
/nyc311/raw/full/2023/
/nyc311/raw/full/2024/
/nyc311/raw/full/2025/
/nyc311/raw/full/2026/
```

The raw data remains in HDFS and is used as the input to the Pig preprocessing stage.

---

## 6. Apache Pig - Data Cleaning

Apache Pig is used for large-scale preprocessing of the raw NYC 311 data.

The final preprocessing script is:

```text
pig/clean_311_final.pig
```

The script processes the data year by year.

### 6.1 Input

Pig reads CSV files from:

```text
/nyc311/raw/full/$YEAR/*.csv
```

where `$YEAR` represents the processing year.

### 6.2 Header Removal

CSV header records are removed before processing.

This prevents column names from being interpreted as actual service-request records.

### 6.3 Required Field Filtering

Records are retained only when essential fields are available, including:

- `unique_key`
- `created_date`
- `closed_date`
- `agency`
- `complaint_type`

Records missing required information are removed.

### 6.4 Duplicate Removal

Records are deduplicated using:

```text
unique_key
```

The `unique_key` is treated as the identifier for a service request.

### 6.5 Date Parsing

The dataset contains different date formats across different years.

The preprocessing pipeline handles the relevant formats separately.

#### 2020–2021

Dates are processed from the ISO-style format:

```text
YYYY-MM-DDTHH:MM:SS
```

#### 2022 onwards

Dates are processed from the legacy format:

```text
MM/DD/YYYY HH:MM:SS AM/PM
```

The parsed dates are used to calculate the resolution time.

---

## 7. Resolution-Time Calculation

Resolution time is calculated from:

```text
closed_date - created_date
```

The result is converted into hours.

Conceptually:

```text
resolution_hours =
    (closed_date - created_date) / 3600
```

The calculated value is stored in:

```text
resolution_hours
```

---

## 8. Temporal Outlier Filtering

Some service requests contain unrealistic or operationally problematic resolution durations.

The preprocessing pipeline applies the following operational boundary:

```text
2 minutes ≤ resolution time ≤ 180 days
```

In hours:

```text
0.033333 hours ≤ resolution_hours ≤ 4320 hours
```

Records outside this range are removed.

This removes:

- Near-instantaneous closures
- Extremely long unresolved or abandoned-looking tickets

---

## 9. Spatial Outlier Filtering

Geographic coordinates are filtered to retain locations within a reasonable NYC boundary.

The project uses:

```text
40.47 ≤ latitude ≤ 40.92
```

and:

```text
-74.26 ≤ longitude ≤ -73.70
```

Invalid coordinates such as:

```text
latitude = 0
longitude = 0
```

are therefore excluded by the geographic filtering.

---

## 10. Resolution-Time Categorization

After calculating `resolution_hours`, each service request is assigned a resolution category.

```text
FAST       → resolution_hours < 24
MODERATE   → 24 ≤ resolution_hours ≤ 72
SLOW       → resolution_hours > 72
```

These categories form the target variable for the classification model.

---

## 11. Cleaned Data Output

The final cleaned data is stored in HDFS under:

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

The cleaned dataset contains **29 fields**.

The complete schema is documented in:

```text
docs/schema.md
```

---

## 12. Cleaned Dataset Schema

The final dataset contains:

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

---

## 13. Apache Hive - Historical Analytics

Apache Hive is used for SQL-based analysis of the cleaned dataset.

The Hive layer is responsible for generating historical and descriptive statistics before machine learning.

Examples of analysis include:

- Total service requests by year
- Resolution category distribution
- Average resolution time
- Resolution time by borough
- Complaint-type frequency
- Agency-level request statistics
- Year-over-year request trends
- Distribution of FAST, MODERATE, and SLOW requests

Hive operates on the cleaned data stored in HDFS.

---

## 14. Apache Spark - Feature Engineering

Apache Spark is used for distributed feature engineering and machine learning.

Spark reads the cleaned dataset from:

```text
/nyc311/cleaned_final/
```

The feature engineering stage uses information available at the time a service request is created.

Potential predictive features include:

- Agency
- Complaint type
- Descriptor
- Location type
- Borough
- Incident ZIP
- Address type
- Facility type
- Created date
- Created hour
- Day of week
- Month
- Other request characteristics available at submission

---

## 15. Data Leakage Prevention

A major requirement of the machine learning pipeline is preventing information from the future from being used to predict the resolution category.

The following fields are used to calculate the target but must **not** be used as predictive features:

```text
closed_date
resolution_hours
resolution_category
```

### Target

```text
resolution_category
```

### Features

Features must be derived only from information available when the service request is submitted.

This ensures that the model is predicting the resolution category rather than simply receiving information that already reveals the outcome.

---

## 16. Spark MLlib - Machine Learning

Spark MLlib is used to train and evaluate distributed classification models.

The machine learning pipeline consists of:

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
Feature Vector Assembly
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

The primary prediction target is:

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

## 17. Model Evaluation

The machine learning models are evaluated using appropriate classification metrics.

The evaluation stage may include:

- Accuracy
- Precision
- Recall
- F1-score
- Confusion matrix

The evaluation results will be used to understand how effectively the model predicts different resolution-time categories.

---

## 18. Data Sharing Between Team Members

The cleaned dataset is large and is not stored in GitHub.

The cleaned data is transferred separately between team members using external storage.

The repository contains:

- Source code
- Pig scripts
- Hive scripts
- Spark source code
- Configuration files
- Documentation
- Small sample datasets

Large raw and processed datasets are excluded from Git using `.gitignore`.

---

## 19. Team Responsibilities

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

Both components use the same cleaned dataset produced by the Pig preprocessing stage.

---

## 20. Final Architecture

The final project architecture is:

```text
                         NYC Open Data
                              │
                              ▼
                         Raw 311 Data
                              │
                              ▼
                             HDFS
                              │
                              ▼
                         Apache Pig
                              │
                  Data Cleaning & Filtering
                              │
                              ▼
                     Cleaned 311 Data
                              │
                 ┌────────────┴────────────┐
                 │                         │
                 ▼                         ▼
            Apache Hive              Apache Spark
                 │                         │
                 ▼                         ▼
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

## 21. Project Repository Structure

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

## 22. Summary

The project follows a distributed Big Data architecture in which each technology has a specific role:

```text
HDFS
→ Distributed storage

Pig
→ Data cleaning and preprocessing

Hive
→ Historical SQL analytics

Spark
→ Distributed feature engineering

Spark MLlib
→ Machine learning and prediction

Dashboard
→ Visualization and presentation
```

The cleaned NYC 311 dataset produced by Apache Pig acts as the common input for both the Hive analytics layer and the Spark machine learning layer.
