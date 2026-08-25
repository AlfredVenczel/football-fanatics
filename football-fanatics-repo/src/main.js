import './styles.css'
import { supabase } from './lib/supabase.js'
import staticPlayers from './players.json'
import staticPlayerMatches from './player_matches.json'
import standings from './standings.json'

const app = document.querySelector('#app')
let session = null
let profile = null
let matches = []
let players = []
let playerMatches = []
let seasons = []
let playerSeasons = []

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))
const canEdit = () => profile?.role === 'editor'
const resultClass = result => result === 'W' ? 'win' : result === 'D' ? 'draw' : result === 'L' ? 'loss' : 'upcoming'
const normalizeSeason = season => { const value=String(season||'').trim(); const m=value.match(/(20\d\d)[\/-](20\d\d)/); return m ? `${m[1]}-${m[2]}` : value.replace('/', '-'); }; const seasonLabel = season => normalizeSeason(season).replace('-', '/')
const playerId = name => String(name).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const staticPlayer = p => ({...p, league_apps:p.leagueApps ?? 0, league_goals:p.leagueGoals ?? 0, cup_apps:p.cupApps ?? 0, cup_goals:p.cupGoals ?? 0, total_goals:p.totalGoals ?? 0, jersey_number:p.jerseyNumber ?? null})

function renderAuth() {
  app.innerHTML = `<main class="auth-shell"><section class="auth-card"><div class="crest">FF</div><p class="eyebrow">Football Fanatics</p><h1>Team hub</h1><p class="muted">Sign in to view the match record. Editors can update it.</p><form id="auth-form"><input id="email" type="email" placeholder="Email" required><input id="password" type="password" placeholder="Password" required><button class="primary">Sign in</button><p id="auth-message" class="message"></p></form></section></main>`
  document.querySelector('#auth-form').addEventListener('submit', async event => {
    event.preventDefault()
    const { error } = await supabase.auth.signInWithPassword({ email: document.querySelector('#email').value, password: document.querySelector('#password').value })
    document.querySelector('#auth-message').textContent = error ? error.message : 'Signed in.'
  })
}

async function load() {
  const [matchResult, playerResult, playerMatchResult, seasonResult, playerSeasonResult] = await Promise.all([
    supabase.from('matches').select('*').order('match_date', { ascending: false }),
    supabase.from('players').select('*').order('name'),
    supabase.from('player_match_stats').select('*').order('match_date', { ascending: false }),
    supabase.from('seasons').select('*').order('season'),
    supabase.from('player_seasons').select('*').order('season')
  ])
  matches = matchResult.data || []
  players = playerResult.data?.length ? playerResult.data : staticPlayers.map(staticPlayer)
  playerMatches = playerMatchResult.data?.length ? playerMatchResult.data : staticPlayerMatches
  seasons = seasonResult.data || []
  playerSeasons = playerSeasonResult.data || []
}

function renderShell() {
  app.innerHTML = `<div class="shell"><aside class="sidebar"><div class="brand"><div class="crest">FF</div><div><strong>Football Fanatics</strong><small>team hub</small></div></div><nav><button data-page="dashboard" class="active">Tablazat</button><button data-page="matches">Merkozesek</button><button data-page="players">Jatekosok</button></nav><div class="side-foot"><span>${esc(session.user.email)}</span><b>${canEdit() ? 'Editor' : 'Viewer'}</b><button id="signout" class="ghost">Sign out</button></div></aside><main class="main"><header><div><span class="eyebrow">Authenticated workspace</span><h1 id="page-title">Tablazat</h1></div><span class="role">${canEdit() ? 'EDIT ACCESS' : 'VIEW ONLY'}</span></header><section id="content"></section></main></div>`
  document.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => showPage(button.dataset.page)))
  document.querySelector('#signout').addEventListener('click', () => supabase.auth.signOut())
  showPage('dashboard')
}

function seasonNames() {
  return [...new Set([...Object.keys(standings), ...seasons.map(row => row.season), ...playerSeasons.map(row => row.season), ...playerMatches.map(row => row.season)].filter(Boolean).map(normalizeSeason))].sort().reverse()
}

