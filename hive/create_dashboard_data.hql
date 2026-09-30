USE nyc311;

-- ============================================================
-- 1. YEARLY REQUEST VOLUME
-- ============================================================

INSERT OVERWRITE DIRECTORY '/nyc311/dashboard/yearly_requests'
ROW FORMAT DELIMITED
FIELDS TERMINATED BY ','
SELECT
    year AS request_year,
    COUNT(*) AS total_requests
FROM service_requests
GROUP BY year
ORDER BY request_year;


-- ============================================================
-- 2. RESOLUTION CATEGORY DISTRIBUTION
-- ============================================================

INSERT OVERWRITE DIRECTORY '/nyc311/dashboard/resolution_distribution'
ROW FORMAT DELIMITED
FIELDS TERMINATED BY ','
SELECT
    resolution_category,
    COUNT(*) AS total_requests,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) AS percentage
FROM service_requests
GROUP BY resolution_category
ORDER BY total_requests DESC;


-- ============================================================
-- 3. YEARLY AVERAGE RESOLUTION TIME
-- ============================================================

INSERT OVERWRITE DIRECTORY '/nyc311/dashboard/yearly_resolution'
ROW FORMAT DELIMITED
FIELDS TERMINATED BY ','
SELECT
    year AS request_year,
    ROUND(AVG(resolution_hours), 2) AS avg_resolution_hours
FROM service_requests
GROUP BY year
ORDER BY request_year;


-- ============================================================
-- 4. BOROUGH PERFORMANCE
-- ============================================================

INSERT OVERWRITE DIRECTORY '/nyc311/dashboard/borough_performance'
ROW FORMAT DELIMITED
FIELDS TERMINATED BY ','
SELECT
    borough,
    COUNT(*) AS total_requests,
    ROUND(AVG(resolution_hours), 2) AS avg_resolution_hours,

    ROUND(
        SUM(CASE WHEN resolution_category = 'FAST' THEN 1 ELSE 0 END)
        * 100.0 / COUNT(*), 2
    ) AS fast_percentage,

    ROUND(
        SUM(CASE WHEN resolution_category = 'MODERATE' THEN 1 ELSE 0 END)
        * 100.0 / COUNT(*), 2
    ) AS moderate_percentage,

    ROUND(
        SUM(CASE WHEN resolution_category = 'SLOW' THEN 1 ELSE 0 END)
        * 100.0 / COUNT(*), 2
    ) AS slow_percentage

FROM service_requests
GROUP BY borough
ORDER BY total_requests DESC;


-- ============================================================
-- 5. TOP 15 COMPLAINT TYPES
-- ============================================================

INSERT OVERWRITE DIRECTORY '/nyc311/dashboard/top_complaints'
ROW FORMAT DELIMITED
FIELDS TERMINATED BY ','
SELECT
    complaint_type,
    COUNT(*) AS total_requests
FROM service_requests
GROUP BY complaint_type
ORDER BY total_requests DESC
LIMIT 15;


-- ============================================================
-- 6. COMPLAINT TYPE × RESOLUTION CATEGORY
-- ============================================================

INSERT OVERWRITE DIRECTORY '/nyc311/dashboard/complaint_resolution'
ROW FORMAT DELIMITED
FIELDS TERMINATED BY ','
SELECT
    complaint_type,
    resolution_category,
    COUNT(*) AS total_requests
FROM service_requests
GROUP BY complaint_type, resolution_category
ORDER BY complaint_type, resolution_category;


-- ============================================================
-- 7. AGENCY PERFORMANCE
-- ============================================================

