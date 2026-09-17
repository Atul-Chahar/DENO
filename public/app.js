/**
 * Deno Founder GTM Workspace — Client Application Logic
 */

let currentProjectId = null;
let currentProject = null;
let currentCalendar = [];
let selectedAssetIndex = 0;
let debounceTimer = null;

// DOM Elements
const navTabs = document.querySelectorAll('.nav-tab');
const tabPanes = document.querySelectorAll('.tab-pane');
const ideaInput = document.getElementById('idea-input');
const handleInput = document.getElementById('handle-input');
const startValidationBtn = document.getElementById('start-validation-btn');
const sampleIdeaBtn = document.getElementById('sample-idea-btn');
const toastEl = document.getElementById('toast');

// Pipeline Visualizer Elements
const pipelineCard = document.getElementById('pipeline-status-card');
const pipelineProgressBar = document.getElementById('pipeline-progress-bar');
const pipelinePct = document.getElementById('pipeline-pct');
const pipelineLog = document.getElementById('pipeline-log');

// Nav enablement
const navVerdictTab = document.getElementById('nav-verdict-tab');
const navCalendarTab = document.getElementById('nav-calendar-tab');

// Tab Switching Handler
navTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    if (tab.disabled) return;
    navTabs.forEach(t => t.classList.remove('active'));
    tabPanes.forEach(p => p.classList.remove('active'));

    tab.classList.add('active');
    const targetPane = document.getElementById(tab.dataset.tab);
    if (targetPane) targetPane.classList.add('active');
  });
});

function switchTab(tabId) {
  const targetTabBtn = document.querySelector(`[data-tab="${tabId}"]`);
  if (targetTabBtn) {
    targetTabBtn.disabled = false;
    targetTabBtn.click();
  }
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 3000);
}

// Sample Idea Button
sampleIdeaBtn.addEventListener('click', () => {
  ideaInput.value = "An automated safety engine for founders that scans LinkedIn, Reddit, and X drafts to catch 2026 AI slop patterns and calculate a Ban Risk Score before publishing.";
  handleInput.value = "@founder_builder";
});

// Start Validation Flow
startValidationBtn.addEventListener('click', async () => {
  const rawIdea = ideaInput.value.trim();
  if (rawIdea.length < 5) {
    alert("Please provide a startup idea or product URL to analyze.");
    return;
  }

  startValidationBtn.disabled = true;
  startValidationBtn.innerHTML = `<span class="btn-icon">⏳</span> Dispatching Agents...`;
  pipelineCard.style.display = 'block';

  try {
    // 1. Intake Request
    const intakeRes = await fetch('/api/projects/intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        raw_idea: rawIdea,
        author_handle: handleInput.value.trim() || null
      })
    });
    
    if (!intakeRes.ok) throw new Error("Intake failed");
    const project = await intakeRes.json();
    currentProjectId = project.id;

    // 2. Connect to Server-Sent Events (SSE) Progress Stream
    connectProgressStream(project.id);

    // 3. Trigger Asynchronous Validation Execution
    const valRes = await fetch(`/api/projects/${project.id}/validate`, {
      method: 'POST'
    });
    
    if (!valRes.ok) throw new Error("Validation failed");
    const updatedProject = await valRes.json();
    currentProject = updatedProject;

    // Render Completed Validation Report
    renderValidationReport(updatedProject.validation_report);
    navVerdictTab.disabled = false;
    switchTab('verdict-tab');
    showToast("Validation complete! Build/Pivot/Kill verdict ready.");
  } catch (err) {
    console.error(err);
    alert("Error executing validation pipeline: " + err.message);
  } finally {
    startValidationBtn.disabled = false;
    startValidationBtn.innerHTML = `<span class="btn-icon">⚡</span> Run 8-Agent Validation`;
  }
});

