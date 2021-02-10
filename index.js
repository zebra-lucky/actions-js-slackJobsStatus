const fs = require('fs').promises;
const axios = require('axios');
const AdmZip = require('adm-zip');
const core = require('@actions/core');
const github = require('@actions/github');
const artifact = require('@actions/artifact');
const { IncomingWebhook } = require('@slack/webhook');
const humanizeDuration = require("humanize-duration");

// artifactClient params
const artifactName = 'notify-data';
const artifactFiles = ['notify-data.json'];
const artifactRootDir = '.';
const artifactOpts = {continueOnError: false};

async function gather_notify_artifact(gh_ctx) {
  let data = {};
  data.event_name = gh_ctx.event_name;
  data.repo = gh_ctx.repository;
  data.run_id = gh_ctx.run_id;
  data.gh_srv = process.env.GITHUB_SERVER_URL;
  data.run_url = `${data.gh_srv}/${data.repo}/actions/runs/${data.run_id}`;
  data.actor = gh_ctx.actor;
  data.run_num = gh_ctx.run_number;
  data.sha = gh_ctx.sha;
  data.sha_short = gh_ctx.sha.slice(0, 8);
  data.workflow = gh_ctx.workflow;

  if (data.event_name == 'pull_request') {
    data.pr_num = gh_ctx.event.number;
    data.pr_href = gh_ctx.event.pull_request._links.html.href;
    data.ref = gh_ctx.base_ref
      .replace('refs/heads/', '');
  } else if (data.event_name == 'push') {
    data.cmp_href = gh_ctx.event.compare;
    data.ref = gh_ctx.ref
      .replace('refs/tags/', '')
      .replace('refs/heads/', '');
  } else {
    throw new Error('SLACK_WEBHOOK_URL is not set!');
  }
  await upload_notify_artifact(data);
}

async function upload_notify_artifact(data) {
  await fs.writeFile(artifactFiles[0], JSON.stringify(data, null, 2));
  const artifactClient = artifact.create();
  await artifactClient.uploadArtifact(
    artifactName,
    artifactFiles,
    artifactRootDir,
    artifactOpts
  );
}

async function download_notify_artifact(gh_ctx) {
  const token = core.getInput('token', {required: false});
  const octokit = github.getOctokit(token);
  const wfl_run = gh_ctx.event.workflow_run;
  const artifacts_url = wfl_run.artifacts_url;
  const get_res = await axios.get(artifacts_url);
  const [owner, repo] = gh_ctx.repository.split('/');
  const artifact_id = get_res.data.artifacts[0].id;
  const archive_format = 'zip';
  const artifact_res = await octokit.actions.downloadArtifact({
    owner,
    repo,
    artifact_id,
    archive_format
  });
  const zip = new AdmZip(Buffer.from(artifact_res.data));
  const zipEntries = zip.getEntries();
  return JSON.parse(zip.readAsText(zipEntries[0]));
}

async function post_slack_notification(gh_ctx) {
  const data = await download_notify_artifact(gh_ctx);
  const wfl_run = gh_ctx.event.workflow_run;
  const created_at = new Date(wfl_run.created_at);
  const updated_at = new Date(wfl_run.updated_at);
  data.conclusion = wfl_run.conclusion;
  data.run_in = humanizeDuration(updated_at.getTime() - created_at.getTime());

  let msg = `*${data.workflow}* #${data.run_num}`
  let msg_mrkdwn = `*${data.workflow}* <${data.run_url}|#${data.run_num}>`
  if (data.event_name == 'pull_request') {
    msg += ` (${data.sha_short})`;
    msg_mrkdwn += ` (<${data.pr_href}|${data.sha_short}>)`;
    msg += ` in PR #${data.pr_num}`;
    msg_mrkdwn += ` in PR <${data.pr_href}|#${data.pr_num}>`;
  } else {
    msg += ` (${data.sha_short})`;
    msg_mrkdwn += ` (<${data.cmp_href}|${data.sha_short}>)`;
  }
  msg += ` of ${data.repo}@${data.ref} by ${data.actor}`;
  msg_mrkdwn += ` of ${data.repo}@${data.ref} by ${data.actor}`;

  let color;
  let result;
  if (data.conclusion == 'success') {
    color = 'good';
    result = 'passed';
  } else if (data.conclusion == 'failure') {
    color = 'danger';
    result = 'failed';
  } else {
    color = 'warning';
    result = data.conclusion;
  }
  msg += ` ${result} in ${data.run_in}.`;
  msg_mrkdwn += ` ${result} in ${data.run_in}.`;

  const webhook = new IncomingWebhook(process.env.SLACK_WEBHOOK_URL);
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
}

async function run() {
  try {
    const gh_ctx = JSON.parse(core.getInput('gh_ctx', {required: true}));
    if (process.env.SLACK_WEBHOOK_URL) {
        await post_slack_notification(gh_ctx);
    } else {
        await gather_notify_artifact(gh_ctx);
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
