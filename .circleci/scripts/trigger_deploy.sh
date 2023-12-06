#!/bin/bash

# Checks the new tag of the built image for each service (ui, server, monitor, repository)
# The tag value is persisted in worspace/{service}_image_tag.txt by each respective build job
# If a new image is built with a new tag, a deploy trigger is sent to the sourcifyeth/infra repo


# Define the list of services
services=("ui" "server" "monitor" "repository")

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
    filePath="workspace/${service}_image_tag.txt"

    if [ -f "$filePath" ]; then
        echo "File $filePath exists."

        image_tag_content=$(cat "$filePath")

        # Check if the content is not an empty string
        if [ -n "$image_tag_content" ]; then
            echo "File is not empty."

            body="{\"event_type\":\"deploy\",\"client_payload\":{\"environment\":\"$ENVIRONMENT\",\"component\":\"$service\",\"image_tag\":\""$CIRCLE_BRANCH"@"$image_tag_content"\",\"ref\":\"$CIRCLE_BRANCH\",\"sha\":\"$CIRCLE_SHA1\"}}"

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
        fi
    else
        echo "File $filePath does not exist."
    fi

    # Add a new line for readability
    echo ""
done

# Wait 5 minutes in 1 minute intervals for the deploy to complete. TODO: Replace with a check for the deploy status
for i in {1..5}
do
  echo "Waiting for $i minute(s)..."
  sleep 60
done
echo "Done waiting."