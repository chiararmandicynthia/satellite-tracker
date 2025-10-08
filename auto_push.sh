#!/bin/bash
set -e
cd /home/ubuntu/tle-tracker || exit 1

# Run the TLE fetcher (this updates static/tle_data.json)
 /home/ubuntu/env/bin/python tle_fetcher.py

# Configure Git identity (only needed once, but safe to keep)
 /usr/bin/git config user.name "chiararmandicynthia"
 /usr/bin/git config user.email "chiara.armandi@outlook.com"

# Add and commit the updated JSON
 /usr/bin/git add static/tle_data.json
 /usr/bin/git commit -m "Daily TLE update $(date '+%Y-%m-%d %H:%M')" || echo "No new TLE data to commit"

# Push directly to GitHub
 /usr/bin/git push https://chiararmandicynthia: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@github.com/chiararmandicynthia/satellite-tracker.git main
