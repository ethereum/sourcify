#!/bin/bash
SCRIPT_DIR=$(dirname "$0")

# A script to (semi)automate the Sourcify release process.

# Exit immediately if a command exits with a non-zero status.
# set -e

# Make sure the script exits if a command in a pipeline fails.
# set -o pipefail

source "${SCRIPT_DIR}/logging_utils.sh"
source "${SCRIPT_DIR}/git_utils.sh"
source "${SCRIPT_DIR}/release.sh"

###
### Main
###
prompt_execute_or_skip "checking current branch" check_current_branch
prompt_execute_or_skip "checking if branches are in sync" check_branch_sync
prompt_execute_or_skip "creating GitHub PR" create_gh_pr

# Needed if the user skips creating the PR
if [ -z "$OPEN_PR_NUMBER" ]; then
  OPEN_PR_NUMBER=$(gh pr list --base master --state open | grep staging | awk '{print $1}')
fi
 
prompt_execute_or_skip "merging locally" merge_locally

# Define arrays to hold package directories, names, and versions. These are global and needed
declare -a directories
declare -a packageNames
declare -a versions
declare -A selected_versions

check_packages_for_update # Must run this because it sets the above variables

prompt_execute_or_skip "choosing versions for each package and writing changelogs" update_packages_and_changelog
prompt_execute_or_skip "commiting the changelogs" commit_changelogs
prompt_execute_or_skip "choosing same versions in lerna to create git tags and updating dependencies" run_lerna_version
prompt_execute_or_skip "pushing the tags to GitHub" push_tags_in_order
prompt_execute_or_skip "pusing the commits to master and back to staging" push_to_master_and_staging
prompt_execute_or_skip "creating GitHub releases" create_github_releases
