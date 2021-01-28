# actions-js-getRelease

This action notify Slack on workflow jobs summary status

## Inputs

### `jobs`

**Required** Content of `needs` as JSON

### `gh_ctx`

**Required** GitHub context for worklfow run

## Example usage

```
  notify_slack:  # separate job
    needs: [job1, job2, ...]
    runs-on: ubuntu-latest
    if: always()
    name: Notify slack
    steps:
      - name: Notify slack
        uses: zebra-lucky/actions-js-slackJobsStatus@0.0.1
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
        with:
          jobs: ${{ toJson(needs) }} 
          gh_ctx: ${{ toJson(github) }}
```
