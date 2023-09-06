#!/bin/bash

# Checks the new SHA value of the built image for each service (ui, server, monitor, repository)
# The SHA value is persisted in worspace/{service}_image_sha.txt by each respective build job
# If a new image is built with a new SHA, a deploy trigger is sent to the sourcifyeth/infra repo


# Define the list of services
services=("ui" "server" "monitor" "repository")

if [ "$CIRCLE_BRANCH" == "staging" ]; then 
    ENVIRONMENT='staging'
fi

elif [ "$CIRCLE_BRANCH" == "master" ]; then
    ENVIRONMENT='production'
fi
else
    echo "Invalid branch $CIRCLE_BRANCH. Check your config.yml"
    exit 1
fi

# Loop through each service
for service in "${services[@]}"; do
    filename="workspace/${service}_image_sha.txt"

    if [ -f "$filename" ]; then
        echo "File $filename exists."

        image_sha_content=$(cat "$filename")

        # Check if the content is not an empty string
        if [ -n "$content" ]; then
            echo "File is not empty."
            
            # Save the SHA value to a variable
            sha_value="$content"
            # curl -L \
            #     -X POST \
            #     -H "Accept: application/vnd.github+json" \
            #     -H "Authorization: Bearer $GH_DISPATCH_TOKEN" \
            #     -H "X-GitHub-Api-Version: 2022-11-28" \
            #     https://api.github.com/repos/sourcifyeth/infra/dispatches \
            #     -d '{"event_type":"deploy","client_payload":{"environment":$ENVIRONMENT,"component":$service, "image_tag":$image_sha_content }}'
            echo "Sent deploy trigger for $ENVIRONMENT/$service with SHA $sha_value"
        else
            echo "File for $service is empty."
        fi
    else
        echo "File $filename does not exist."
    fi

    # Add a new line for readability
    echo ""
done