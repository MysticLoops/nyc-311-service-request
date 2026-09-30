-- ============================================================
-- NYC 311 Hive Analytics
-- Dashboard-oriented queries
-- ============================================================

USE nyc311;


-- ============================================================
-- 1. TOTAL SERVICE REQUESTS BY YEAR
-- ============================================================

SELECT
    year,
    COUNT(*) AS total_requests
FROM service_requests
GROUP BY year
ORDER BY year;


-- ============================================================
-- 2. RESOLUTION CATEGORY DISTRIBUTION
-- ============================================================

SELECT
    resolution_category,
    COUNT(*) AS request_count,
    ROUND(
        100.0 * COUNT(*) / SUM(COUNT(*)) OVER (),
        2
    ) AS percentage
FROM service_requests
GROUP BY resolution_category
ORDER BY request_count DESC;


-- ============================================================
-- 3. AVERAGE RESOLUTION TIME BY YEAR
-- ============================================================

SELECT
    year,
    ROUND(AVG(resolution_hours), 2) AS avg_resolution_hours
FROM service_requests
GROUP BY year
ORDER BY year;


-- ============================================================
-- 4. BOROUGH PERFORMANCE
-- ============================================================

SELECT
    borough,
    COUNT(*) AS total_requests,
    ROUND(AVG(resolution_hours), 2) AS avg_resolution_hours,

    ROUND(
        100.0 * SUM(
            CASE WHEN resolution_category = 'FAST' THEN 1 ELSE 0 END
        ) / COUNT(*),
        2
    ) AS fast_percentage,

    ROUND(
        100.0 * SUM(
            CASE WHEN resolution_category = 'MODERATE' THEN 1 ELSE 0 END
        ) / COUNT(*),
        2
    ) AS moderate_percentage,

    ROUND(
        100.0 * SUM(
            CASE WHEN resolution_category = 'SLOW' THEN 1 ELSE 0 END
        ) / COUNT(*),
        2
    ) AS slow_percentage

FROM service_requests
WHERE borough IS NOT NULL
  AND TRIM(borough) != ''
GROUP BY borough
ORDER BY total_requests DESC;


-- ============================================================
-- 5. TOP 15 COMPLAINT TYPES
-- ============================================================

SELECT
    complaint_type,
    COUNT(*) AS request_count
FROM service_requests
WHERE complaint_type IS NOT NULL
  AND TRIM(complaint_type) != ''
GROUP BY complaint_type
ORDER BY request_count DESC
LIMIT 15;


-- ============================================================
-- 6. COMPLAINT TYPE × RESOLUTION CATEGORY
-- ============================================================

SELECT
    complaint_type,
    resolution_category,
    COUNT(*) AS request_count
FROM service_requests
WHERE complaint_type IS NOT NULL
  AND TRIM(complaint_type) != ''
GROUP BY
    complaint_type,
    resolution_category
ORDER BY
    complaint_type,
    request_count DESC;


-- ============================================================
-- 7. AGENCY PERFORMANCE
-- ============================================================

SELECT
    agency,
    COUNT(*) AS total_requests,
    ROUND(AVG(resolution_hours), 2) AS avg_resolution_hours,

    ROUND(
        100.0 * SUM(
            CASE WHEN resolution_category = 'FAST' THEN 1 ELSE 0 END
        ) / COUNT(*),
        2
    ) AS fast_percentage,

    ROUND(
        100.0 * SUM(
            CASE WHEN resolution_category = 'MODERATE' THEN 1 ELSE 0 END
        ) / COUNT(*),
        2
    ) AS moderate_percentage,

    ROUND(
        100.0 * SUM(
            CASE WHEN resolution_category = 'SLOW' THEN 1 ELSE 0 END
        ) / COUNT(*),
        2
    ) AS slow_percentage

FROM service_requests
WHERE agency IS NOT NULL
  AND TRIM(agency) != ''
GROUP BY agency
ORDER BY total_requests DESC;


-- ============================================================
-- 8. MONTHLY REQUEST VOLUME
-- ============================================================

SELECT
    YEAR(
        FROM_UNIXTIME(
            COALESCE(
                UNIX_TIMESTAMP(created_date, 'yyyy-MM-dd\'T\'HH:mm:ss.SSS'),
                UNIX_TIMESTAMP(created_date, 'MM/dd/yyyy hh:mm:ss a')
            )
        )
    ) AS request_year,

    MONTH(
        FROM_UNIXTIME(
            COALESCE(
                UNIX_TIMESTAMP(created_date, 'yyyy-MM-dd\'T\'HH:mm:ss.SSS'),
                UNIX_TIMESTAMP(created_date, 'MM/dd/yyyy hh:mm:ss a')
            )
        )
    ) AS request_month,

    COUNT(*) AS total_requests

FROM service_requests

GROUP BY
    YEAR(
        FROM_UNIXTIME(
            COALESCE(
                UNIX_TIMESTAMP(created_date, 'yyyy-MM-dd\'T\'HH:mm:ss.SSS'),
                UNIX_TIMESTAMP(created_date, 'MM/dd/yyyy hh:mm:ss a')
            )
        )
    ),
    MONTH(
        FROM_UNIXTIME(
            COALESCE(
                UNIX_TIMESTAMP(created_date, 'yyyy-MM-dd\'T\'HH:mm:ss.SSS'),
                UNIX_TIMESTAMP(created_date, 'MM/dd/yyyy hh:mm:ss a')
            )
        )
    )

ORDER BY request_year, request_month;


-- ============================================================
-- 9. REQUEST VOLUME BY HOUR OF DAY
-- ============================================================

SELECT
    HOUR(
        FROM_UNIXTIME(
            COALESCE(
                UNIX_TIMESTAMP(created_date, 'yyyy-MM-dd\'T\'HH:mm:ss.SSS'),
                UNIX_TIMESTAMP(created_date, 'MM/dd/yyyy hh:mm:ss a')
            )
        )
    ) AS request_hour,

    COUNT(*) AS total_requests

FROM service_requests

GROUP BY
    HOUR(
        FROM_UNIXTIME(
            COALESCE(
                UNIX_TIMESTAMP(created_date, 'yyyy-MM-dd\'T\'HH:mm:ss.SSS'),
                UNIX_TIMESTAMP(created_date, 'MM/dd/yyyy hh:mm:ss a')
            )
        )
    )

ORDER BY request_hour;


-- ============================================================
-- 10. RESOLUTION-TIME STATISTICS
-- ============================================================

SELECT
    ROUND(AVG(resolution_hours), 2) AS average_hours,
    ROUND(
        PERCENTILE_APPROX(resolution_hours, 0.50),
        2
    ) AS median_hours,
    ROUND(
        PERCENTILE_APPROX(resolution_hours, 0.90),
        2
    ) AS p90_hours,
    ROUND(
        PERCENTILE_APPROX(resolution_hours, 0.95),
        2
    ) AS p95_hours
FROM service_requests;