INSERT OVERWRITE DIRECTORY '/nyc311/dashboard/agency_performance'
ROW FORMAT DELIMITED
FIELDS TERMINATED BY ','
SELECT
    agency,
    COUNT(*) AS total_requests,
    ROUND(AVG(resolution_hours), 2) AS avg_resolution_hours,

    ROUND(
        SUM(CASE WHEN resolution_category = 'FAST' THEN 1 ELSE 0 END)
        * 100.0 / COUNT(*), 2
    ) AS fast_percentage,

    ROUND(
        SUM(CASE WHEN resolution_category = 'MODERATE' THEN 1 ELSE 0 END)
        * 100.0 / COUNT(*), 2
    ) AS moderate_percentage,

    ROUND(
        SUM(CASE WHEN resolution_category = 'SLOW' THEN 1 ELSE 0 END)
        * 100.0 / COUNT(*), 2
    ) AS slow_percentage

FROM service_requests
GROUP BY agency
ORDER BY total_requests DESC;


-- ============================================================
-- 8. MONTHLY REQUEST VOLUME
-- ============================================================

INSERT OVERWRITE DIRECTORY '/nyc311/dashboard/monthly_requests'
ROW FORMAT DELIMITED
FIELDS TERMINATED BY ','
SELECT
    year AS request_year,

    MONTH(
        FROM_UNIXTIME(
            COALESCE(
                UNIX_TIMESTAMP(
                    REGEXP_REPLACE(created_date, 'T', ' '),
                    'yyyy-MM-dd HH:mm:ss.SSS'
                ),
                UNIX_TIMESTAMP(
                    created_date,
                    'MM/dd/yyyy hh:mm:ss a'
                )
            )
        )
    ) AS request_month,

    COUNT(*) AS total_requests

FROM service_requests

GROUP BY
    year,
    MONTH(
        FROM_UNIXTIME(
            COALESCE(
                UNIX_TIMESTAMP(
                    REGEXP_REPLACE(created_date, 'T', ' '),
                    'yyyy-MM-dd HH:mm:ss.SSS'
                ),
                UNIX_TIMESTAMP(
                    created_date,
                    'MM/dd/yyyy hh:mm:ss a'
                )
            )
        )
    )

ORDER BY request_year, request_month;


-- ============================================================
-- 9. HOURLY REQUEST VOLUME
-- ============================================================

INSERT OVERWRITE DIRECTORY '/nyc311/dashboard/hourly_requests'
ROW FORMAT DELIMITED
FIELDS TERMINATED BY ','
SELECT
    HOUR(
        FROM_UNIXTIME(
            COALESCE(
                UNIX_TIMESTAMP(
                    REGEXP_REPLACE(created_date, 'T', ' '),
                    'yyyy-MM-dd HH:mm:ss.SSS'
                ),
                UNIX_TIMESTAMP(
                    created_date,
                    'MM/dd/yyyy hh:mm:ss a'
                )
            )
        )
    ) AS request_hour,

    COUNT(*) AS total_requests

FROM service_requests

GROUP BY
    HOUR(
        FROM_UNIXTIME(
            COALESCE(
                UNIX_TIMESTAMP(
                    REGEXP_REPLACE(created_date, 'T', ' '),
                    'yyyy-MM-dd HH:mm:ss.SSS'
                ),
                UNIX_TIMESTAMP(
                    created_date,
                    'MM/dd/yyyy hh:mm:ss a'
                )
            )
        )
    )

ORDER BY request_hour;


-- ============================================================
-- 10. OVERALL RESOLUTION-TIME STATISTICS
-- ============================================================

INSERT OVERWRITE DIRECTORY '/nyc311/dashboard/resolution_stats'
ROW FORMAT DELIMITED
FIELDS TERMINATED BY ','
SELECT
    ROUND(AVG(resolution_hours), 2) AS average_hours,
    ROUND(PERCENTILE_APPROX(resolution_hours, 0.50), 2) AS median_hours,
    ROUND(PERCENTILE_APPROX(resolution_hours, 0.90), 2) AS p90_hours,
    ROUND(PERCENTILE_APPROX(resolution_hours, 0.95), 2) AS p95_hours
FROM service_requests;