function connectProgressStream(projectId) {
  const eventSource = new EventSource(`/api/projects/${projectId}/stream`);
  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      const pct = Math.max(0, data.percent);
      pipelineProgressBar.style.width = `${pct}%`;
      pipelinePct.textContent = `${pct}%`;
      pipelineLog.textContent = data.message;

      // Highlight active agent chips based on progress
      if (pct >= 10) document.getElementById('chip-intake').classList.add('completed');
      if (pct >= 30) {
        document.getElementById('chip-market').classList.add('completed');
        document.getElementById('chip-sizing').classList.add('completed');
        document.getElementById('chip-risk').classList.add('completed');
      }
      if (pct >= 60) document.getElementById('chip-critic').classList.add('completed');
      if (pct >= 85) {
        document.getElementById('chip-refiner').classList.add('completed');
        document.getElementById('chip-decision').classList.add('completed');
      }
      if (pct >= 100) {
        document.getElementById('chip-community').classList.add('completed');
        eventSource.close();
      }
    } catch (e) {
      console.error("SSE parse error", e);
    }
  };

  eventSource.onerror = () => {
    eventSource.close();
  };
}

// Render Validation Report (Stage 1)
function renderValidationReport(report) {
  if (!report) return;

  // Verdict Banner
  const badge = document.getElementById('verdict-badge');
  badge.textContent = report.verdict;
  badge.className = `verdict-tag verdict-${report.verdict.toLowerCase()}`;
  document.getElementById('confidence-val').textContent = `${Math.round(report.confidence_score * 100)}%`;
  document.getElementById('verdict-market-desc').textContent = report.market_breakdown;

  // Top 3 Reasons
  const reasonsList = document.getElementById('top-reasons-list');
  reasonsList.innerHTML = '';
  report.top_reasons.forEach(reason => {
    const li = document.createElement('li');
    li.textContent = reason;
    reasonsList.appendChild(li);
  });

  // TAM / SAM / SOM
  document.getElementById('tam-num').textContent = formatCurrency(report.tam_sam_som.tam_usd);
  document.getElementById('sam-num').textContent = formatCurrency(report.tam_sam_som.sam_usd);
  document.getElementById('som-num').textContent = formatCurrency(report.tam_sam_som.som_usd);
  document.getElementById('tam-calc').textContent = report.tam_sam_som.calculation_work;

  // Competitors
  const compList = document.getElementById('competitor-list');
  compList.innerHTML = '';
  report.competitors.forEach(c => {
    const div = document.createElement('div');
    div.className = 'competitor-card';
    div.innerHTML = `
      <h4><a href="${c.url}" target="_blank" rel="noopener noreferrer">${c.name}</a> · <span style="font-weight:400;color:var(--text-muted);">${c.pricing}</span></h4>
      <p style="font-size:0.85rem;color:var(--text-secondary);"><strong style="color:var(--accent-violet);">Gaps:</strong> ${c.exploitable_gaps.join(', ')}</p>
    `;
    compList.appendChild(div);
  });

  // Source Ledger
  const srcList = document.getElementById('source-ledger-list');
  srcList.innerHTML = '';
  report.source_ledger.forEach(s => {
    const div = document.createElement('div');
    div.className = 'source-item';
    div.innerHTML = `
      <a href="${s.url}" target="_blank" rel="noopener noreferrer">🔗 ${s.title}</a>
      <p>${s.claim}</p>
      <div class="source-date">Verified: ${s.retrieval_date}</div>
    `;
    srcList.appendChild(div);
  });

  // Target Communities
  renderCommunities(report.target_communities);
}