function teamTable(season) {
  const rows = standings[normalizeSeason(season)] || []
  if (!rows.length) return `<div class="empty"><strong>Nincs tabella ehhez a szezonhoz</strong>Adj hozza csapatokat kesobb.</div>`
  return `<div class="table-wrap"><table><thead><tr><th>#</th><th>Csapat</th><th>J</th><th>Gy</th><th>D</th><th>V</th><th>RG</th><th>KG</th><th>GA</th><th>Pont</th></tr></thead><tbody>${rows.map(row => `<tr class="${row.team === 'Football Fanatics' ? 'highlight' : ''}"><td>${row.rank}</td><td><strong>${esc(row.team)}</strong></td><td>${row.played}</td><td>${row.w}</td><td>${row.d}</td><td>${row.l}</td><td>${row.gf}</td><td>${row.ga}</td><td>${row.gd > 0 ? '+' : ''}${row.gd}</td><td><strong>${row.points}</strong></td></tr>`).join('')}</tbody></table></div>`
}

function playerMatchSeason(row) { return normalizeSeason(row.season) }
function playerMatchPlayerId(row) { return row.player_id || row.playerId || '' }
function playerNameById(id) { return players.find(player => player.id === id)?.name || playerMatches.find(row => playerMatchPlayerId(row) === id)?.player || '' }

function num(value) { const n = Number(value); return Number.isFinite(n) ? n : 0 }
function rowCompetition(row) { return row.competition === 'Cup' || row.competition === 'Kupa' ? 'Cup' : 'League' }
function rowCards(row, key, legacy) { return num(row[key] ?? row[legacy] ?? row[legacy === 'stat1' ? 'stat1' : legacy]) }
function detailRowsForSeason(season) { return playerMatches.filter(row => season === 'all' || normalizeSeason(row.season) === normalizeSeason(season)) }
function playerIsInSeason(id, season) { return season === 'all' || playerMatches.some(row => playerMatchPlayerId(row) === id && normalizeSeason(row.season) === normalizeSeason(season)) || playerSeasons.some(row => row.player_id === id && normalizeSeason(row.season) === normalizeSeason(season)) }
function playerStatsForSeason(player, season) {
  if (season === 'all') return { leagueApps:num(player.league_apps ?? player.leagueApps), cupApps:num(player.cup_apps ?? player.cupApps), leagueGoals:num(player.league_goals ?? player.leagueGoals), cupGoals:num(player.cup_goals ?? player.cupGoals), totalGoals:num(player.total_goals ?? player.totalGoals) }
  const rows = playerMatches.filter(row => playerMatchPlayerId(row) === player.id && normalizeSeason(row.season) === normalizeSeason(season))
  return rows.reduce((a, row) => { const c=rowCompetition(row); const played=num(row.played ?? 1); const goals=num(row.goals); if(c==='Cup'){a.cupApps+=played;a.cupGoals+=goals}else{a.leagueApps+=played;a.leagueGoals+=goals} a.totalGoals+=goals; return a }, {leagueApps:0,cupApps:0,leagueGoals:0,cupGoals:0,totalGoals:0})
}
function totalPlayerStats(season) {
  if (season === 'all') return players.reduce((a,p) => { const x=playerStatsForSeason(p,'all'); a.leagueApps+=x.leagueApps;a.cupApps+=x.cupApps;a.leagueGoals+=x.leagueGoals;a.cupGoals+=x.cupGoals;a.totalGoals+=x.totalGoals; return a }, {leagueApps:0,cupApps:0,leagueGoals:0,cupGoals:0,totalGoals:0})
  return players.filter(p => playerIsInSeason(p.id, season)).reduce((a,p) => { const x=playerStatsForSeason(p,season); a.leagueApps+=x.leagueApps;a.cupApps+=x.cupApps;a.leagueGoals+=x.leagueGoals;a.cupGoals+=x.cupGoals;a.totalGoals+=x.totalGoals; return a }, {leagueApps:0,cupApps:0,leagueGoals:0,cupGoals:0,totalGoals:0})
}
function playerTableRows(season) {
  const rows = players.filter(p => playerIsInSeason(p.id, season)).map(player => ({player, stats:playerStatsForSeason(player, season)})).sort((a,b) => b.stats.totalGoals-a.stats.totalGoals || a.player.name.localeCompare(b.player.name))
  const total=totalPlayerStats(season)
  const totalRow=`<tr class="total-row"><td><strong>Osszesen</strong></td><td></td><td><strong>${total.leagueApps}</strong></td><td><strong>${total.cupApps}</strong></td><td><strong>${total.leagueGoals}</strong></td><td><strong>${total.cupGoals}</strong></td><td><strong>${total.totalGoals}</strong></td><td></td></tr>`
  const dataRows=rows.map(({player,stats})=>`<tr class="clickable" data-player="${esc(player.id)}"><td><strong>${esc(player.name)}</strong></td><td>${player.jersey_number ?? player.jerseyNumber ?? ''}</td><td>${stats.leagueApps}</td><td>${stats.cupApps}</td><td>${stats.leagueGoals}</td><td>${stats.cupGoals}</td><td><strong>${stats.totalGoals}</strong></td><td>${canEdit()?`<button class="edit-player" data-edit-player="${esc(player.id)}">Szerkeszt</button>`:''}</td></tr>`).join('')
  return totalRow+dataRows
}

