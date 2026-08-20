import './styles.css'
import { supabase } from './lib/supabase.js'

const app = document.querySelector('#app')
let session = null
let profile = null
let matches = []

const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const canEdit = () => profile?.role === 'editor'

function renderAuth() {
  app.innerHTML = `<main class="auth-shell"><section class="auth-card"><div class="crest">FF</div><p class="eyebrow">Football Fanatics</p><h1>Team hub</h1><p class="muted">Sign in to view the match record. Editors can update it.</p><form id="auth-form"><input id="email" type="email" placeholder="Email" required><input id="password" type="password" placeholder="Password" required><button class="primary">Sign in</button><p id="auth-message" class="message"></p></form></section></main>`
  document.querySelector('#auth-form').addEventListener('submit', async e => {
    e.preventDefault()
    const email = document.querySelector('#email').value
    const password = document.querySelector('#password').value
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    document.querySelector('#auth-message').textContent = error ? error.message : 'Signed in.'
  })
}

function renderApp() {
  app.innerHTML = `<div class="shell"><aside class="sidebar"><div class="brand"><div class="crest">FF</div><div><strong>Football Fanatics</strong><small>team hub</small></div></div><nav><button data-page="dashboard" class="active">Dashboard</button><button data-page="matches">Matches</button></nav><div class="side-foot"><span>${escapeHtml(session.user.email)}</span><b>${canEdit() ? 'Editor' : 'Viewer'}</b><button id="signout" class="ghost">Sign out</button></div></aside><main class="main"><header><div><span class="eyebrow">Authenticated workspace</span><h1 id="page-title">Dashboard</h1></div><span class="role">${canEdit() ? 'EDIT ACCESS' : 'VIEW ONLY'}</span></header><section id="content"></section></main></div>`
  document.querySelectorAll('[data-page]').forEach(btn => btn.addEventListener('click', () => showPage(btn.dataset.page)))
  document.querySelector('#signout').addEventListener('click', () => supabase.auth.signOut())
  showPage('dashboard')
}

async function loadMatches() {
  const { data, error } = await supabase.from('matches').select('*').order('match_date', { ascending: false })
  matches = error ? [] : data
}

function showPage(page) {
  document.querySelectorAll('[data-page]').forEach(b => b.classList.toggle('active', b.dataset.page === page))
  document.querySelector('#page-title').textContent = page === 'dashboard' ? 'Season overview' : 'Match centre'
  const content = document.querySelector('#content')
  if (page === 'dashboard') {
    content.innerHTML = `<section class="hero"><div><h2>View the record with the right permissions.</h2><p class="muted">${matches.length} matches loaded from Supabase. ${canEdit() ? 'You can edit the shared record.' : 'Your access is read-only.'}</p></div><div class="metric"><strong>${matches.length}</strong><span>recorded matches</span></div></section><div class="notice">${canEdit() ? 'Editor mode is on.' : 'Viewer mode is on. Ask the team owner for editor access.'}</div>`
  } else {
    content.innerHTML = `<section class="toolbar"><p class="muted">${matches.length} shared matches</p>${canEdit() ? '<button id="add-match" class="primary">Add match</button>' : ''}</section><div class="table-wrap"><table><thead><tr><th>Date</th><th>Opponent</th><th>Competition</th><th>Score</th><th>Result</th>${canEdit() ? '<th></th>' : ''}</tr></thead><tbody>${matches.map(m => `<tr><td>${escapeHtml(m.match_date)}</td><td>${escapeHtml(m.opponent)}</td><td>${escapeHtml(m.competition)}</td><td>${escapeHtml(m.score || 'vs')}</td><td>${escapeHtml(m.result || 'Upcoming')}</td>${canEdit() ? `<td><button class="edit" data-id="${m.id}">Edit</button></td>` : ''}</tr>`).join('')}</tbody></table></div>`
    if (canEdit()) {
      document.querySelector('#add-match').addEventListener('click', () => openEditor())
      document.querySelectorAll('.edit').forEach(b => b.addEventListener('click', () => openEditor(matches.find(m => String(m.id) === b.dataset.id))))
    }
  }
}

function openEditor(match = {}) {
  const isEdit = Boolean(match.id)
  const form = document.createElement('dialog')
  form.innerHTML = `<form method="dialog" class="dialog-card"><h2>${isEdit ? 'Edit match' : 'Add match'}</h2><input id="m-date" type="date" value="${match.match_date || ''}" required><input id="m-opponent" placeholder="Opponent" value="${escapeHtml(match.opponent || '')}" required><select id="m-comp"><option ${match.competition === 'League' ? 'selected' : ''}>League</option><option ${match.competition === 'Cup' ? 'selected' : ''}>Cup</option></select><input id="m-score" placeholder="Score, e.g. 2-1" value="${escapeHtml(match.score || '')}"><input id="m-result" placeholder="Result, e.g. W, D, L" value="${escapeHtml(match.result || '')}"><textarea id="m-notes" placeholder="Scorers and notes">${escapeHtml(match.notes || '')}</textarea><div class="dialog-actions"><button value="cancel" class="ghost">Cancel</button><button id="save" value="default" class="primary">Save</button></div></form>`
  document.body.append(form);form.showModal()
  form.querySelector('#save').addEventListener('click', async e => { e.preventDefault(); const payload={match_date:form.querySelector('#m-date').value,opponent:form.querySelector('#m-opponent').value,competition:form.querySelector('#m-comp').value,score:form.querySelector('#m-score').value,result:form.querySelector('#m-result').value,notes:form.querySelector('#m-notes').value}; const request=isEdit?supabase.from('matches').update(payload).eq('id',match.id):supabase.from('matches').insert(payload); const {error}=await request; if(error){alert(error.message);return} form.close();form.remove();await loadMatches();showPage('matches') })
}

async function boot() {
  const { data } = await supabase.auth.getSession(); session = data.session
  if (!session) { renderAuth(); return }
  const { data: p } = await supabase.from('profiles').select('role').eq('id', session.user.id).single(); profile = p || { role: 'viewer' }
  await loadMatches(); renderApp()
}
supabase.auth.onAuthStateChange((_event, next) => { session = next; if (next) boot(); else renderAuth() })
boot()