function renderCommunities(communities) {
  const grid = document.getElementById('community-grid');
  grid.innerHTML = '';
  communities.forEach(c => {
    const div = document.createElement('div');
    div.className = 'community-card';
    div.innerHTML = `
      <div class="community-header">
        <h4 style="font-size:1.05rem;">${c.name}</h4>
        <span class="community-pill">${c.platform}</span>
      </div>
      <div class="rule-row"><span class="rule-label">Members:</span> <span>${c.member_count.toLocaleString()}</span></div>
      <div class="rule-row"><span class="rule-label">Gate:</span> <span>${c.karma_age_gate}</span></div>
      <div class="rule-row"><span class="rule-label">Self-Promo:</span> <span>${c.self_promo_rule}</span></div>
      <div class="rule-row"><span class="rule-label">Cadence:</span> <span>${c.max_posting_frequency}</span></div>
      <p style="font-size:0.8rem;color:var(--accent-crimson);margin-top:0.5rem;"><strong style="color:var(--text-muted)">AI Rule:</strong> ${c.ai_content_policy}</p>
    `;
    grid.appendChild(div);
  });
}

function formatCurrency(val) {
  if (val >= 1000000000) return `$${(val / 1000000000).toFixed(1)}B`;
  if (val >= 1000000) return `$${(val / 1000000).toFixed(0)}M`;
  if (val >= 1000) return `$${(val / 1000).toFixed(0)}k`;
  return `$${val}`;
}

// Open Communities button
document.getElementById('open-communities-btn').addEventListener('click', () => {
  switchTab('communities-tab');
});

// Generate 30-Day Content Plan
document.getElementById('generate-calendar-btn').addEventListener('click', async () => {
  if (!currentProjectId) return;

  const btn = document.getElementById('generate-calendar-btn');
  btn.disabled = true;
  btn.textContent = "Generating Voice-Matched Assets...";

  try {
    const res = await fetch(`/api/projects/${currentProjectId}/calendar?days=7`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error("Calendar generation failed");
    const data = await res.json();
    currentCalendar = data.calendar;

    renderCalendar(currentCalendar);
    navCalendarTab.disabled = false;
    switchTab('calendar-tab');
    showToast("30-Day Content Plan ready with real-time Ban Risk scoring!");
  } catch (err) {
    alert("Calendar error: " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "⚡ Generate 30-Day Safe Content Plan";
  }
});

// Render Calendar & Asset Selector
function renderCalendar(assets) {
  const sidebar = document.getElementById('calendar-asset-list');
  sidebar.innerHTML = '';

  assets.forEach((asset, idx) => {
    const div = document.createElement('div');
    div.className = `asset-nav-item ${idx === 0 ? 'active' : ''}`;
    div.innerHTML = `
      <div class="asset-day">Day ${asset.day_number} · ${asset.platform}</div>
      <div class="asset-title">${asset.title}</div>
      <span class="community-pill" style="font-size:0.75rem;">${asset.target_community}</span>
    `;
    div.addEventListener('click', () => {
      document.querySelectorAll('.asset-nav-item').forEach(el => el.classList.remove('active'));
      div.classList.add('active');
      selectedAssetIndex = idx;
      loadAssetIntoEditor(asset);
    });
    sidebar.appendChild(div);
  });

  if (assets.length > 0) {
    loadAssetIntoEditor(assets[0]);
  }
}

// Load Asset into Interactive Editor
function loadAssetIntoEditor(asset) {
  document.getElementById('editor-platform-badge').textContent = asset.platform;
  document.getElementById('editor-community-badge').textContent = asset.target_community;
  document.getElementById('editor-content').value = asset.content;

  const firstCommentInput = document.getElementById('editor-first-comment');
  firstCommentInput.value = asset.first_comment || '';

  renderBanRiskAudit(asset.ban_risk);

  const openLink = document.getElementById('open-platform-link');
  if (asset.platform === 'REDDIT') openLink.href = 'https://reddit.com/submit';
  else if (asset.platform === 'LINKEDIN') openLink.href = 'https://www.linkedin.com/feed/';
  else openLink.href = 'https://twitter.com/compose/post';
}

function renderBanRiskAudit(audit) {
  const scoreEl = document.getElementById('editor-ban-score');
  const boxEl = document.getElementById('editor-score-pill');
  scoreEl.textContent = audit.ban_risk_score;

  boxEl.className = 'score-pill-box';
  if (audit.ban_risk_score >= 70) {
    boxEl.style.borderColor = 'var(--accent-emerald)';
    scoreEl.style.color = 'var(--accent-emerald)';
  } else if (audit.ban_risk_score >= 45) {
    boxEl.classList.add('score-warning');
    scoreEl.style.color = 'var(--accent-amber)';
  } else {
    boxEl.classList.add('score-danger');
    scoreEl.style.color = 'var(--accent-crimson)';
  }

  const list = document.getElementById('editor-deductions-list');
  list.innerHTML = '';

  if (audit.deductions.length === 0 && audit.hard_block_reasons.length === 0) {
    list.innerHTML = '<p style="color:var(--accent-emerald);font-size:0.9rem;">✓ 100% Clean! Zero AI slop patterns or platform rule conflicts detected.</p>';
    return;
  }

  audit.deductions.forEach(d => {
    const div = document.createElement('div');
    div.className = 'deduction-item';
    div.innerHTML = `
      <div class="deduction-header">
        <span>⚠️ ${d.pattern_name}</span>
        <span>-${d.point_deduction} pts</span>
      </div>
      <div class="deduction-quote">"${d.offending_quote}"</div>
      <div class="deduction-fix"><strong>Suggested Fix:</strong> ${d.suggested_fix}</div>
    `;
    list.appendChild(div);
  });
}

// Real-Time Debounced Ban Risk Audit while typing
document.getElementById('editor-content').addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    const text = document.getElementById('editor-content').value;
    const platform = document.getElementById('editor-platform-badge').textContent;
    const community = document.getElementById('editor-community-badge').textContent;

    const res = await fetch('/api/audit/ban-risk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text,
        platform: platform,
        target_community: community
      })
    });
    if (res.ok) {
      const audit = await res.json();
      renderBanRiskAudit(audit);
    }
  }, 400);
});