function seasonPlayerRows(season) {
  const rows = playerMatches.filter(row => playerMatchSeason(row) === normalizeSeason(season))
  if (!rows.length) return `<div class="empty"><strong>Nincs jatekos merkozesadat ehhez a szezonhoz</strong>A Jatekosok oldalon adj meccset a jatekos profiljahoz.</div>`
  const total=rows.reduce((a,row)=>{a.played+=num(row.played??1);a.goals+=num(row.goals);a.yellow+=num(row.yellow_cards??row.yellowCards??row.stat1);a.yellowRed+=num(row.yellow_red_cards??row.yellowRedCards??row.stat2);a.red+=num(row.red_cards??row.redCards??row.stat3);return a},{played:0,goals:0,yellow:0,yellowRed:0,red:0})
  const names=Object.fromEntries(players.map(player=>[player.id,player.name]))
  const totalRow=`<tr class="total-row"><td><strong>Osszesen</strong></td><td></td><td></td><td></td><td></td><td></td><td><strong>${total.played}</strong></td><td><strong>${total.goals}</strong></td><td><strong>${total.yellow}</strong></td><td><strong>${total.yellowRed}</strong></td><td><strong>${total.red}</strong></td></tr>`
  return `<div class="table-wrap"><table><thead><tr><th>Jatekos</th><th>Datum</th><th>Sorozat</th><th>Ellenfel</th><th>Allas</th><th>Eredmeny</th><th>Jatszott</th><th>Gol</th><th title="Yellow card">🟨</th><th title="One yellow and one red">🟨🟥</th><th title="Red card">🟥</th></tr></thead><tbody>${totalRow}${rows.map(row => `<tr class="clickable" data-record-player="${esc(playerMatchPlayerId(row))}"><td><strong>${esc(names[playerMatchPlayerId(row)]||row.player||'')}</strong></td><td>${esc(row.match_date || row.matchDate || '')}</td><td>${row.competition === 'League' ? 'Bajnoksag' : 'Kupa'}</td><td>${esc(row.opponent)}</td><td>${esc(row.score || '')}</td><td><span class="result ${resultClass(row.result)}">${row.result === 'U' ? '?' : row.result}</span></td><td>${row.played ?? 1}</td><td>${row.goals ?? 0}</td><td>${row.yellow_cards ?? row.yellowCards ?? row.stat1 ?? 0}</td><td>${row.yellow_red_cards ?? row.yellowRedCards ?? row.stat2 ?? 0}</td><td>${row.red_cards ?? row.redCards ?? row.stat3 ?? 0}</td></tr>`).join('')}</tbody></table></div>`
}

function dashboard() {
  const names = seasonNames()
  const selected = names.includes('2025/2026') ? '2025/2026' : names[0]
  return `<section class="hero"><div><h2>Szezon attekintese</h2><p class="muted">${matches.length} shared matches. ${canEdit() ? 'Editor mode is on.' : 'Your access is read-only.'}</p></div><div class="metric"><strong>${matches.length}</strong><span>recorded matches</span></div></section><section class="panel"><div class="section-head"><div><h2>Tablazat</h2><p class="muted">Minden csapat, J / Gy / D / V, golok es pontok</p></div><div class="profile-actions">${canEdit() ? '<button class="primary" id="add-season">Uj szezon</button>' : ''}<select id="team-season">${names.map(name => `<option value="${esc(name)}" ${name === selected ? 'selected' : ''}>${esc(seasonLabel(name))}</option>`).join('')}</select></div></div><div id="team-table">${teamTable(selected)}</div><div class="season-record"><div class="section-head"><div><h2>Jatekos merkozesrekord</h2><p class="muted">A kiválasztott szezon játékosainak minden mérkőzése, összesítése és statisztikája</p></div><span class="role" id="season-record-count"></span></div><div id="season-player-record">${seasonPlayerRows(selected)}</div></div></section>`
}

