/** 投稿結果と再生数を GitHub の status.json に書き込む。手動実行で動作確認にも使う。 */
function pushStatus() {
  const props = PropertiesService.getScriptProperties();
  const uploaded = JSON.parse(props.getProperty('uploaded') || '{}');

  // Apps Script 以外（Zapier）で投稿した動画も含めて、queue.json の already_uploaded からIDを集める
  let extra = [];
  try {
    const queue = fetchJson_(REPO_RAW + 'queue.json');
    extra = (queue.already_uploaded || []).map(u => u.id);
  } catch (e) { /* queue が読めなくても続行 */ }

  const ids = Array.from(new Set(Object.values(uploaded).map(u => u.id).concat(extra)));
  const stats = {};
  for (let i = 0; i < ids.length; i += 50) {
    const r = YouTube.Videos.list('statistics', { id: ids.slice(i, i + 50).join(',') });
    (r.items || []).forEach(v => {
      stats[v.id] = {
        views: Number(v.statistics.viewCount || 0),
        likes: Number(v.statistics.likeCount || 0),
        comments: Number(v.statistics.commentCount || 0),
      };
    });
  }
  const status = {
    updated: new Date().toISOString(),
    last_error: props.getProperty('last_error') || null,
    uploaded: uploaded,
    stats: stats,
  };
  githubPut_('status.json', JSON.stringify(status, null, 2), 'Apps Script: 投稿結果と再生数を更新');
  props.setProperty('last_status_push', String(Date.now()));
}

/** 最初に1回だけ手動で実行：1時間ごとのトリガーを作る（作り直しても安全）。 */
function setup() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'uploadNext')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('uploadNext').timeBased().everyHours(1).create();
  YouTube.Channels.list('snippet', { mine: true });
  UrlFetchApp.fetch(REPO_RAW + 'README.md');
}

/** すでに Zapier で投稿した動画を記録に登録しておく（二重投稿防止）。 */
function registerExisting() {
  const props = PropertiesService.getScriptProperties();
  const uploaded = JSON.parse(props.getProperty('uploaded') || '{}');
  const queue = fetchJson_(REPO_RAW + 'queue.json');
  (queue.already_uploaded || []).forEach(u => {
    if (!uploaded[u.nnn]) uploaded[u.nnn] = { id: u.id, date: u.date, at: null };
  });
  props.setProperty('uploaded', JSON.stringify(uploaded));
}