// Copy Button
document.getElementById('copy-post-btn').addEventListener('click', () => {
  const content = document.getElementById('editor-content').value;
  navigator.clipboard.writeText(content);
  showToast("Post copied to clipboard! You are ready to publish.");
});

// Standalone Ban Risk Playground
document.getElementById('play-audit-btn').addEventListener('click', async () => {
  const text = document.getElementById('play-input').value.trim();
  const platform = document.getElementById('play-platform').value;
  if (!text) return;

  const res = await fetch('/api/audit/ban-risk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, platform, target_community: "r/SaaS" })
  });

  if (res.ok) {
    const audit = await res.json();
    document.getElementById('play-score-val').textContent = audit.ban_risk_score;
    document.getElementById('play-score-desc').textContent = audit.is_safe_to_publish 
      ? "SAFE TO PUBLISH (Passed all rules)" 
      : "HIGH RISK (Deductions detected)";
    
    const list = document.getElementById('play-deductions-list');
    list.innerHTML = '';
    audit.deductions.forEach(d => {
      const div = document.createElement('div');
      div.className = 'deduction-item';
      div.innerHTML = `
        <div class="deduction-header">
          <span>⚠️ ${d.pattern_name}</span>
          <span>-${d.point_deduction} pts</span>
        </div>
        <div class="deduction-quote">"${d.offending_quote}"</div>
        <div class="deduction-fix"><strong>Fix:</strong> ${d.suggested_fix}</div>
      `;
      list.appendChild(div);
    });
  }
});

// Load Default Initial Communities on Start
(async function init() {
  try {
    const res = await fetch('/api/audit/ban-risk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: "Hello world test", platform: "REDDIT" })
    });
    if (res.ok) {
      document.getElementById('status-label').textContent = "NVIDIA NIM Active & Ready";
    }
  } catch (e) {
    document.getElementById('status-label').textContent = "Connecting to Gateway...";
  }
})();
