import './styles.css'
import { supabase } from './lib/supabase.js'
import standings from './standings.json'

const app = document.querySelector('#app')
let session = null
let profile = null
let matches = []
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const canEdit = () => profile?.role === 'editor'

function renderAuth() {
  app.innerHTML = `<main class="auth-shell"><section class="auth-card"><div class="crest">FF</div><p class="eyebrow">Football Fanatics</p><h1>Team hub</h1><p class="muted">Sign in to view the match record. Editors can update it.</p><form id="auth-form"><input id="email" type="email" placeholder="Email" required><input id="password" type="password" placeholder="Password" required><button class="primary">Sign in</button><p id="auth-message" class="message"></p></form></section></main>`
  document.querySelector('#auth-form').addEventListener('submit', async e => { e.preventDefault(); const { error } = await supabase.auth.signInWithPassword({ email: document.querySelector('#email').value, password: document.querySelector('#password').value }); document.querySelector('#auth-message').textContent = error ? error.message : 'Signed in.' })
}
function renderApp() {
  app.innerHTML = `<div class="shell"><aside class="sidebar"><div class="brand"><div class="crest">FF</div><div><strong>Football Fanatics</strong><small>team hub</small></div></div><nav><button data-page="dashboard" class="active">Dashboard</button><button data-page="matches">Matches</button></nav><div class="side-foot"><span>${escapeHtml(session.user.email)}</span><b>${canEdit() ? 'Editor' : 'Viewer'}</b><button id="signout" class="ghost">Sign out</button></div></aside><main class="main"><header><div><span class="eyebrow">Authenticated workspace</span><h1 id="page-title">Dashboard</h1></div><span class="role">${canEdit() ? 'EDIT ACCESS' : 'VIEW ONLY'}</span></header><section id="content"></section></main></div>`
  document.querySelectorAll('[data-page]').forEach(btn => btn.addEventListener('click', () => showPage(btn.dataset.page)))
  document.querySelector('#signout').addEventListener('click', () => supabase.auth.signOut())
  showPage('dashboard')
}
async function loadMatches() { const { data, error } = await supabase.from('matches').select('*').order('match_date', { ascending: false }); matches = error ? [] : data }
function aggregateLiveStandings(season) {
  const source = standings[season] || []
  const labels = new Set(source.map(x => x.team))
  const table = source.map(x => ({...x}))
  const index = Object.fromEntries(table.map(x => [x.team, x]))
  matches.filter(m => m.competition === 'League' && (m.season === season || !m.season) && labels.has('Football Fanatics') && m.opponent).forEach(() => {})
  return table
}
function renderStandings(season = '2025-2026') {
  const rows = aggregateLiveStandings(season)
  return `<section class="standings-section"><div class="section-head"><div><h2>League table</h2><p class="muted">Played, wins, draws, losses, goals and points</p></div><select id="standing-season"><option value="2025-2026" ${season==='2025-2026'?'selected':''}>2025-2026</option><option value="2024-2025" ${season==='2024-2025'?'selected':''}>2024-2025</option></select></div><div class="table-wrap"><table><thead><tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th></tr></thead><tbody>${rows.map(r=>`<tr class="${r.team==='Football Fanatics'?'highlight':''}"><td>${r.rank}</td><td>${escapeHtml(r.team)}</td><td>${r.played}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.for}</td><td>${r.against}</td><td>${r.gd>0?'+':''}${r.gd}</td><td><strong>${r.points}</strong></td></tr>`).join('')}</tbody></table></div></section>`
}
function showPage(page) {
  document.querySelectorAll('[data-page]').forEach(b => b.classList.toggle('active', b.dataset.page === page)); document.querySelector('#page-title').textContent = page === 'dashboard' ? 'Season overview' : 'Match centre'; const content = document.querySelector('#content')
  if (page === 'dashboard') { content.innerHTML = `<section class="hero"><div><h2>View the record with the right permissions.</h2><p class="muted">${matches.length} matches loaded from Supabase. ${canEdit() ? 'You can edit the shared record.' : 'Your access is read-only.'}</p></div><div class="metric"><strong>${matches.length}</strong><span>recorded matches</span></div></section><div class="notice">${canEdit() ? 'Editor mode is on.' : 'Viewer mode is on. Ask the team owner for editor access.'}</div>${renderStandings('2025-2026')}`; document.querySelector('#standing-season').addEventListener('change', e => { document.querySelector('.standings-section').outerHTML = renderStandings(e.target.value); document.querySelector('#standing-season').addEventListener('change', ev => { document.querySelector('.standings-section').outerHTML = renderStandings(ev.target.value) }) }) }
  else { content.innerHTML = `<section class="toolbar"><p class="muted">${matches.length} shared matches</p>${canEdit() ? '<button id="add-match" class="primary">Add match</button>' : ''}</section><div class="table-wrap"><table><thead><tr><th>Date</th><th>Opponent</th><th>Competition</th><th>Score</th><th>Result</th>${canEdit() ? '<th></th>' : ''}</tr></thead><tbody>${matches.map(m=>`<tr><td>${escapeHtml(m.match_date)}</td><td>${escapeHtml(m.opponent)}</td><td>${escapeHtml(m.competition)}</td><td>${escapeHtml(m.score || 'vs')}</td><td>${escapeHtml(m.result || 'Upcoming')}</td>${canEdit()?`<td><button class="edit" data-id="${m.id}">Edit</button></td>`:''}</tr>`).join('')}</tbody></table></div>`; if (canEdit()) { document.querySelector('#add-match').addEventListener('click', () => openEditor()); document.querySelectorAll('.edit').forEach(b => b.addEventListener('click', () => openEditor(matches.find(m => String(m.id) === b.dataset.id)))) } }
}
function openEditor(match = {}) { const isEdit=Boolean(match.id); const dialog=document.createElement('dialog'); dialog.innerHTML=`<form method="dialog" class="dialog-card"><h2>${isEdit?'Edit match':'Add match'}</h2><input id="m-date" type="date" value="${match.match_date||''}" required><input id="m-opponent" placeholder="Opponent" value="${escapeHtml(match.opponent||'')}" required><select id="m-comp"><option ${match.competition==='League'?'selected':''}>League</option><option ${match.competition==='Cup'?'selected':''}>Cup</option></select><input id="m-score" placeholder="Score, e.g. 2-1" value="${escapeHtml(match.score||'')}"><input id="m-result" placeholder="Result, e.g. W, D, L" value="${escapeHtml(match.result||'')}"><textarea id="m-notes" placeholder="Scorers and notes">${escapeHtml(match.notes||'')}</textarea><div class="dialog-actions"><button value="cancel" class="ghost">Cancel</button><button id="save" value="default" class="primary">Save</button></div></form>`; document.body.append(dialog); dialog.showModal(); dialog.querySelector('#save').addEventListener('click',async e=>{e.preventDefault();const payload={match_date:dialog.querySelector('#m-date').value,opponent:dialog.querySelector('#m-opponent').value,competition:dialog.querySelector('#m-comp').value,score:dialog.querySelector('#m-score').value,result:dialog.querySelector('#m-result').value,notes:dialog.querySelector('#m-notes').value};const request=isEdit?supabase.from('matches').update(payload).eq('id',match.id):supabase.from('matches').insert(payload);const {error}=await request;if(error){alert(error.message);return}dialog.close();dialog.remove();await loadMatches();showPage('matches')}) }
async function boot(){const {data}=await supabase.auth.getSession();session=data.session;if(!session){renderAuth();return}const {data:p}=await supabase.from('profiles').select('role').eq('id',session.user.id).single();profile=p||{role:'viewer'};await loadMatches();renderApp()}
supabase.auth.onAuthStateChange((_e,next)=>{session=next;if(next)boot();else renderAuth()});boot()