function playersPage() {
  const names=seasonNames();
  return `<section class="panel"><div class="section-head"><div><h2>Jatekosok</h2><p class="muted">Az első sor a kiválasztott szezon összesített adatait mutatja. Kattints egy játékosra a részletekhez.</p></div><div class="profile-actions"><select id="players-season">${names.map(name=>`<option value="${esc(name)}">${esc(seasonLabel(name))}</option>`).join('')}<option value="all" selected>Minden szezon</option></select><span class="role" id="players-count">${players.length} jatekos</span>${canEdit()?'<button class="primary" id="add-player">Uj jatekos</button>':''}</div></div><div class="table-wrap"><table><thead><tr><th>Jatekos</th><th>Mez szam</th><th>Bajnoki megjelenes</th><th>Kupa megjelenes</th><th>Bajnoki gol/ok</th><th>Kupa gol/ok</th><th>Osszes gol</th><th></th></tr></thead><tbody id="players-table-body">${playerTableRows('all')}</tbody></table></div></section>`
}
function bindPlayersTable(season) {
  const body=document.querySelector('#players-table-body');
  if(body) body.innerHTML=playerTableRows(season)
  document.querySelectorAll('.clickable').forEach(row=>row.addEventListener('click',event=>{if(!event.target.closest('button'))playerProfile(row.dataset.player)}))
  if(canEdit()) document.querySelectorAll('[data-edit-player]').forEach(button=>button.addEventListener('click',event=>{event.stopPropagation();editPlayer(players.find(player=>player.id===button.dataset.editPlayer))}))
}

function matchesPage() {
  return `<section class="toolbar"><p class="muted">${matches.length} shared matches</p>${canEdit() ? '<button id="add-match" class="primary">Merkozes hozzaadasa</button>' : ''}</section><div class="table-wrap"><table><thead><tr><th>Datum</th><th>Ellenfel</th><th>Sorozat</th><th>Allas</th><th>Eredmeny</th>${canEdit() ? '<th></th>' : ''}</tr></thead><tbody>${matches.map(match => `<tr><td>${esc(match.match_date || '')}</td><td>${esc(match.opponent)}</td><td>${match.competition === 'League' ? 'Bajnoksag' : 'Kupa'}</td><td>${esc(match.score || 'vs')}</td><td><span class="result ${resultClass(match.result)}">${esc(match.result || 'Upcoming')}</span></td>${canEdit() ? `<td><button class="edit" data-match-edit="${match.id}">Szerkeszt</button></td>` : ''}</tr>`).join('')}</tbody></table></div>`
}

function playerProfile(id) {
  const player = players.find(row => row.id === id)
  if (!player) return
  const rows = playerMatches.filter(row => playerMatchPlayerId(row) === id)
  const playerSeasonNames = [...new Set([...rows.map(row => normalizeSeason(row.season)), ...playerSeasons.filter(row => row.player_id === id).map(row => normalizeSeason(row.season))].filter(Boolean))].sort().reverse()
  document.querySelector('#page-title').textContent = player.name
  document.querySelector('#content').innerHTML = `<button class="back" id="back">← Jatekosok</button><section class="player-hero"><div><span class="eyebrow">Jatekos adatlap</span><h2>${esc(player.name)}</h2><p class="muted">Szezonok es merkozesenkenti adatok</p></div><div class="profile-actions">${canEdit() ? '<button class="secondary" id="add-player-season">Szezon hozzaadasa</button><button class="primary" id="add-player-match">Merkozes hozzaadasa</button>' : ''}</div></section><section class="panel"><div class="section-head"><div><h2>Merkozesek nyilvantartasa</h2><p class="muted">Datum, sorozat, ellenfel, allas, eredmeny, jatszott, gol es lapok</p></div><select id="player-season"><option value="all">Minden szezon</option>${playerSeasonNames.map(name => `<option value="${esc(name)}">${esc(seasonLabel(name))}</option>`).join('')}</select></div><div id="player-history"></div></section>`
  document.querySelector('#back').addEventListener('click', () => showPage('players'))
  document.querySelector('#player-season').addEventListener('change', event => renderPlayerHistory(rows, event.target.value))
  if (canEdit()) {
    document.querySelector('#add-player-season').addEventListener('click', () => addPlayerSeason(player))
    document.querySelector('#add-player-match').addEventListener('click', () => addPlayerMatch(player, playerSeasonNames))
  }
  renderPlayerHistory(rows, 'all')
}

