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
let selectedTeam = null

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
  app.innerHTML = `<div class="shell"><aside class="sidebar"><div class="brand"><div><strong>Football Fanatics</strong><small>team hub</small></div></div><nav><button data-page="dashboard" class="active">Tabella</button><button data-page="matches">Merkozesek</button><button data-page="players">Jatekosok</button><button data-page="teams">Csapatok</button></nav><div class="sidebar-logo-slot"><img class="sidebar-logo" src="/football-fanatics-logo.webp" alt="Football Fanatics logo"><img class="league-logo" src="/sepsi-logo.webp" alt="Sepsi Minifotbal logo"><span class="league-label">Sepsi Minifotbal</span></div><div class="side-foot"><span>${session ? esc(session.user.email) : 'Public view'}</span><b>${canEdit() ? 'Editor' : 'Viewer'}</b>${session ? '<button id="signout" class="ghost">Sign out</button>' : '<button id="admin-login" class="ghost">Admin login</button>'}</div></aside><main class="main"><header><div><span class="eyebrow">${session ? 'Authenticated workspace' : 'Public team workspace'}</span><h1 id="page-title">Tabella</h1></div><span class="role">${canEdit() ? 'EDIT ACCESS' : 'PUBLIC VIEW'}</span></header><section id="content"></section></main></div>`
  document.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => showPage(button.dataset.page)))
  document.querySelector('#signout')?.addEventListener('click', () => supabase.auth.signOut())
  document.querySelector('#admin-login')?.addEventListener('click', openAdminLogin)
  showPage('dashboard')
}

