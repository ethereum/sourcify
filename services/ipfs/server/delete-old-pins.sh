#!/bin/bash

BASE_URL="https://api.estuary.tech" # Replace with your API base URL
DAYS_BACK=2
LIMIT=1000
# ESTUARY_PINNING_SECRET should be already set in your environment

# Header for authorization
AUTH_HEADER="Authorization: Bearer $ESTUARY_PINNING_SECRET"

# Calculate the date in the required format
calculate_date() {
    # date -u -d "${DAYS_BACK} days ago" +"%Y-%m-%dT00:00:%SZ"
    # MacOS has a different date command
    date -v-${DAYS_BACK}d +"%Y-%m-%dT00:00:%SZ"
}

# Fetch pins before a certain date
fetch_pins_before_date() {
    local before_date="$1"
    curl -s -H "$AUTH_HEADER" "${BASE_URL}/pinning/pins?before=${before_date}&limit=${LIMIT}"
}

# Delete a pin by pinid
delete_pin() {
    local pinid="$1"
    curl -s -H "$AUTH_HEADER" -X DELETE "${BASE_URL}/pinning/pins/${pinid}"
    echo "Deleted pin with ID: ${pinid}"
}

# Main function to cleanup old pins
cleanup_old_pins() {
    local before_date
    before_date=$(calculate_date)

    local pins
    pins=$(fetch_pins_before_date "$before_date")

    # Assuming the response is a JSON array and you only need pinid to delete them.
    local pinids
    pinids=$(echo "$pins" | jq -r '.results[] | .requestid')

    # Loop through the pins and delete them
    while IFS= read -r pinid; do
        if [ -n "$pinid" ]; then
            delete_pin $pinid
        fi
    done <<< "$pinids"
}

# Execute the main function
cleanup_old_pins