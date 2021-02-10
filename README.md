# actions-js-getRelease

This action notify Slack on workflow run status

## Inputs

### `gh_ctx`

**Required** GitHub context for worklfow run

### `token`

`secrets.GITHUB_TOKEN`

## Example usage

```
  upload_notify_artifact:  # separate job in desired workflow
    runs-on: ubuntu-latest
    if: always()
    name: Upload Notify Artifact
    steps:
      - name: Upload Notify Artifact
        uses: zebra-lucky/actions-js-slackJobsStatus@0.0.2
        with:
          gh_ctx: ${{ toJson(github) }}
```

```
name: Notify slack workflow

on:
  workflow_run:
    workflows:
      - Run tests workflow
      - Build release workflow
    types:
      - completed

jobs:
  notify_slack:
    runs-on: ubuntu-latest
    name: Notify slack
    steps:
      - name: Notify slack
        uses: zebra-lucky/actions-js-slackJobsStatus@0.0.2
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
        with:
          gh_ctx: ${{ toJson(github) }}
          token: ${{ secrets.GITHUB_TOKEN }}
```