function seasonFromDate(value) {
  const match = String(value || '').match(/(20\d\d)[-\/](\d{1,2})[-\/](\d{1,2})/)
  if (!match) return ''
  const year = Number(match[1])
  const month = Number(match[2])
  return month >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`
}
function matchSeason(match) {
  return normalizeSeason(match?.season || match?.season_name || match?.seasonName || seasonFromDate(match?.match_date || match?.date || match?.matchDate))
}
function matchHome(match) {
  const explicit = match?.home_team || match?.homeTeam || match?.home || match?.hazai
  if (explicit) return explicit
  return match?.is_home === false || match?.isHome === false ? (match.opponent || '') : 'Football Fanatics'
}
function matchAway(match) {
  const explicit = match?.away_team || match?.awayTeam || match?.away || match?.idegen
  if (explicit) return explicit
  return match?.is_home === false || match?.isHome === false ? 'Football Fanatics' : (match.opponent || '')
}
function matchScorers(match) { return match?.goal_scorers || match?.goalscorers || match?.scorers || match?.goalScorers || match?.gol_szerzo || match?.notes || '' }
function scoreParts(match) {
  const found = String(match?.score || '').match(/(\d+)\s*[-:]\s*(\d+)/)
  return found ? [Number(found[1]), Number(found[2])] : [null, null]
}
function isOurTeam(name) { return String(name || '').toLowerCase().includes('football fanatics') }
function matchGoalsForAgainst(match) {
  const [first, second] = scoreParts(match)
  if (first === null) return { gf: 0, ga: 0 }
  const home = matchHome(match), away = matchAway(match)
  if (isOurTeam(home)) return { gf: first, ga: second }
  if (isOurTeam(away)) return { gf: second, ga: first }
  return { gf: first, ga: second }
}
function matchResult(match) {
  if (match?.result && ['W','D','L'].includes(String(match.result).toUpperCase())) return String(match.result).toUpperCase()
  const { gf, ga } = matchGoalsForAgainst(match)
  return gf > ga ? 'W' : gf < ga ? 'L' : 'D'
}
function displayDate(value) {
  const found = String(value || '').match(/(20\d\d)[-\/](\d{1,2})[-\/](\d{1,2})/)
  return found ? `${found[3].padStart(2,'0')}.${found[2].padStart(2,'0')}.${found[1]}` : String(value || '')
}
function displayTime(match) { return match?.match_time || match?.time || match?.matchTime || '' }
function seasonNames() {
  return [...new Set([...Object.keys(standings), ...seasons.map(row => row.season), ...playerSeasons.map(row => row.season), ...playerMatches.map(row => row.season), ...matches.map(matchSeason)].filter(Boolean).map(normalizeSeason))].sort().reverse()
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
  if (season === 'all') {
    const leagueApps=num(player.league_apps ?? player.leagueApps)
    const cupApps=num(player.cup_apps ?? player.cupApps)
    const leagueGoals=num(player.league_goals ?? player.leagueGoals)
    const cupGoals=num(player.cup_goals ?? player.cupGoals)
    return {leagueApps,cupApps,leagueGoals,cupGoals,totalGoals:leagueGoals+cupGoals}
  }
  const rows=playerMatches.filter(row=>playerMatchPlayerId(row)===player.id&&normalizeSeason(row.season)===normalizeSeason(season))
  return rows.reduce((a,row)=>{const c=rowCompetition(row),played=num(row.played??1),goals=num(row.goals);if(c==='Cup'){a.cupApps+=played;a.cupGoals+=goals}else{a.leagueApps+=played;a.leagueGoals+=goals}a.totalGoals+=goals;return a},{leagueApps:0,cupApps:0,leagueGoals:0,cupGoals:0,totalGoals:0})
}

function totalPlayerStats(season) {
  if (season === 'all') return players.reduce((a,p) => { const x=playerStatsForSeason(p,'all'); a.leagueApps+=x.leagueApps;a.cupApps+=x.cupApps;a.leagueGoals+=x.leagueGoals;a.cupGoals+=x.cupGoals;a.totalGoals+=x.totalGoals; return a }, {leagueApps:0,cupApps:0,leagueGoals:0,cupGoals:0,totalGoals:0})
  return players.filter(p => playerIsInSeason(p.id, season)).reduce((a,p) => { const x=playerStatsForSeason(p,season); a.leagueApps+=x.leagueApps;a.cupApps+=x.cupApps;a.leagueGoals+=x.leagueGoals;a.cupGoals+=x.cupGoals;a.totalGoals+=x.totalGoals; return a }, {leagueApps:0,cupApps:0,leagueGoals:0,cupGoals:0,totalGoals:0})
}
function playerTableRows(season) {
  const rows = players.filter(p => playerIsInSeason(p.id, season)).map(player => ({player, stats:playerStatsForSeason(player, season)})).sort((a,b) => b.stats.totalGoals-a.stats.totalGoals || a.player.name.localeCompare(b.player.name))
  const total=totalPlayerStats(season)
  const totalRow=`<tr class="total-row"><td><strong>Osszesen</strong></td><td></td><td><strong>${total.leagueApps}</strong></td><td><strong>${total.cupApps}</strong></td><td><strong>${total.leagueGoals}</strong></td><td><strong>${total.cupGoals}</strong></td><td><strong>${total.totalGoals}</strong></td><td></td></tr>`
  const dataRows=rows.map(({player,stats})=>`<tr class="clickable" data-player="${esc(player.id)}"><td><strong class="player-link">${esc(player.name)}</strong></td><td>${player.jersey_number ?? player.jerseyNumber ?? ''}</td><td>${stats.leagueApps}</td><td>${stats.cupApps}</td><td>${stats.leagueGoals}</td><td>${stats.cupGoals}</td><td><strong>${stats.totalGoals}</strong></td><td>${canEdit()?`<button class="edit-player" data-edit-player="${esc(player.id)}">Szerkeszt</button>`:''}</td></tr>`).join('')
  return totalRow+dataRows
}

function seasonPlayerRows(season) {
  const normalized=normalizeSeason(season)
  const details=playerMatches.filter(row=>playerMatchSeason(row)===normalized)
  const ids=new Set([...details.map(row=>playerMatchPlayerId(row)),...playerSeasons.filter(row=>normalizeSeason(row.season)===normalized).map(row=>row.player_id)].filter(Boolean))
  const selected=players.filter(player=>ids.has(player.id)).map(player=>{
    const own=details.filter(row=>playerMatchPlayerId(row)===player.id)
    const summary=playerStatsForSeason(player,season)
    return {player,played:summary.leagueApps+summary.cupApps,goals:summary.totalGoals,yellow:own.reduce((a,row)=>a+num(row.yellow_cards??row.yellowCards??row.stat1??0),0),yellowRed:own.reduce((a,row)=>a+num(row.yellow_red_cards??row.yellowRedCards??row.stat2??0),0),red:own.reduce((a,row)=>a+num(row.red_cards??row.redCards??row.stat3??0),0)}
  }).sort((a,b)=>b.played-a.played||b.goals-a.goals||a.player.name.localeCompare(b.player.name))
  if(!selected.length)return `<div class="empty"><strong>Nincs jatekos ehhez a szezonhoz</strong>A Jatekosok oldalon adj jatekos merkozest ehhez a szezonhoz.</div>`
  const playerRows=selected.map(row=>`<tr class="clickable" data-record-player="${esc(row.player.id)}"><td><strong class="player-link">${esc(row.player.name)}</strong></td><td>${row.played}</td><td>${row.goals}</td><td>${row.yellow}</td><td>${row.yellowRed}</td><td>${row.red}</td></tr>`).join('')
  return `<div class="table-wrap"><table class="player-season-totals"><thead><tr><th>Jatekos</th><th>Jatszott</th><th>Gol</th><th title="Yellow card">🟨</th><th title="One yellow and one red">🟨🟥</th><th title="Red card">🟥</th></tr></thead><tbody>${playerRows}</tbody></table></div>`
}

function dashboard() {
  const names = seasonNames()
  const selected = names.includes('2025/2026') ? '2025/2026' : names[0]
  return `<section class="hero"><div><h2>Szezon attekintese</h2><p class="muted">${matches.length} shared matches. ${canEdit() ? 'Editor mode is on.' : 'Your access is read-only.'}</p></div><div class="metric"><strong>${matches.length}</strong><span>recorded matches</span></div></section><section class="panel"><div class="section-head"><div><h2>Tabella</h2><p class="muted">Minden csapat, J / Gy / D / V, golok es pontok</p></div><div class="profile-actions">${canEdit() ? '<button class="primary" id="add-season">Uj szezon</button>' : ''}<select id="team-season">${names.map(name => `<option value="${esc(name)}" ${name === selected ? 'selected' : ''}>${esc(seasonLabel(name))}</option>`).join('')}</select></div></div><div id="team-table">${teamTable(selected)}</div><div class="season-record"><div class="section-head"><div><h2>Jatekos merkozesrekord</h2><p class="muted">A kiválasztott szezon játékosainak összesített adatai, játékosonként egy sorban</p></div><span class="role" id="season-record-count"></span></div><div id="season-player-record">${seasonPlayerRows(selected)}</div></div></section>`
}

function playersPage() {
  const names=seasonNames();
  return `<section class="panel"><div class="section-head"><div><h2>Jatekosok</h2><p class="muted">Valassz szezont, majd rendezd a jatekosokat statisztika szerint. Nincs osszesito sor.</p></div><div class="profile-actions"><select id="players-season"><option value="all" selected>Minden szezon</option>${names.map(name=>`<option value="${esc(name)}">${esc(seasonLabel(name))}</option>`).join('')}</select><select id="players-sort"><option value="apps">Legtobbet jatszott</option><option value="goals">Legtobb gol</option><option value="yellow">Legtobb sarga</option><option value="yellowRed">Legtobb sarga + piros</option><option value="red">Legtobb piros</option><option value="name">Nev szerint</option></select><span class="role" id="players-count">${players.length} jatekos</span>${canEdit()?'<button class="primary" id="add-player">Uj jatekos</button>':''}</div></div><div class="table-wrap"><table><thead><tr><th>Jatekos</th><th>Mez szam</th><th>Jatszott</th><th>Gol</th><th title="Yellow card">🟨</th><th title="One yellow and one red">🟨🟥</th><th title="Red card">🟥</th><th></th></tr></thead><tbody id="players-table-body"></tbody></table></div></section>`
}
function playerStatRows(season='all',sort='apps') {
  const filtered=playerMatches.filter(row=>season==='all'||normalizeSeason(row.season)===normalizeSeason(season))
  const ids=new Set([...filtered.map(row=>playerMatchPlayerId(row)),...playerSeasons.filter(row=>season==='all'||normalizeSeason(row.season)===normalizeSeason(season)).map(row=>row.player_id)].filter(Boolean))
  const source=season==='all'?players:players.filter(player=>ids.has(player.id))
  const rows=source.map(player=>{
    const summary=playerStatsForSeason(player,season)
    const detail=filtered.filter(row=>playerMatchPlayerId(row)===player.id)
    return {player,played:summary.leagueApps+summary.cupApps,goals:summary.totalGoals,yellow:detail.reduce((a,row)=>a+num(row.yellow_cards??row.yellowCards??row.stat1??0),0),yellowRed:detail.reduce((a,row)=>a+num(row.yellow_red_cards??row.yellowRedCards??row.stat2??0),0),red:detail.reduce((a,row)=>a+num(row.red_cards??row.redCards??row.stat3??0),0)}
  })
  rows.sort((a,b)=>sort==='name'?a.player.name.localeCompare(b.player.name):sort==='goals'?b.goals-a.goals||b.played-a.played:sort==='yellow'?b.yellow-a.yellow||b.played-a.played:sort==='yellowRed'?b.yellowRed-a.yellowRed||b.played-a.played:sort==='red'?b.red-a.red||b.played-b.played:b.played-a.played||b.goals-a.goals)
  return rows
}

function bindPlayersTable(season='all',sort='apps') {
  const rows=playerStatRows(season,sort),body=document.querySelector('#players-table-body')
  if(!body)return
  body.innerHTML=rows.map(x=>`<tr class="clickable" data-player="${esc(x.player.id)}"><td><strong class="player-link">${esc(x.player.name)}</strong></td><td>${x.player.jersey_number??x.player.jerseyNumber??''}</td><td>${x.played}</td><td>${x.goals}</td><td>${x.yellow}</td><td>${x.yellowRed}</td><td>${x.red}</td><td>${canEdit()?`<button class="edit-player" data-edit-player="${esc(x.player.id)}">Szerkeszt</button><button class="delete-player" data-delete-player="${esc(x.player.id)}">Torol</button>`:''}</td></tr>`).join('')||'<tr><td colspan="8" class="empty">Nincs jatekos ehhez a szezonhoz.</td></tr>'
  const count=document.querySelector('#players-count');if(count)count.textContent=`${rows.length} jatekos`
  body.querySelectorAll('.clickable').forEach(row=>row.addEventListener('click',event=>{if(!event.target.closest('button'))playerProfile(row.dataset.player)}))
  if(canEdit()){body.querySelectorAll('[data-edit-player]').forEach(button=>button.addEventListener('click',event=>{event.stopPropagation();editPlayer(players.find(player=>player.id===button.dataset.editPlayer))}));body.querySelectorAll('[data-delete-player]').forEach(button=>button.addEventListener('click',event=>{event.stopPropagation();deletePlayer(button.dataset.deletePlayer)}))}
}

function matchPopup(match){return `<dialog class="match-dialog" id="match-dialog"><form method="dialog" class="match-dialog-card"><div class="section-head"><div><span class="eyebrow">Merkozes adatlap</span><h2>${esc(match.opponent)}</h2><p class="muted">${esc(match.match_date||'')} · ${match.competition==='Cup'?'Kupa':'Bajnoksag'}</p></div><button class="close-dialog" value="cancel" aria-label="Bezár">×</button></div><div class="match-score"><strong>${esc(match.score||'vs')}</strong><span>Football Fanatics vs ${esc(match.opponent)}</span></div><div class="match-notes"><b>Golszerzok es megjegyzesek</b><p>${esc(match.notes||'Nincs tovabbi merkozesadat.')}</p></div><div class="dialog-actions">${canEdit()?`<button type="button" class="edit" data-popup-edit="${esc(match.id)}">Szerkeszt</button>`:''}<button class="secondary" value="cancel">Bezár</button></div></form></dialog>`}
function bindMatchPopups(){document.querySelectorAll('[data-match-detail]').forEach(button=>button.addEventListener('click',()=>{const match=matches.find(row=>String(row.id)===button.dataset.matchDetail);if(!match)return;document.querySelector('#match-dialog')?.remove();document.body.insertAdjacentHTML('beforeend',matchPopup(match));const d=document.querySelector('#match-dialog');d.showModal();d.querySelector('[data-popup-edit]')?.addEventListener('click',()=>{d.close();d.remove();editMatch(match)});d.addEventListener('close',()=>d.remove(),{once:true})}))}

function bindPlayerDeleteButtons(){document.querySelectorAll('[data-delete-player]').forEach(button=>button.addEventListener('click',event=>{event.stopPropagation();deletePlayer(button.dataset.deletePlayer)}))}
async function deletePlayer(id){const player=players.find(row=>row.id===id);if(!player)return;if(!confirm(`Biztosan torlod ${player.name} jatekost es a hozza tartozo merkozesadatait?`))return;const{error}=await supabase.from('players').delete().eq('id',id);if(error){alert(error.message);return}await load();showPage('players')}

function matchesTable(season) {
  const data = matches.filter(match => season === 'all' || matchSeason(match) === normalizeSeason(season))
  return `<div class="table-wrap"><table><thead><tr><th>Szezon</th><th>Datum</th><th>Ido</th><th>Ellenfel</th><th>Sorozat</th><th>Allas</th><th>Eredmeny</th>${canEdit()?'<th></th>':''}</tr></thead><tbody>${data.map(match=>`<tr><td>${esc(seasonLabel(matchSeason(match)))}</td><td>${esc(displayDate(match.match_date||match.date||match.matchDate))}</td><td>${esc(displayTime(match))}</td><td><button class="team-link" data-match-detail="${esc(match.id)}">${esc(match.opponent || matchAway(match) || matchHome(match))}</button></td><td>${match.competition==='League'?'Bajnoksag':'Kupa'}</td><td>${esc(match.score||'vs')}</td><td><span class="result ${resultClass(matchResult(match))}">${esc(matchResult(match))}</span></td>${canEdit()?`<td><button class="edit" data-match-edit="${esc(match.id)}">Szerkeszt</button></td>`:''}</tr>`).join('') || '<tr><td colspan="8" class="empty">Nincs merkozes ehhez a szezonhoz.</td></tr>'}</tbody></table></div>`
}
function matchesPage() {
  const names = seasonNames()
  const selected = names[0] || 'all'
  return `<section class="toolbar"><div><p class="muted"><span id="matches-count">${matches.filter(match => selected === 'all' || matchSeason(match) === selected).length}</span> shared matches</p><label class="season-filter"><span>Szezon</span><select id="matches-season"><option value="all">Minden szezon</option>${names.map(name=>`<option value="${esc(name)}" ${name===selected?'selected':''}>${esc(seasonLabel(name))}</option>`).join('')}</select></label></div>${canEdit()?'<button id="add-match" class="primary">Merkozes hozzaadasa</button>':''}</section><div id="matches-table">${matchesTable(selected)}</div>`
}

function teamRows(season) {
  const data = matches.filter(match => season === 'all' || matchSeason(match) === normalizeSeason(season))
  const grouped = new Map()
  data.forEach(match => {
    const opponent = String(match.opponent || (isOurTeam(matchHome(match)) ? matchAway(match) : matchHome(match)) || 'Ismeretlen ellenfel').trim()
    if (!grouped.has(opponent)) grouped.set(opponent, { team: opponent, played: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, matches: [] })
    const row = grouped.get(opponent)
    const result = matchResult(match)
    const goals = matchGoalsForAgainst(match)
    row.played += 1
    row[result.toLowerCase()] += 1
    row.gf += goals.gf
    row.ga += goals.ga
    row.matches.push(match)
  })
  return [...grouped.values()].map(row => ({ ...row, gd: row.gf - row.ga })).sort((a,b) => b.played-a.played || a.team.localeCompare(b.team))
}
function teamSummaryTable(season) {
  const rows = teamRows(season)
  return `<div class="table-wrap"><table class="team-summary-table"><thead><tr><th>Csapat</th><th>Meccs</th><th>Nyert</th><th>Döntetlen</th><th>Vesztett</th><th>RG</th><th>KG</th><th>GA</th></tr></thead><tbody>${rows.map(row=>`<tr><td><button class="team-link" data-team-detail="${esc(row.team)}">${esc(row.team)}</button></td><td>${row.played}</td><td>${row.w}</td><td>${row.d}</td><td>${row.l}</td><td>${row.gf}</td><td>${row.ga}</td><td>${row.gd > 0 ? '+' : ''}${row.gd}</td></tr>`).join('') || '<tr><td colspan="8" class="empty">Nincs csapat ehhez a szezonhoz.</td></tr>'}</tbody></table></div>`
}
function teamDetail(team, season) {
  const row = teamRows(season).find(item => item.team === team)
  if (!row) return '<div class="empty"><strong>Valassz egy csapatot</strong>A reszletes merkozesek itt jelennek meg.</div>'
  return `<section class="team-detail"><div class="section-head"><div><span class="eyebrow">Csapat adatlap</span><h2>${esc(row.team)}</h2><p class="muted">${row.played} merkozes, ${row.w} gyozelem, ${row.d} dontetlen, ${row.l} vereseg</p></div><span class="team-detail-record">${row.gf}-${row.ga} · ${row.gd > 0 ? '+' : ''}${row.gd} GA</span></div><div class="table-wrap"><table class="team-match-table"><thead><tr><th>Szezon</th><th>Datum</th><th>Ora</th><th>Hazai</th><th>Idegen</th><th>Eredmeny</th><th>Gol szerzo</th></tr></thead><tbody>${row.matches.sort((a,b)=>String(b.match_date||b.date||'').localeCompare(String(a.match_date||a.date||''))).map(match=>{const home=matchHome(match)||'Football Fanatics';const away=matchAway(match)||match.opponent||'Football Fanatics'; return `<tr><td>${esc(seasonLabel(matchSeason(match)))}</td><td>${esc(displayDate(match.match_date||match.date||match.matchDate))}</td><td>${esc(displayTime(match))}</td><td class="${isOurTeam(home)?'our-team':''}">${esc(home)}</td><td class="${isOurTeam(away)?'our-team':''}">${esc(away)}</td><td><span class="result ${resultClass(matchResult(match))}">${esc(match.score || matchResult(match))}</span></td><td class="scorers-cell">${esc(matchScorers(match) || '-')}</td></tr>`}).join('')}</tbody></table></div></section>`
}
function teamsPage() {
  const names = seasonNames()
  const selected = names[0] || 'all'
  return `<section class="hero"><div><h2>Csapatok</h2><p class="muted">Minden ellenfelunk, szezononkent osszesitve. Kattints egy csapatra a reszletes merkozesekhez.</p></div></section><section class="panel"><div class="section-head"><div><h2>Merkozes rekord</h2><p class="muted">Nyert, dontetlen, vesztett, rugott es kapott golok</p></div><label class="season-filter"><span>Szezon</span><select id="teams-season"><option value="all">Minden szezon</option>${names.map(name=>`<option value="${esc(name)}" ${name===selected?'selected':''}>${esc(seasonLabel(name))}</option>`).join('')}</select></label></div><div id="team-summary">${teamSummaryTable(selected)}</div><div id="team-detail">${selectedTeam ? teamDetail(selectedTeam, selected) : ''}</div></section>`
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

function bindMatchesPage() {
  const select = document.querySelector('#matches-season')
  const render = season => {
    const data = matches.filter(match => season === 'all' || matchSeason(match) === normalizeSeason(season))
    document.querySelector('#matches-count').textContent = data.length
    document.querySelector('#matches-table').innerHTML = matchesTable(season)
    bindMatchPopups()
    if (canEdit()) document.querySelectorAll('[data-match-edit]').forEach(button => button.addEventListener('click', () => editMatch(matches.find(match => String(match.id) === button.dataset.matchEdit))))
  }
  select?.addEventListener('change', event => render(event.target.value))
  render(select?.value || 'all')
}
function bindTeamsPage() {
  const select = document.querySelector('#teams-season')
  const render = season => {
    document.querySelector('#team-summary').innerHTML = teamSummaryTable(season)
    document.querySelector('#team-detail').innerHTML = selectedTeam ? teamDetail(selectedTeam, season) : ''
    document.querySelectorAll('[data-team-detail]').forEach(button => button.addEventListener('click', () => {
      selectedTeam = button.dataset.teamDetail
      document.querySelector('#team-detail').innerHTML = teamDetail(selectedTeam, season)
      document.querySelector('#team-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }))
  }
  select?.addEventListener('change', event => { selectedTeam = null; render(event.target.value) })
  render(select?.value || 'all')
}

function showPage(page) {
  document.querySelectorAll('[data-page]').forEach(button => button.classList.toggle('active', button.dataset.page === page))
  document.querySelector('#page-title').textContent = page === 'dashboard' ? 'Tabella' : page === 'players' ? 'Jatekosok' : page === 'teams' ? 'Csapatok' : 'Merkozesek'
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
    bindPlayersTable('all','apps')
    document.querySelector('#players-season').addEventListener('change',event=>bindPlayersTable(event.target.value,document.querySelector('#players-sort').value))
    document.querySelector('#players-sort').addEventListener('change',event=>bindPlayersTable(document.querySelector('#players-season').value,event.target.value))
    if (canEdit()) {
      document.querySelector('#add-player').addEventListener('click', addPlayer)
      bindPlayerDeleteButtons()
    }
  } else if (page === 'teams') {
    content.innerHTML = teamsPage()
    bindTeamsPage()
  } else {
    content.innerHTML = matchesPage()
    bindMatchesPage()
    if (canEdit()) document.querySelector('#add-match')?.addEventListener('click', () => editMatch())
  }
}

function bindSeasonRecord() {
  const rows = document.querySelectorAll('[data-record-player]')
  const counter = document.querySelector('#season-record-count')
  if (counter) counter.textContent = `${rows.length} sor`
  rows.forEach(row => row.addEventListener('click', () => playerProfile(row.dataset.recordPlayer)))
}

function openAdminLogin(){
  dialog('Admin bejelentkezes','<input id="admin-email" type="email" placeholder="Email" required><input id="admin-password" type="password" placeholder="Jelszo" required>',async element=>{
    const {error}=await supabase.auth.signInWithPassword({email:element.querySelector('#admin-email').value,password:element.querySelector('#admin-password').value})
    if(error){alert(error.message);return}
    element.close();element.remove()
  })
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
async function addPlayerMatch(player, existingSeasons) { const options = existingSeasons.length ? existingSeasons : seasonNames(); dialog('Merkozes hozzaadasa', `<select id="season">${options.map(name => `<option>${esc(name)}</option>`).join('') || '<option>2026/2027</option>'}</select><select id="comp"><option value="League">Bajnoksag</option><option value="Cup">Kupa</option></select><input id="date" type="date"><input id="time" type="time"><input id="opp" placeholder="Ellenfel" required><input id="score" placeholder="Allas"><select id="result"><option>W</option><option>D</option><option>L</option><option>U</option></select><label>Jatszott<input id="played" type="number" min="0" value="1"></label><label>Gol<input id="goals" type="number" min="0" value="0"></label><label>🟨<input id="y" type="number" min="0" value="0"></label><label>🟨🟥<input id="yr" type="number" min="0" value="0"></label><label>🟥<input id="r" type="number" min="0" value="0"></label>`, async element => { const { error } = await supabase.from('player_match_stats').insert({ player_id:player.id, season:normalizeSeason(element.querySelector('#season').value), competition:element.querySelector('#comp').value, match_date:element.querySelector('#date').value || null, match_time:element.querySelector('#time').value || null, opponent:element.querySelector('#opp').value, score:element.querySelector('#score').value, result:element.querySelector('#result').value, played:+element.querySelector('#played').value, goals:+element.querySelector('#goals').value, yellow_cards:+element.querySelector('#y').value, yellow_red_cards:+element.querySelector('#yr').value, red_cards:+element.querySelector('#r').value }); if (error) return alert(error.message); element.close(); element.remove(); await load(); playerProfile(player.id) }) }
async function editPlayerMatch(row) { dialog('Jatekos merkozes szerkesztese', `<input id="opp" value="${esc(row.opponent)}"><input id="score" value="${esc(row.score || '')}" placeholder="Allas"><select id="result"><option ${row.result === 'W' ? 'selected' : ''}>W</option><option ${row.result === 'D' ? 'selected' : ''}>D</option><option ${row.result === 'L' ? 'selected' : ''}>L</option><option ${row.result === 'U' ? 'selected' : ''}>U</option></select><label>Jatszott<input id="played" type="number" min="0" value="${row.played ?? 1}"></label><label>Gol<input id="goals" type="number" min="0" value="${row.goals ?? 0}"></label><label>🟨<input id="y" type="number" min="0" value="${row.yellow_cards ?? row.yellowCards ?? row.stat1 ?? 0}"></label><label>🟨🟥<input id="yr" type="number" min="0" value="${row.yellow_red_cards ?? row.yellowRedCards ?? row.stat2 ?? 0}"></label><label>🟥<input id="r" type="number" min="0" value="${row.red_cards ?? row.redCards ?? row.stat3 ?? 0}"></label>`, async element => { const { error } = await supabase.from('player_match_stats').update({ opponent:element.querySelector('#opp').value, score:element.querySelector('#score').value, result:element.querySelector('#result').value, played:+element.querySelector('#played').value, goals:+element.querySelector('#goals').value, yellow_cards:+element.querySelector('#y').value, yellow_red_cards:+element.querySelector('#yr').value, red_cards:+element.querySelector('#r').value }).eq('id', row.id); if (error) return alert(error.message); element.close(); element.remove(); await load(); playerProfile(playerMatchPlayerId(row)) }) }
async function editMatch(match = {}) { const edit = Boolean(match.id); dialog(edit ? 'Merkozes szerkesztese' : 'Merkozes hozzaadasa', `<input id="date" type="date" value="${match.match_date || ''}" required><input id="time" type="time" value="${match.match_time || match.time || ''}"><input id="opp" value="${esc(match.opponent || '')}" placeholder="Ellenfel" required><select id="comp"><option value="League" ${match.competition === 'League' ? 'selected' : ''}>Bajnoksag</option><option value="Cup" ${match.competition === 'Cup' ? 'selected' : ''}>Kupa</option></select><input id="score" value="${esc(match.score || '')}" placeholder="Allas"><select id="result"><option ${match.result === 'W' ? 'selected' : ''}>W</option><option ${match.result === 'D' ? 'selected' : ''}>D</option><option ${match.result === 'L' ? 'selected' : ''}>L</option><option ${!match.result ? 'selected' : ''}>U</option></select><textarea id="notes" placeholder="Golszerzok es megjegyzesek">${esc(match.notes || '')}</textarea>`, async element => { const payload = { match_date:element.querySelector('#date').value, match_time:element.querySelector('#time').value || null, opponent:element.querySelector('#opp').value, competition:element.querySelector('#comp').value, score:element.querySelector('#score').value, result:element.querySelector('#result').value, notes:element.querySelector('#notes').value }; const request = edit ? supabase.from('matches').update(payload).eq('id', match.id) : supabase.from('matches').insert(payload); const { error } = await request; if (error) return alert(error.message); element.close(); element.remove(); await load(); showPage('matches') }) }

async function boot() { const { data } = await supabase.auth.getSession(); session = data.session; if (session) { const { data: userProfile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single(); profile = userProfile || { role:'viewer' } } else { profile = { role:'viewer' } } await load(); renderShell() }
supabase.auth.onAuthStateChange((_event, next) => { session = next; boot() })
boot()
