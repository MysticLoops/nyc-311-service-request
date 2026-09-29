-- ============================================================
-- NYC 311 FINAL CLEANING PIPELINE
-- Pig 0.18.0
--
-- Handles:
--   1. Header removal
--   2. Required-field filtering
--   3. Deduplication by unique_key
--   4. Multiple timestamp formats
--   5. Chronological timestamp validation
--   6. Resolution-time calculation
--   7. Temporal outlier filtering
--   8. Spatial outlier filtering
--   9. Resolution-time categorization
--
-- Input:
--   /nyc311/raw/full/$YEAR/*.csv
--
-- Output:
--   /nyc311/cleaned_final/$YEAR
-- ============================================================


-- 1. Load raw CSV data
raw_data = LOAD '/nyc311/raw/full/$YEAR/*.csv'
USING org.apache.pig.piggybank.storage.CSVExcelStorage()
AS (
    unique_key:chararray,
    created_date:chararray,
    closed_date:chararray,
    agency:chararray,
    agency_name:chararray,
    complaint_type:chararray,
    descriptor:chararray,
    descriptor_2:chararray,
    location_type:chararray,
    incident_zip:chararray,
    incident_address:chararray,
    street_name:chararray,
    cross_street_1:chararray,
    cross_street_2:chararray,
    intersection_street_1:chararray,
    intersection_street_2:chararray,
    address_type:chararray,
    city:chararray,
    landmark:chararray,
    facility_type:chararray,
    status:chararray,
    due_date:chararray,
    resolution_description:chararray,
    resolution_action_updated_date:chararray,
    community_board:chararray,
    council_district:chararray,
    police_precinct:chararray,
    bbl:chararray,
    borough:chararray,
    x_coordinate_state_plane:chararray,
    y_coordinate_state_plane:chararray,
    open_data_channel_type:chararray,
    park_facility_name:chararray,
    park_borough:chararray,
    vehicle_type:chararray,
    taxi_company_borough:chararray,
    taxi_pick_up_location:chararray,
    bridge_highway_name:chararray,
    bridge_highway_direction:chararray,
    road_ramp:chararray,
    bridge_highway_segment:chararray,
    latitude:chararray,
    longitude:chararray,
    location:chararray
);


-- 2. Remove header and keep required records
no_header = FILTER raw_data BY
    unique_key != 'unique_key';

required_data = FILTER no_header BY
    unique_key IS NOT NULL AND
    unique_key != '' AND
    created_date IS NOT NULL AND
    created_date != '' AND
    closed_date IS NOT NULL AND
    closed_date != '' AND
    agency IS NOT NULL AND
    agency != '' AND
    complaint_type IS NOT NULL;


-- 3. Deduplicate by unique_key
grouped = GROUP required_data BY unique_key;

deduplicated = FOREACH grouped {
    first_record = LIMIT required_data 1;
    GENERATE FLATTEN(first_record);
};


-- 4. Parse timestamps
--
-- 2020-2021:
--   2020-09-25T15:43:34.000
--
-- 2022+ legacy format:
--   01/01/2022 01:56:24 AM
--
-- Detect the format from the first four characters.

iso_data = FILTER deduplicated BY
    SUBSTRING(REPLACE(created_date, '"', ''), 0, 4)
    MATCHES '[0-9]{4}';

legacy_data = FILTER deduplicated BY
    NOT (
        SUBSTRING(REPLACE(created_date, '"', ''), 0, 4)
        MATCHES '[0-9]{4}'
    );


-- Parse ISO timestamps
iso_parsed = FOREACH iso_data GENERATE
    *,
    ToDate(
        REPLACE(
            REPLACE(created_date, '"', ''),
            'T',
            ' '
        ),
        'yyyy-MM-dd HH:mm:ss.SSS'
    ) AS created_dt,
    ToDate(
        REPLACE(
            REPLACE(closed_date, '"', ''),
            'T',
            ' '
        ),
        'yyyy-MM-dd HH:mm:ss.SSS'
    ) AS closed_dt;


-- Parse legacy timestamps
legacy_parsed = FOREACH legacy_data GENERATE
    *,
    ToDate(
        REPLACE(REPLACE(created_date, '"', ''), 'T', ' '),
        'MM/dd/yyyy hh:mm:ss a'
    ) AS created_dt,
    ToDate(
        REPLACE(REPLACE(closed_date, '"', ''), 'T', ' '),
        'MM/dd/yyyy hh:mm:ss a'
    ) AS closed_dt;


-- Combine both timestamp formats
parsed_data = UNION ONSCHEMA iso_parsed, legacy_parsed;


-- 5. Keep records with valid chronological timestamps
valid_dates = FILTER parsed_data BY
    created_dt IS NOT NULL AND
    closed_dt IS NOT NULL AND
    closed_dt >= created_dt;


-- 6. Calculate resolution time in hours
--
-- SecondsBetween(end, start)
-- Therefore:
--   SecondsBetween(closed_dt, created_dt)
--
with_resolution = FOREACH valid_dates GENERATE
    *,
    (SecondsBetween(closed_dt, created_dt) / 3600.0)
    AS resolution_hours;


-- 7. Temporal operational boundary
--
-- Remove:
--   < 2 minutes
--   > 180 days
--
temporal_clean = FILTER with_resolution BY
    resolution_hours >= 0.033333 AND
    resolution_hours <= 4320.0;


-- 8. Validate spatial coordinates
--
-- NYC safe bounding box:
--   Latitude:  40.47 to 40.92
--   Longitude: -74.26 to -73.70
--
-- Also removes missing coordinates and 0,0.

spatial_clean = FILTER temporal_clean BY
    latitude IS NOT NULL AND
    longitude IS NOT NULL AND
    latitude != '' AND
    longitude != '' AND
    latitude != '0' AND
    longitude != '0' AND
    (double)latitude >= 40.47 AND
    (double)latitude <= 40.92 AND
    (double)longitude >= -74.26 AND
    (double)longitude <= -73.70;


-- 9. Create resolution category
--
-- FAST:
--   < 24 hours
--
-- MODERATE:
--   24 to 72 hours
--
-- SLOW:
--   > 72 hours

final_data = FOREACH spatial_clean GENERATE
    REPLACE(unique_key, '\t', ' ') AS unique_key,
    REPLACE(created_date, '\t', ' ') AS created_date,
    REPLACE(closed_date, '\t', ' ') AS closed_date,
    REPLACE(agency, '\t', ' ') AS agency,
    REPLACE(agency_name, '\t', ' ') AS agency_name,
    REPLACE(complaint_type, '\t', ' ') AS complaint_type,
    REPLACE(descriptor, '\t', ' ') AS descriptor,
    REPLACE(descriptor_2, '\t', ' ') AS descriptor_2,
    REPLACE(location_type, '\t', ' ') AS location_type,
    REPLACE(incident_zip, '\t', ' ') AS incident_zip,
    REPLACE(incident_address, '\t', ' ') AS incident_address,
    REPLACE(street_name, '\t', ' ') AS street_name,
    REPLACE(cross_street_1, '\t', ' ') AS cross_street_1,
    REPLACE(cross_street_2, '\t', ' ') AS cross_street_2,
    REPLACE(intersection_street_1, '\t', ' ') AS intersection_street_1,
    REPLACE(intersection_street_2, '\t', ' ') AS intersection_street_2,
    REPLACE(address_type, '\t', ' ') AS address_type,
    REPLACE(city, '\t', ' ') AS city,
    REPLACE(landmark, '\t', ' ') AS landmark,
    REPLACE(facility_type, '\t', ' ') AS facility_type,
    REPLACE(status, '\t', ' ') AS status,
    REPLACE(community_board, '\t', ' ') AS community_board,
    REPLACE(council_district, '\t', ' ') AS council_district,
    REPLACE(police_precinct, '\t', ' ') AS police_precinct,
    REPLACE(borough, '\t', ' ') AS borough,
    latitude,
    longitude,
    resolution_hours,
    (
        resolution_hours < 24.0
        ? 'FAST'
        : (
            resolution_hours <= 72.0
            ? 'MODERATE'
            : 'SLOW'
        )
    ) AS resolution_category;


-- 10. Store cleaned data
STORE final_data
INTO '/nyc311/cleaned_final/$YEAR'
USING PigStorage('\t');
