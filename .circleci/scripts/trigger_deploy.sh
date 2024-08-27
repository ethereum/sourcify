#!/bin/bash

# Checks the new tag of the built image for each service (server, monitor, repository)
# The tag value is persisted in worspace/{service}_image_sha.txt by each respective build job
# If a new image is built with a new tag, a deploy trigger is sent to the sourcifyeth/infra repo

# Define the list of services
services=("server" "monitor" "repository")

if [ "$CIRCLE_BRANCH" == "staging" ]; then
    ENVIRONMENT='staging'
elif [ "$CIRCLE_BRANCH" == "master" ]; then
    ENVIRONMENT='production'
else
    echo "Invalid branch $CIRCLE_BRANCH. Check your config.yml"
    exit 1
fi

# Loop through each service
for service in "${services[@]}"; do
    # Deploy from amd64 image
    filePath="workspace/${service}_amd64_image_sha.txt"

    if [ -f "$filePath" ]; then
        echo "File $filePath exists."

        image_sha=$(cat "$filePath")

        # Check if the content is not an empty string
        if [ -n "$image_sha" ]; then
            echo "File is not empty."

            image_tag="$CIRCLE_BRANCH"@"$image_sha"
            # sha: Git commit SHA vs. image_sha: Docker image SHA
            body="{\"event_type\":\"deploy\",\"client_payload\":{\"environment\":\"$ENVIRONMENT\",\"component\":\"$service\",\"image_tag\":\"$image_tag\",\"ref\":\"$CIRCLE_BRANCH\",\"sha\":\"$CIRCLE_SHA1\"}}"

            echo "Sending deploy trigger with request body $body"

            curl -L \
                -X POST \
                -H "Accept: application/vnd.github+json" \
                -H "Authorization: Bearer $GH_DISPATCH_TOKEN" \
                -H "X-GitHub-Api-Version: 2022-11-28" \
                "https://api.github.com/repos/sourcifyeth/infra/dispatches" \
                -d $body

            echo "Sent deploy trigger with request body $body"

        else
            echo "File for $service is empty."
            exit 1
        fi
    else
        echo "File $filePath does not exist."
    fi

    # Wait 5 seconds between each service to avoid concurrent Github commits
    echo "Waiting 5 secs..."
    echo ""
    sleep 5
done

# Wait 6 minutes in 1 minute intervals for the deploy to complete. 6 min is 2x the default 3min polling time of ArgoCD
for i in {1..6}; do
    echo "Waiting for $i minute(s)..."
    sleep 60
done
echo "Done waiting."