function renderPlayerHistory(rows, season) {
  const data = rows.filter(row => season === 'all' || normalizeSeason(row.season) === normalizeSeason(season))
  document.querySelector('#player-history').innerHTML = `<div class="table-wrap"><table><thead><tr><th>Szezon</th><th>Datum</th><th>Sorozat</th><th>Ellenfel</th><th>Allas</th><th>Eredmeny</th><th>Jatszott</th><th>Gol</th><th title="Yellow card">🟨</th><th title="One yellow and one red">🟨🟥</th><th title="Red card">🟥</th>${canEdit() ? '<th></th>' : ''}</tr></thead><tbody>${data.map(row => `<tr><td>${esc(row.season)}</td><td>${esc(row.match_date || row.matchDate || '')}</td><td>${row.competition === 'League' ? 'Bajnoksag' : 'Kupa'}</td><td>${esc(row.opponent)}</td><td>${esc(row.score || '')}</td><td><span class="result ${resultClass(row.result)}">${row.result === 'U' ? '?' : row.result}</span></td><td>${row.played ?? 1}</td><td>${row.goals ?? 0}</td><td>${row.yellow_cards ?? row.yellowCards ?? row.stat1 ?? 0}</td><td>${row.yellow_red_cards ?? row.yellowRedCards ?? row.stat2 ?? 0}</td><td>${row.red_cards ?? row.redCards ?? row.stat3 ?? 0}</td>${canEdit() ? `<td><button class="edit" data-player-match-edit="${esc(row.id)}">Szerkeszt</button></td>` : ''}</tr>`).join('') || '<tr><td colspan="12" class="empty">Nincs merkozes ehhez a szezonhoz.</td></tr>'}</tbody></table></div>`
  if (canEdit()) document.querySelectorAll('[data-player-match-edit]').forEach(button => button.addEventListener('click', () => editPlayerMatch(rows.find(row => String(row.id) === button.dataset.playerMatchEdit))))
}

function showPage(page) {
  document.querySelectorAll('[data-page]').forEach(button => button.classList.toggle('active', button.dataset.page === page))
  document.querySelector('#page-title').textContent = page === 'dashboard' ? 'Tablazat' : page === 'players' ? 'Jatekosok' : 'Merkozesek'
  const content = document.querySelector('#content')
  if (page === 'dashboard') {
    content.innerHTML = dashboard()
    bindSeasonRecord()
    document.querySelector('#team-season').addEventListener('change', event => {
      document.querySelector('#team-table').innerHTML = teamTable(event.target.value)
      document.querySelector('#season-player-record').innerHTML = seasonPlayerRows(event.target.value)
      bindSeasonRecord()
    })
    if (canEdit()) document.querySelector('#add-season').addEventListener('click', addGlobalSeason)
  } else if (page === 'players') {
    content.innerHTML = playersPage()
    bindPlayersTable('all')
    document.querySelector('#players-season').addEventListener('change', event => bindPlayersTable(event.target.value))
    if (canEdit()) document.querySelector('#add-player').addEventListener('click', addPlayer)
  } else {
    content.innerHTML = matchesPage()
    if (canEdit()) {
      document.querySelector('#add-match').addEventListener('click', () => editMatch())
      document.querySelectorAll('[data-match-edit]').forEach(button => button.addEventListener('click', () => editMatch(matches.find(match => String(match.id) === button.dataset.matchEdit))))
    }
  }
}

function bindSeasonRecord() {
  const rows = document.querySelectorAll('[data-record-player]')
  const counter = document.querySelector('#season-record-count')
  if (counter) counter.textContent = `${rows.length} sor`
  rows.forEach(row => row.addEventListener('click', () => playerProfile(row.dataset.recordPlayer)))
}

function dialog(title, body, save) {
  const element = document.createElement('dialog')
  element.innerHTML = `<form method="dialog" class="dialog-card"><h2>${title}</h2>${body}<div class="dialog-actions"><button value="cancel" class="ghost">Megse</button><button id="save" class="primary">Mentes</button></div></form>`
  document.body.append(element)
  element.showModal()
  element.querySelector('#save').addEventListener('click', async event => { event.preventDefault(); await save(element) })
}

