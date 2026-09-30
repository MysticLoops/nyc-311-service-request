USE nyc311;

ALTER TABLE service_requests ADD IF NOT EXISTS
PARTITION (year=2020)
LOCATION '/nyc311/cleaned_final/2020';

ALTER TABLE service_requests ADD IF NOT EXISTS
PARTITION (year=2021)
LOCATION '/nyc311/cleaned_final/2021';

ALTER TABLE service_requests ADD IF NOT EXISTS
PARTITION (year=2022)
LOCATION '/nyc311/cleaned_final/2022';

ALTER TABLE service_requests ADD IF NOT EXISTS
PARTITION (year=2023)
LOCATION '/nyc311/cleaned_final/2023';

ALTER TABLE service_requests ADD IF NOT EXISTS
PARTITION (year=2024)
LOCATION '/nyc311/cleaned_final/2024';

ALTER TABLE service_requests ADD IF NOT EXISTS
PARTITION (year=2025)
LOCATION '/nyc311/cleaned_final/2025';

ALTER TABLE service_requests ADD IF NOT EXISTS
PARTITION (year=2026)
LOCATION '/nyc311/cleaned_final/2026';
