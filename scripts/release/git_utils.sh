SCRIPT_DIR=$(dirname "$0")

source "${SCRIPT_DIR}/logging_utils.sh"

check_current_branch() {
  ## Check if the current branch is master
  local current_branch=$(git rev-parse --abbrev-ref HEAD)
  if [ "$current_branch" != "staging" ]; then
    error_exit "You are not on the staging branch. Please switch to the staging branch before running this script."
  fi
}

check_branch_sync() {
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
}

create_gh_pr() {
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
    OPEN_PR_NUMBER=$(gh pr list --base master --state open | grep staging | awk '{print $1}')
    echo "Created PR number $OPEN_PR_NUMBER"
  else
    echo "Continuing without creating a PR."
  fi
}

merge_locally() {
  echo "Locally merging staging into master"
  git merge staging
  echo "Merged staging into master"
}

switch_to_staging() {
  echo "Switching to staging..."
  git checkout staging
  echo "Checked out staging"
}

push_to_master() {
  # Push to master
  echo "Pushing to master..."
  git push origin master
  echo "Pushed to master"
}

ask_if_changelog_pr_merged() {
  echo "Now please review and approve the PR from the changelogs branch to staging."
}

push_to_staging() {
  echo "Pushing to staging..."
  git push origin staging
}

switch_to_master() {
  echo "Switching to master..."
  git checkout master
  echo "Checked out master"
}

create_new_branch() {
  local branch_name=$1
  echo "Creating new branch..."
  git checkout -b "$branch_name"
  echo "Created new branch $branch_name"
}

commit_changelogs() {
  git commit -m "Update changelogs"
}

publish_branch() {
  local branch_name=$1
  echo "Publishing branch..."
  git push -u origin "$branch_name"
  echo "Branch $branch_name published"
}

open_pr_to_staging() {
  local branch_name=$1
  local title=$2
  echo "Opening PR to staging..."
  gh pr create --title "$title" --body "" --head "$branch_name" --base staging
  echo "Opened PR to staging"
}

switch_to_staging_and_pull() {
  echo "Switching to staging..."
  git checkout staging
  echo "Checked out staging"
  git pull
  echo "Pulled latest staging"
}