async function addGlobalSeason() { dialog('Uj szezon', '<input id="season" placeholder="Pelda: 2026/2027" required><input id="note" placeholder="Megjegyzes">', async element => { const name = element.querySelector('#season').value.trim(); if (!name) return; const { error } = await supabase.from('seasons').insert({ season:name, notes:element.querySelector('#note').value }); if (error) return alert(error.message); element.close(); element.remove(); await load(); showPage('dashboard') }) }
async function addPlayerSeason(player) { dialog('Szezon hozzaadasa', '<input id="season" placeholder="Pelda: 2026/2027" required><input id="note" placeholder="Megjegyzes">', async element => { const { error } = await supabase.from('player_seasons').upsert({ player_id:player.id, season:normalizeSeason(element.querySelector('#season').value.trim()), notes:element.querySelector('#note').value }, { onConflict:'player_id,season' }); if (error) return alert(error.message); element.close(); element.remove(); await load(); playerProfile(player.id) }) }
async function addPlayer() { const names = seasonNames(); dialog('Uj jatekos', `<input id="name" placeholder="Jatekos neve" required><label>Mez szam<input id="jersey" type="number" min="0"></label><label>Aktiv szezon<select id="season">${names.map(name => `<option>${esc(name)}</option>`).join('')}</select></label><label>Bajnoki megjelenes<input id="la" type="number" min="0" value="0"></label><label>Kupa megjelenes<input id="ca" type="number" min="0" value="0"></label><label>Bajnoki gol/ok<input id="lg" type="number" min="0" value="0"></label><label>Kupa gol/ok<input id="cg" type="number" min="0" value="0"></label>`, async element => { const name = element.querySelector('#name').value.trim(); const id = playerId(name); const { error } = await supabase.from('players').insert({ id, name, jersey_number:+element.querySelector('#jersey').value || null, league_apps:+element.querySelector('#la').value, cup_apps:+element.querySelector('#ca').value, league_goals:+element.querySelector('#lg').value, cup_goals:+element.querySelector('#cg').value }); if (error) return alert(error.message); const { error: seasonError } = await supabase.from('player_seasons').upsert({ player_id:id, season:element.querySelector('#season').value }, { onConflict:'player_id,season' }); if (seasonError) return alert(seasonError.message); element.close(); element.remove(); await load(); showPage('players') }) }
async function editPlayer(player) { dialog('Jatekos szerkesztese', `<input id="name" value="${esc(player.name)}" required><label>Mez szam<input id="jersey" type="number" min="0" value="${player.jersey_number ?? player.jerseyNumber ?? ''}"></label><label>Bajnoki megjelenes<input id="la" type="number" min="0" value="${player.league_apps ?? player.leagueApps ?? 0}"></label><label>Kupa megjelenes<input id="ca" type="number" min="0" value="${player.cup_apps ?? player.cupApps ?? 0}"></label><label>Bajnoki gol/ok<input id="lg" type="number" min="0" value="${player.league_goals ?? player.leagueGoals ?? 0}"></label><label>Kupa gol/ok<input id="cg" type="number" min="0" value="${player.cup_goals ?? player.cupGoals ?? 0}"></label>`, async element => { const { error } = await supabase.from('players').update({ name:element.querySelector('#name').value, jersey_number:+element.querySelector('#jersey').value || null, league_apps:+element.querySelector('#la').value, cup_apps:+element.querySelector('#ca').value, league_goals:+element.querySelector('#lg').value, cup_goals:+element.querySelector('#cg').value }).eq('id', player.id); if (error) return alert(error.message); element.close(); element.remove(); await load(); showPage('players') }) }
async function addPlayerMatch(player, existingSeasons) { const options = existingSeasons.length ? existingSeasons : seasonNames(); dialog('Merkozes hozzaadasa', `<select id="season">${options.map(name => `<option>${esc(name)}</option>`).join('') || '<option>2026/2027</option>'}</select><select id="comp"><option value="League">Bajnoksag</option><option value="Cup">Kupa</option></select><input id="date" type="date"><input id="opp" placeholder="Ellenfel" required><input id="score" placeholder="Allas"><select id="result"><option>W</option><option>D</option><option>L</option><option>U</option></select><label>Jatszott<input id="played" type="number" min="0" value="1"></label><label>Gol<input id="goals" type="number" min="0" value="0"></label><label>🟨<input id="y" type="number" min="0" value="0"></label><label>🟨🟥<input id="yr" type="number" min="0" value="0"></label><label>🟥<input id="r" type="number" min="0" value="0"></label>`, async element => { const { error } = await supabase.from('player_match_stats').insert({ player_id:player.id, season:normalizeSeason(element.querySelector('#season').value), competition:element.querySelector('#comp').value, match_date:element.querySelector('#date').value || null, opponent:element.querySelector('#opp').value, score:element.querySelector('#score').value, result:element.querySelector('#result').value, played:+element.querySelector('#played').value, goals:+element.querySelector('#goals').value, yellow_cards:+element.querySelector('#y').value, yellow_red_cards:+element.querySelector('#yr').value, red_cards:+element.querySelector('#r').value }); if (error) return alert(error.message); element.close(); element.remove(); await load(); playerProfile(player.id) }) }
async function editPlayerMatch(row) { dialog('Jatekos merkozes szerkesztese', `<input id="opp" value="${esc(row.opponent)}"><input id="score" value="${esc(row.score || '')}" placeholder="Allas"><select id="result"><option ${row.result === 'W' ? 'selected' : ''}>W</option><option ${row.result === 'D' ? 'selected' : ''}>D</option><option ${row.result === 'L' ? 'selected' : ''}>L</option><option ${row.result === 'U' ? 'selected' : ''}>U</option></select><label>Jatszott<input id="played" type="number" min="0" value="${row.played ?? 1}"></label><label>Gol<input id="goals" type="number" min="0" value="${row.goals ?? 0}"></label><label>🟨<input id="y" type="number" min="0" value="${row.yellow_cards ?? row.yellowCards ?? row.stat1 ?? 0}"></label><label>🟨🟥<input id="yr" type="number" min="0" value="${row.yellow_red_cards ?? row.yellowRedCards ?? row.stat2 ?? 0}"></label><label>🟥<input id="r" type="number" min="0" value="${row.red_cards ?? row.redCards ?? row.stat3 ?? 0}"></label>`, async element => { const { error } = await supabase.from('player_match_stats').update({ opponent:element.querySelector('#opp').value, score:element.querySelector('#score').value, result:element.querySelector('#result').value, played:+element.querySelector('#played').value, goals:+element.querySelector('#goals').value, yellow_cards:+element.querySelector('#y').value, yellow_red_cards:+element.querySelector('#yr').value, red_cards:+element.querySelector('#r').value }).eq('id', row.id); if (error) return alert(error.message); element.close(); element.remove(); await load(); playerProfile(playerMatchPlayerId(row)) }) }
async function editMatch(match = {}) { const edit = Boolean(match.id); dialog(edit ? 'Merkozes szerkesztese' : 'Merkozes hozzaadasa', `<input id="date" type="date" value="${match.match_date || ''}" required><input id="opp" value="${esc(match.opponent || '')}" placeholder="Ellenfel" required><select id="comp"><option value="League" ${match.competition === 'League' ? 'selected' : ''}>Bajnoksag</option><option value="Cup" ${match.competition === 'Cup' ? 'selected' : ''}>Kupa</option></select><input id="score" value="${esc(match.score || '')}" placeholder="Allas"><select id="result"><option ${match.result === 'W' ? 'selected' : ''}>W</option><option ${match.result === 'D' ? 'selected' : ''}>D</option><option ${match.result === 'L' ? 'selected' : ''}>L</option><option ${!match.result ? 'selected' : ''}>U</option></select><textarea id="notes" placeholder="Golszerzok es megjegyzesek">${esc(match.notes || '')}</textarea>`, async element => { const payload = { match_date:element.querySelector('#date').value, opponent:element.querySelector('#opp').value, competition:element.querySelector('#comp').value, score:element.querySelector('#score').value, result:element.querySelector('#result').value, notes:element.querySelector('#notes').value }; const request = edit ? supabase.from('matches').update(payload).eq('id', match.id) : supabase.from('matches').insert(payload); const { error } = await request; if (error) return alert(error.message); element.close(); element.remove(); await load(); showPage('matches') }) }

async function boot() { const { data } = await supabase.auth.getSession(); session = data.session; if (!session) return renderAuth(); const { data: userProfile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single(); profile = userProfile || { role:'viewer' }; await load(); renderShell() }
supabase.auth.onAuthStateChange((_event, next) => { session = next; if (next) boot(); else renderAuth() })
boot()
