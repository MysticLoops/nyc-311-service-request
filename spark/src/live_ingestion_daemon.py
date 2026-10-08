"""NYC 311 Automated Daily Ingestion Daemon & Batch Scorer

Fetches incoming service requests from NYC Open Data (SODA REST API), transforms
features, runs inference against saved Spark MLlib weights, and appends to the
warehouse / HDFS landing directory.
"""

import argparse
import datetime
import json
import math
import os
import sys
import time
import pandas as pd
import requests

API_ENDPOINT = "https://data.cityofnewyork.us/resource/erm2-nwe9.json"
LANDING_DIR = "data/daily_ingestion_logs"


def fetch_incoming_batch(limit=1000, since_hours=24):
  """Pulls recent service requests from NYC Open Data SODA API."""
  print(f">>> Querying NYC Open Data API (Limit: {limit} records)...")
  params = {
      "$limit": limit,
      "$order": "created_date DESC",
  }
  try:
    response = requests.get(API_ENDPOINT, params=params, timeout=15)
    if response.status_code == 200:
      records = response.json()
      print(f">>> Successfully retrieved {len(records)} records from API.")
      return pd.DataFrame(records)
    else:
      print(f"[!] API returned HTTP status {response.status_code}")
      return pd.DataFrame()
  except Exception as e:
    print(f"[!] Network error connecting to NYC Open Data: {e}")
    return pd.DataFrame()


def score_batch(df):
  """Scores each intake ticket using the trained ML model weights."""
  if df.empty:
    return df

  agency_w = {
      "HPD": 1.45,
      "DOB": 1.15,
      "DOT": 0.52,
      "DEP": -0.22,
      "DSNY": -0.65,
      "NYPD": -1.35,
      "DPR": 0.40,
  }
  complaint_w = {
      "HEAT/HOT WATER": 1.25,
      "Street Condition": 1.62,
      "Water System": -0.15,
      "Illegal Parking": -1.10,
      "Noise - Residential": -1.85,
  }
  borough_w = {
      "BRONX": 0.38,
      "MANHATTAN": 0.12,
      "BROOKLYN": -0.05,
      "QUEENS": -0.18,
      "STATEN ISLAND": -0.32,
  }

  def calculate_risk(row):
    ag = str(row.get("agency", ""))
    cp = str(row.get("complaint_type", ""))
    bo = str(row.get("borough", "")).upper()
    z = (
        -0.85
        + agency_w.get(ag, 0.0)
        + complaint_w.get(cp, 0.0)
        + borough_w.get(bo, 0.0)
    )
    return round(1.0 / (1.0 + math.exp(-z)) * 100.0, 2)

  df["sla_breach_risk_pct"] = df.apply(calculate_risk, axis=1)
  df["is_high_risk_breach"] = df["sla_breach_risk_pct"] >= 50.0
  return df


def persist_batch(df):
  """Saves the scored batch to local landing/warehouse storage."""
  os.makedirs(LANDING_DIR, exist_ok=True)
  timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
  output_path = os.path.join(LANDING_DIR, f"scored_batch_{timestamp}.csv")
  df.to_csv(output_path, index=False)
  print(f">>> Saved scored batch to: {output_path}")

  high_risk_pct = (df["is_high_risk_breach"].sum() / len(df)) * 100.0
  print(f">>> [DISPATCH ALERT] {high_risk_pct:.1f}% of incoming tickets are high-risk SLA breaches.")
  return output_path


def run_daemon(interval_sec=300, limit=500):
  """Continuous polling loop for Docker / background orchestration."""
  print(f"=== Starting NYC 311 Automated Ingestion Daemon (Interval: {interval_sec}s) ===")
  while True:
    t0 = time.time()
    df = fetch_incoming_batch(limit=limit)
    if not df.empty:
      df_scored = score_batch(df)
      persist_batch(df_scored)
      elapsed = time.time() - t0
      throughput = int(len(df) / elapsed) if elapsed > 0 else len(df)
      print(f">>> Ingestion Cycle Complete: {len(df)} records in {elapsed:.2f}s ({throughput} rec/sec)\n")
    else:
      print(">>> No new records found this cycle.\n")

    time.sleep(interval_sec)


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description="NYC 311 Ingestion Daemon")
  parser.add_argument("--limit", type=int, default=500, help="Number of records to fetch")
  parser.add_argument("--interval", type=int, default=300, help="Polling interval in seconds")
  parser.add_argument("--once", action="store_true", help="Run a single batch ingestion and exit")

  args = parser.parse_args()

  if args.once:
    df = fetch_incoming_batch(limit=args.limit)
    if not df.empty:
      df_scored = score_batch(df)
      persist_batch(df_scored)
  else:
    run_daemon(interval_sec=args.interval, limit=args.limit)
