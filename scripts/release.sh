#!/bin/bash

# A script to (semi)automate the Sourcify release process.

# Exit immediately if a command exits with a non-zero status.
set -e

# Make sure the script exits if a command in a pipeline fails.
set -o pipefail

# Define color codes
RED='\033[0;31m'
NC='\033[0m' # No Color
YELLOW='\033[0;33m'

###
### Helpers
###

# Function to parse and increment version
increment_version() {
  local version=$1
  local inc_type=$2
  local IFS='.'
  local parts=($version)
  case "$inc_type" in
  "patch")
    parts[2]=$((${parts[2]} + 1))
    ;;
  "minor")
    parts[1]=$((${parts[1]} + 1))
    parts[2]=0
    ;;
  "major")
    parts[0]=$((${parts[0]} + 1))
    parts[1]=0
    parts[2]=0
    ;;
  esac
  echo "${parts[0]}.${parts[1]}.${parts[2]}"
}

# Function to print error message and exit
error_exit() {
  echo ""
  echo -e "${RED}$1${NC}"
  exit 1
}

warn() {
  echo ""
  echo -e "${YELLOW}$1${NC}"
}

###
### Main
###

## Check if the current branch is master
current_branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$current_branch" != "master" ]; then
  error_exit "You are not on the master branch. Please switch to the master branch before running this script."
fi

## Check if the staging and master branches are synced with the origin
echo "Fetching and checking if the staging and master branches are synced with the origin"
# Fetch and check if the staging and master branches are synced with the origin
git fetch origin master:tmpMaster
git fetch origin staging:tmpStaging

LOCAL_MASTER=$(git rev-parse master)
REMOTE_MASTER=$(git rev-parse tmpMaster)

LOCAL_STAGING=$(git rev-parse staging)
REMOTE_STAGING=$(git rev-parse tmpStaging)

# Throw if staging is not syned, otherwise we'll miss commits
if [ $LOCAL_STAGING != $REMOTE_STAGING ]; then
  error_exit "Your local staging branch is not up to date with origin/staging. Please sync before running this script."
fi

if [ $LOCAL_MASTER != $REMOTE_MASTER ]; then
  warn "Your local master branch is not up to date with origin/master. Do you want to continue? (y/N):"
  read user_input
  if [[ $user_input != [yY] && $user_input != [yY][eE][sS] ]]; then
    error_exit "Please sync your local master branch with origin/master before running this script."
  fi
fi

# Clean up temporary branches
git branch -D tmpMaster
git branch -D tmpStaging

####
#### Next, create a Github PR for the staging branch
####
# Check if the gh cli is installed
if ! command -v gh &>/dev/null; then
  error_exit "gh cli could not be found. Please install it before running this script: https://cli.github.com/"
fi

# Check if the user is logged in to gh
if ! gh auth status &>/dev/null; then
  error_exit "You are not logged in to gh. Please log in before running this script."
fi

# Check if an open PR exists from staging to master
OPEN_PR_NUMBER=$(gh pr list --base master --state open | grep staging | awk '{print $1}')
CREATE_PR=true
if [ -n "$OPEN_PR_NUMBER" ]; then
  warn "An open PR from staging to master already exists. Do you still want to create a new PR? (y/N):"
  read confirm
  if [[ $confirm != [yY] && $confirm != [yY][eE][sS] ]]; then
    echo "Skipping PR creation as per user request."
    CREATE_PR=false
  fi
fi

if $CREATE_PR; then
  echo "Creating a PR for the staging branch"
  gh pr create --title "Release" --body "" --head staging --base master
  if [ $? -ne 0 ]; then
    error_exit "Failed to create PR. Exiting."
  fi
  echo "Created PR"
  OPEN_PR_NUMBER=$(gh pr list --base master --state open | grep staging | awk '{print $1}')
else
  echo "Continuing without creating a PR."
fi

# Merge locally
echo "Locally merging staging into master"
git checkout master
git merge staging
echo "Merged staging into master"

###
### Next, check which packages need a new version, update the versions and add CHANGELOG entries
###
echo "Checking which packages need a new version"
# Define arrays to hold package directories, names, and versions
declare -a directories
declare -a packageNames
declare -a versions
declare -A selected_versions

GITHUB_REPO_FULL_NAME=$(gh repo view --json nameWithOwner -q .nameWithOwner)
GITHUB_REPO_URL="https://github.com/${GITHUB_REPO_FULL_NAME}"
GITHUB_PR_URL="${GITHUB_REPO_URL}/pull/${OPEN_PR_NUMBER}"
GITHUB_PR_URL_FILES="${GITHUB_PR_URL}/files"

# Get the list of changed packages
OUTPUT=$(npx lerna changed --all --long --parseable)

if [ -z "$OUTPUT" ]; then
  echo "No packages need to be updated."
  exit 0
fi

# Use process substitution to avoid creating a subshell with a pipeline
while IFS=: read -r directory packageName version tag; do
  directories+=("$directory")
  packageNames+=("$packageName")
  versions+=("$version")
done < <(echo "$OUTPUT")

