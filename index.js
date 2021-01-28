const core = require('@actions/core');
const { IncomingWebhook } = require('@slack/webhook')

async function run() {
  try {
    if (!process.env.SLACK_WEBHOOK_URL) {
      throw new Error('SLACK_WEBHOOK_URL is not set!');
    }
    const webhook = new IncomingWebhook(process.env.SLACK_WEBHOOK_URL);
    const jobs = JSON.parse(core.getInput('jobs', {required: true}));
    const gh_ctx = JSON.parse(core.getInput('gh_ctx', {required: true}));

    let failure_cnt = 0;
    let cancelled_cnt = 0;
    Object.keys(jobs).forEach(function(job) {
      if (jobs[job].result == 'failure') {
        failure_cnt += 1;
      } else if (jobs[job].result == 'cancelled') {
        cancelled_cnt += 1;
      }
    });

    const gh_srv = process.env.GITHUB_SERVER_URL;
    const event_name = gh_ctx.event_name;
    const actor = gh_ctx.actor;
    const repo = gh_ctx.repository;
    const run_num = gh_ctx.run_number;
    const run_id = gh_ctx.run_id;
    const sha = gh_ctx.sha;
    const sha_short = gh_ctx.sha.slice(0, 8);
    const workflow = gh_ctx.workflow;
    const run_url = `${gh_srv}/${repo}/actions/runs/${run_id}`;

    let msg = `*${workflow}* #${run_num}`
    let msg_mrkdwn = `*${workflow}* <${run_url}|#${run_num}>`
    let ref;
    if (event_name == 'pull_request') {
      const pr_num = gh_ctx.event.number;
      const pr_href = gh_ctx.event.pull_request._links.html.href;
      ref = gh_ctx.base_ref.replace('refs/heads/', '');
      msg += ` (${sha_short})`;
      msg_mrkdwn += ` (<${pr_href}|${sha_short}>)`;
      msg += ` in PR #${pr_num}`;
      msg_mrkdwn += ` in PR <${pr_href}|#${pr_num}>`;
    } else {
      const cmp_href = gh_ctx.event.compare;
      ref = gh_ctx.ref.replace('refs/tags/', '').replace('refs/heads/', '');
      msg += ` (${sha_short})`;
      msg_mrkdwn += ` (<${cmp_href}|${sha_short}>)`;
    }
    msg += ` of ${repo}@${ref} by ${actor}`;
    msg_mrkdwn += ` of ${repo}@${ref} by ${actor}`;

    let color;
    let tail;
    if (failure_cnt > 0) {
      color = 'danger';
      tail = ' failed.';
    } else if (cancelled_cnt > 0) {
      color = 'warning';
      tail = ' cancelled.';
    } else {
      color = 'good';
      tail = ' passed.';
    }
    msg += tail;
    msg_mrkdwn += tail;

    (async () => {
      await webhook.send({
        attachments: [
          {
            mrkdwn_in: ['text'],
            fallback: msg,
            text: msg_mrkdwn,
            color: color
          }
        ]
      });
    })();

  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
