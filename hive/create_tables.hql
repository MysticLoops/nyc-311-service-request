-- NYC 311 Cleaned Data
-- External Hive table with year partitions

CREATE DATABASE IF NOT EXISTS nyc311;

USE nyc311;

DROP TABLE IF EXISTS service_requests;

CREATE EXTERNAL TABLE service_requests (
    unique_key              STRING,
    created_date            STRING,
    closed_date             STRING,
    agency                  STRING,
    agency_name             STRING,
    complaint_type          STRING,
    descriptor              STRING,
    descriptor_2            STRING,
    location_type           STRING,
    incident_zip            STRING,
    incident_address        STRING,
    street_name             STRING,
    cross_street_1          STRING,
    cross_street_2          STRING,
    intersection_street_1   STRING,
    intersection_street_2   STRING,
    address_type            STRING,
    city                    STRING,
    landmark                STRING,
    facility_type           STRING,
    status                  STRING,
    community_board         STRING,
    council_district        STRING,
    police_precinct         STRING,
    borough                 STRING,
    latitude                DOUBLE,
    longitude               DOUBLE,
    resolution_hours        DOUBLE,
    resolution_category     STRING
)
PARTITIONED BY (
    year INT
)
ROW FORMAT DELIMITED
FIELDS TERMINATED BY '\t'
STORED AS TEXTFILE
LOCATION '/nyc311/cleaned_final';