# For each directory/package to be updated decide on patch, minor, or major.
# Then ask for the changelog input
for index in "${!directories[@]}"; do
  pkg_name="${packageNames[$index]}"
  current_version="${versions[$index]}"

  new_patch=$(increment_version "$current_version" "patch")
  new_minor=$(increment_version "$current_version" "minor")
  new_major=$(increment_version "$current_version" "major")

  echo ""
  echo "=============================="
  echo "$pkg_name"
  echo "Review changes at: $GITHUB_PR_URL_FILES"
  echo "=============================="
  echo "Select a new version for $pkg_name (currently $current_version)"
  PS3="Choose the new version for $pkg_name (1, 2, or 3): "
  select version_type in "Patch ($new_patch)" "Minor ($new_minor)" "Major ($new_major)"; do
    case $version_type in
    "Patch ($new_patch)")
      echo "You selected $version_type"
      selected_versions["$pkg_name"]=$new_patch
      break
      ;;
    "Minor ($new_minor)")
      echo "You selected $version_type"
      selected_versions["$pkg_name"]=$new_minor
      break
      ;;
    "Major ($new_major)")
      echo "You selected $version_type"
      selected_versions["$pkg_name"]=$new_major
      break
      ;;
    *)
      echo "Invalid option, try again."
      ;;
    esac
  done

  ###
  ### Now, get the changelog entry from the user and add it to the changelog
  ###
  today=$(date '+%Y-%m-%d')
  changelog_entry_filename=$(mktemp)

  # Prompt the user to enter changelog details in their default editor
  ${EDITOR:-nano} "$changelog_entry_filename"
  new_changelog_heading="## $pkg_name@${selected_versions["$pkg_name"]} - $today"
  changelog_file="${directories[$index]}/CHANGELOG.md"

  # Split the changelog content around the first version header
  upper_part=$(awk '/^## [^#]/ {exit} {print}' "$changelog_file")
  lower_part=$(awk '/^## [^#]/ {print_it=1} print_it' "$changelog_file")

  # Create a new changelog content by combining parts with new entry
  {
    echo "$upper_part"
    echo ""
    echo "$new_changelog_heading"
    echo ""
    cat "$changelog_entry_filename"
    echo ""
    echo "$lower_part"
  } >"$changelog_file"

  # Clean up the temporary file used for user input
  rm "$changelog_entry_filename"

  echo "Changelog updated for $pkg_name"

  # Stage the updated changelog file for git commit
  git add "$changelog_file"
done
# Commit all
git commit -m "Update changelogs"

###
### Next, set versions with lerna version.
### Must use the interactive command. There is no way to bump the version of a single package in a singel command, weirdly, https://github.com/lerna/lerna/issues/3874
###

## Print the new versions before the lerna prompt for convenience
echo "\\nNew versions for packages:"
for pkg_name in "${!selected_versions[@]}"; do
  echo "$pkg_name: ${selected_versions[$pkg_name]}"
done

npx lerna version --no-push

###
### Next, push tags in an ordering and with delays in between
### We can't simply let lerna do this because CircleCI doesn't run when all tags are published
###
# Priority packages whose tags should be pushed first in specific order
declare -a priority_packages=("@ethereum-sourcify/bytecode-utils" "@ethereum-sourcify/contract-call-decoder" "@ethereum-sourcify/lib-sourcify")

# Push tags one by one with a delay
push_tag() {
  local tag=$1
  echo "Pushing tag $tag..."
  git push origin "$tag"
  echo "Waiting 5 seconds"
  sleep 5 # Delay of 5 seconds
}

# Main function to handle ordered tag pushing
push_tags_in_order() {
  # Push priority tags first in the defined order
  for package in "${priority_packages[@]}"; do
    for pkg_index in "${!packageNames[@]}"; do
      pkg_name="${packageNames[$pkg_index]}"
      package_dir="${directories[$pkg_index]}"
      if [[ "$pkg_name" == *"$package"* ]]; then
        tag="$pkg_name@${selected_versions[$pkg_name]}"
        push_tag "$tag"
      fi
    done
  done
  # Push remaining tags
  for pkg_name in "${!selected_versions[@]}"; do
    if [[ ! " ${priority_packages[*]} " =~ "$pkg_name" ]]; then
      tag="$pkg_name@${selected_versions[$pkg_name]}"
      push_tag "$tag"
    fi
  done
}
# Call function to push tags
push_tags_in_order

# Push to master
echo "Pushing to master..."
git push origin master
# Go back to staging and merge fast forward master. Then push to staging
echo "Switching to staging..."
git checkout staging
echo "Merging master into staging..."
git merge --ff-only master
echo "Pushing to staging..."
git push origin staging

###
### Finally, do the Github releases
###

echo "Creating GitHub releases..."

# Loop through each package to create a GitHub release
for pkg_index in "${!packageNames[@]}"; do
  pkg_name="${packageNames[$pkg_index]}"
  version="${selected_versions[$pkg_name]}"
  tag="$pkg_name@$version"
  directory="${directories[$pkg_index]}"
  changelog_file="$directory/CHANGELOG.md"

  # Extract the changelog entry for the new version
  # This awk command captures the changelog block starting with the version tag until the next version tag starts
  release_notes=$(awk -v tag="## $pkg_name@$version" 'p && /^## /{exit} /^## /{p=0} $0 ~ tag{p=1} p' "$changelog_file")

  # Use gh CLI to create a release
  echo "\\nCreating release for $tag with notes from $changelog_file..."
  echo "$release_notes"

  # Set --latest=false unless the pkg_name is sourcify-monorepo. In that case set explicitly --latest
  if [ "$pkg_name" == "sourcify-monorepo" ]; then
    echo "$release_notes" | gh release create "$tag" -F - --title "$tag" --notes "$release_notes" --latest
  else
    echo "$release_notes" | gh release create "$tag" -F - --title "$tag" --notes "$release_notes" --latest=false
  fi

  echo "Release created for $tag"
done
