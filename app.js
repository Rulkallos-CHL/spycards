// app.js - frontend logic with game play, bot, and realtime sync
import { supabase } from './supabase.js';

const app = document.getElementById('app');
let state = 'login'; // login, title, decks, decksModify, store, playPrep, play
let user = null;
let profile = null;
let currentMatch = null;
let gameState = null; // JSON game state synchronized to game_states table
let ads = ['/ads/ad1.png','/ads/ad2.png','/ads/ad3.png'];
let adIndex = 0, adInterval = null;
let realtimeSubscription = null;

async function startup(){
  const { data } = await supabase.auth.getUser();
  if(data.user){
    user = data.user; await loadProfile(); state = 'title';
  } else state = 'login';
  render(); startAdCarousel();
  supabase.auth.onAuthStateChange(async (event, session)=>{
    if(session?.user){ user = session.user; await loadProfile(); state='title'; render(); }
    else { user=null; profile=null; state='login'; render(); }
  });
}

async function loadProfile(){
  if(!user) return;
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  profile = data;
}

function startAdCarousel(){
  if(adInterval) clearInterval(adInterval);
  adInterval = setInterval(()=>{
    adIndex = (adIndex+1)%ads.length;
    const img = document.querySelector('.adimg'); if(img) img.src = ads[adIndex];
  },5000);
}

/* ---------- Global keyboard handlers (Return button / ESC) ---------- */
function setupGlobalKeys(){
  window.onkeydown = (e)=>{
    if(e.key === 'Escape'){
      handleReturn();
    }
  };
}
setupGlobalKeys();

async function handleReturn(){
  // If editing deck, ask to save (mirrors earlier behavior)
  if(state === 'decksModify'){
    showModal(`
      <h3>Exit deck editor?</h3>
      <p>Save changes to deck "${currentEditDeck?.name}"?</p>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button id="no-save" class="btn" style="background:transparent;border:1px solid rgba(255,255,255,0.06)">No</button>
        <button id="yes-save" class="btn">Yes, Save</button>
      </div>
    `);
    document.getElementById('no-save').onclick = ()=>{ closeModal(); state='decks'; render(); };
    document.getElementById('yes-save').onclick = async ()=>{
      await saveDeckChanges(); closeModal(); state='decks'; render();
    };
    return;
  }
  // If playing, confirm leaving
  if(state === 'play'){
    showModal(`
      <h3>Return to Title?</h3>
      <p>If you return, the match will be ended (for demo).</p>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button id="resume" class="btn" style="background:transparent;border:1px solid rgba(255,255,255,0.06)">Resume</button>
        <button id="leave" class="btn">Return</button>
      </div>
    `);
    document.getElementById('resume').onclick = ()=>{ closeModal(); };
    document.getElementById('leave').onclick = async ()=>{
      await endMatchEarly(); closeModal(); state='title'; render();
    };
    return;
  }
  // Default: return to title
  state='title'; render();
}

/* ---------- UI rendering ---------- */
function render(){
  app.innerHTML = '';
  const showTop = ['decks','store','playPrep','title','decksModify','play'].includes(state);
  if(showTop){
    const top = document.createElement('div'); top.className='topbar';
    const left = document.createElement('div'); left.className='left';
    left.innerHTML = `<button class="return" id="btn-return">Return</button><div class="brand">SpyCards</div>`;
    const center = document.createElement('div'); center.className='center';
    center.innerHTML = `<div class="small">Game</div>`;
    const right = document.createElement('div'); right.className='right';
    right.innerHTML = `<div class="small">${user?user.email:''}</div><div class="coin">${profile?.spy_coin||0} SPY</div>`;
    top.appendChild(left); top.appendChild(center); top.appendChild(right);
    app.appendChild(top);
    document.getElementById('btn-return').onclick = handleReturn;
  }

  const main = document.createElement('div'); main.className='main';
  if(state==='login') renderLogin(main);
  else if(state==='title') renderTitle(main);
  else if(state==='decks') renderDecks(main);
  else if(state==='decksModify') renderDecksModify(main);
  else if(state==='store') renderStore(main);
  else if(state==='playPrep') renderPlayPrep(main);
  else if(state==='play') renderPlay(main);
  app.appendChild(main);
}

/* ---------- Login ---------- */
function renderLogin(container){
  const box = document.createElement('div'); box.className='loginbox';
  box.innerHTML = `
    <h2>Login</h2>
    <input id="email" class="input" placeholder="Email" />
    <input id="password" type="password" class="input" placeholder="Password" />
    <div style="display:flex;gap:8px">
      <button id="btn-login" class="btn">Login</button>
      <button id="btn-register" class="btn" style="background:#2dd4bf">Register</button>
    </div>
    <div class="small" style="margin-top:8px">This demo uses Supabase Auth. Passwords are sent to Supabase SDK (uses HTTPS).</div>
  `;
  container.appendChild(box);
  box.querySelector('#btn-login').onclick = async ()=>{
    const email = box.querySelector('#email').value, password = box.querySelector('#password').value;
    if(!email||!password) return alert('enter credentials');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if(error) alert(error.message);
  };
  box.querySelector('#btn-register').onclick = async ()=>{
    const email = box.querySelector('#email').value, password = box.querySelector('#password').value;
    if(!email||!password) return alert('enter credentials');
    const { data, error } = await supabase.auth.signUp({ email, password });
    if(error) return alert(error.message);
    // Create an initial profiles row (RLS will likely require)
    if(data?.user){
      await supabase.from('profiles').insert({ id: data.user.id, display_name: email.split('@')[0], spy_coin: 50 });
      alert('Registered. Use the link in email (if required) then login.');
    } else alert('Registered. Please login.');
  };
}

/* ---------- Title ---------- */
function renderTitle(container){
  const left = document.createElement('div'); left.className='leftcol';
  const startBtn = document.createElement('button'); startBtn.className='menu-button'; startBtn.textContent='Start A Game';
  const decksBtn = document.createElement('button'); decksBtn.className='menu-button'; decksBtn.textContent='Decks';
  const storeBtn = document.createElement('button'); storeBtn.className='menu-button'; storeBtn.textContent='Store';
  const logoutBtn = document.createElement('button'); logoutBtn.className='menu-button'; logoutBtn.textContent='Log Out';
  left.appendChild(startBtn); left.appendChild(decksBtn); left.appendChild(storeBtn); left.appendChild(logoutBtn);
  startBtn.onclick = ()=>{ state='playPrep'; render(); };
  decksBtn.onclick = ()=>{ state='decks'; render(); };
  storeBtn.onclick = ()=>{ state='store'; render(); };
  logoutBtn.onclick = ()=>{ showLogoutConfirm(); };

  const right = document.createElement('div'); right.className='rightcol';
  const adimg = document.createElement('img'); adimg.className='adimg'; adimg.src = ads[adIndex] || '';
  right.appendChild(adimg);
  container.appendChild(left); container.appendChild(right);
}

/* ---------- Decks & decksModify (unchanged behavior but kept) ---------- */
let currentEditDeck = null;
let deckWorkingCopy = { cards: [] };

function renderDecks(container){
  const left = document.createElement('div'); left.className='leftcol';
  left.innerHTML = `<h3>Your Decks</h3><div id="decks-grid" style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px"></div>`;
  const grid = left.querySelector('#decks-grid');
  supabase.from('decks').select('*').eq('owner', user.id).then(res=>{
    const data = res.data || [];
    if(data.length===0){
      const p = document.createElement('div'); p.className='small'; p.textContent='No decks yet.';
      left.appendChild(p);
    } else {
      data.forEach(d=>{
        const card = document.createElement('div'); card.className='card';
        card.innerHTML = `<div style="font-weight:700">${d.name}</div><div class="small">${d.description||''}</div>`;
        card.onclick = ()=> openDeckModify(d.id);
        grid.appendChild(card);
      });
    }
  });
  const right = document.createElement('div'); right.className='rightcol'; right.innerHTML = `<img class="adimg" src="${ads[adIndex]||''}" />`;
  container.appendChild(left); container.appendChild(right);
}

async function openDeckModify(deckId){
  const { data } = await supabase.from('decks').select('*').eq('id', deckId).single();
  currentEditDeck = data;
  // load owned cards
  const owned = (await supabase.from('cards').select('*').eq('owner', user.id)).data || [];
  const inDeckRows = (await supabase.from('deck_cards').select('*').eq('deck_id', deckId)).data || [];
  deckWorkingCopy.cards = inDeckRows.map(r => ({ card_id: r.card_id, qty: r.qty }));
  window.ownedCards = owned;
  state='decksModify'; render();
}

function renderDecksModify(container){
  const wrapper = document.createElement('div'); wrapper.className='leftcol';
  wrapper.style.flexDirection='column'; wrapper.style.padding='0';
  const header = document.createElement('div'); header.style.padding='12px'; header.innerHTML = `<h3>Edit Deck: ${currentEditDeck?.name||''}</h3>`;
  wrapper.appendChild(header);
  const content = document.createElement('div'); content.className='decks-modify'; content.style.padding='12px';

  const left = document.createElement('div'); left.className='left-cards';
  const grid = document.createElement('div'); grid.className='grid';
  (window.ownedCards||[]).forEach(c=>{
    const el = document.createElement('div'); el.className='card';
    el.innerHTML = `<div style="font-weight:700">${c.name}</div><div class="small">Owned: ${c.qty_owned||0}</div>`;
    el.onclick = ()=>{
      const existing = deckWorkingCopy.cards.find(x=>x.card_id===c.id);
      if(existing) existing.qty += 1; else deckWorkingCopy.cards.push({ card_id: c.id, qty: 1 });
      render();
    };
    grid.appendChild(el);
  });
  left.appendChild(grid);

  const right = document.createElement('div'); right.className='right-deck';
  right.innerHTML = '<h4>In Deck</h4>';
  const list = document.createElement('div');
  deckWorkingCopy.cards.forEach(item=>{
    const cardInfo = (window.ownedCards||[]).find(x=>x.id===item.card_id) || { name: 'Unknown' };
    const row = document.createElement('div'); row.style.display='flex'; row.style.justifyContent='space-between'; row.style.marginBottom='6px';
    row.innerHTML = `<div>${cardInfo.name} x${item.qty}</div><div><button class="btn" style="padding:4px 8px">-</button><button class="btn" style="padding:4px 8px;margin-left:6px">+</button></div>`;
    row.querySelectorAll('button')[0].onclick = ()=>{ item.qty = Math.max(0, item.qty-1); if(item.qty===0) deckWorkingCopy.cards = deckWorkingCopy.cards.filter(x=>x!==item); render(); };
    row.querySelectorAll('button')[1].onclick = ()=>{ item.qty+=1; render(); };
    list.appendChild(row);
  });
  right.appendChild(list);
  content.appendChild(left); content.appendChild(right);
  wrapper.appendChild(content); container.appendChild(wrapper);

  // ESC key handled globally triggers save prompt above
}

async function saveDeckChanges(){
  if(!currentEditDeck) return;
  await supabase.from('deck_cards').delete().eq('deck_id', currentEditDeck.id);
  if(deckWorkingCopy.cards.length>0){
    const inserts = deckWorkingCopy.cards.map(c=>({ deck_id: currentEditDeck.id, card_id: c.card_id, qty: c.qty }));
    await supabase.from('deck_cards').insert(inserts);
  }
}

/* ---------- Store ---------- */
function renderStore(container){
  const left = document.createElement('div'); left.className='leftcol';
  left.innerHTML = `<h3>Store</h3><div id="store-grid" class="store-grid"></div>`;
  const gridWrap = left.querySelector('#store-grid');
  supabase.from('store_items').select('*').then(res=>{
    (res.data||[]).forEach(item=>{
      const el = document.createElement('div'); el.className='card';
      el.innerHTML = `<div style="font-weight:700">${item.name}</div><div class="small">${item.description||''}</div><div style="margin-top:8px;color:var(--muted)">${item.price} SPY</div><button class="btn" style="margin-top:8px">Buy</button>`;
      el.querySelector('button').onclick = ()=> showStoreDetail(item);
      gridWrap.appendChild(el);
    });
  });
  const right = document.createElement('div'); right.className='rightcol'; right.innerHTML = `<img class="adimg" src="${ads[adIndex]||''}" />`;
  container.appendChild(left); container.appendChild(right);
}

function showStoreDetail(item){
  showModal(`
    <h3>${item.name}</h3>
    <p>${item.description || ''}</p>
    <p>Price: ${item.price} SPY</p>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button id="buyCancel" class="btn" style="background:transparent;border:1px solid rgba(255,255,255,0.06)">Cancel</button>
      <button id="buyOk" class="btn">Buy</button>
    </div>
  `);
  document.getElementById('buyCancel').onclick = ()=> closeModal();
  document.getElementById('buyOk').onclick = async ()=>{
    const prof = (await supabase.from('profiles').select('*').eq('id', user.id).single()).data;
    if((prof.spy_coin||0) < item.price){ alert('Not enough SPY-Coin'); return; }
    // In production, do this via server function for atomic safety
    await supabase.from('profiles').update({ spy_coin: (prof.spy_coin||0)-item.price }).eq('id', user.id);
    await supabase.from('purchases').insert({ user_id: user.id, item_id: item.id, price: item.price });
    alert('Purchase complete.');
    closeModal(); await loadProfile(); render();
  };
}

/* ---------- Play Prep: Generate / Join / Match ---------- */
function renderPlayPrep(container){
  const left = document.createElement('div'); left.className='leftcol';
  left.innerHTML = `<h3>Play — Prepare</h3>`;
  const btnMatch = document.createElement('button'); btnMatch.className='menu-button'; btnMatch.textContent='Match a Match';
  const btnGen = document.createElement('button'); btnGen.className='menu-button'; btnGen.textContent='Generate Play Code';
  const btnJoin = document.createElement('button'); btnJoin.className='menu-button'; btnJoin.textContent='Join by Play Code';
  const txt = document.createElement('input'); txt.className='input'; txt.placeholder='5-digit code';
  left.appendChild(btnMatch); left.appendChild(btnGen); left.appendChild(txt); left.appendChild(btnJoin);

  btnGen.onclick = async ()=>{
    // Server-side generation recommended. Demo local: call Edge function or create match row with play_code
    const code = Math.floor(10000 + Math.random()*90000).toString();
    const { data } = await supabase.from('matches').insert({ host_user: user.id, play_code: code, status: 'waiting' }).select().single();
    alert('Play code: ' + code);
    // subscribe to match changes
    subscribeToMatch(data.id);
    currentMatch = data;
    state='play'; initLocalGameSessionAsHost(data.id, true);
    render();
  };
  btnJoin.onclick = async ()=>{
    const code = txt.value.trim(); if(!/^\d{5}$/.test(code)) return alert('Enter a 5-digit code');
    const { data: match } = await supabase.from('matches').select('*').eq('play_code', code).eq('status','waiting').limit(1).single();
    if(!match) return alert('No matching public game found.');
    // Join (production: server-side join to avoid race)
    await supabase.from('matches').update({ guest_user: user.id, status: 'started' }).eq('id', match.id);
    currentMatch = { ...match, guest_user: user.id, status: 'started' };
    subscribeToMatch(match.id);
    state='play'; await initLocalGameSessionAsGuest(match.id); render();
  };
  btnMatch.onclick = async ()=>{
    // Mark available; server-side pairing preferred. Here we set client state and wait for match
    await supabase.from('profiles').update({ client_state: 'available' }).eq('id', user.id);
    showMatchingTimer();
  };

  const right = document.createElement('div'); right.className='rightcol'; right.innerHTML = `<p class="small">Use Generate Play Code to host a quick public match, or Match a Match to enter the matchmaking queue (demo simple).</p>`;
  container.appendChild(left); container.appendChild(right);
}

/* ---------- Play (game) ---------- */
/*
  Game container is 5 (width) x 3 (height).
  - Top row is opponent (row 0), middle row reserved (row 1), bottom row is player (row 2).
  - Front line = column index 1 (second column). front is single slot occupied or empty.
  - Units: { id, owner, name, atk, hp, maxHp, cost, ready (bool), readyTurns (int), pos: {row,col} }
  - Both players: profile data (id), HQ hp = 20, deck (card counts), hand (max unlimited for demo)
  - K (current energy) resets to C at start of player's turn. first player gains 1 K and 1 C at game start.
  - C caps at 12.
*/
function renderPlay(container){
  const left = document.createElement('div'); left.className='leftcol';
  left.innerHTML = `<h3>Match</h3><div id="game-area" class="game-container"></div>`;
  container.appendChild(left);
  const right = document.createElement('div'); right.className='rightcol';
  right.innerHTML = `<div id="sidepanel"></div>`;
  container.appendChild(right);

  const gameArea = left.querySelector('#game-area');
  if(!gameState) {
    gameArea.innerHTML = `<div class="small">Waiting for match initialization...</div>`;
    // If we are host, initialize game state
    if(currentMatch && currentMatch.host_user === user.id){
      initLocalGameState(currentMatch.id, currentMatch.host_user, currentMatch.guest_user).catch(console.error);
    }
    return;
  }

  // Top status bar
  const statusBar = document.createElement('div'); statusBar.innerHTML = `<div class="small">Turn: ${gameState.turnNumber} — ${gameState.whoseTurn === user.id ? 'Your turn' : 'Opponent turn'}</div>`;
  gameArea.appendChild(statusBar);

  // Board (3 rows x 5 cols)
  const board = document.createElement('div'); board.className='board';
  for(let r=0;r<3;r++){
    const row = document.createElement('div'); row.className='row';
    for(let c=0;c<5;c++){
      const cell = document.createElement('div'); cell.className='cell';
      const cellUnits = unitsAtPos(r,c);
      if(r===0 && c===2){ // show opponent HQ
        cell.innerHTML = `<div class="small">Opponent HQ</div><div class="unit">HP: ${gameState.players.opponent.hq}</div>`;
      } else if(r===2 && c===2){ // player HQ center cell
        cell.innerHTML = `<div class="small">Your HQ</div><div class="unit">HP: ${gameState.players.you.hq}</div>`;
      } else {
        if(cellUnits.length){
          cellUnits.forEach(u=>{
            const div = document.createElement('div'); div.className='unit';
            div.innerHTML = `<div style="font-weight:700">${u.name}</div><div class="small">ATK:${u.atk} HP:${u.hp}/${u.maxHp}</div><div class="small">${u.ready ? 'Ready' : 'Waiting'}</div>`;
            row.appendChild(div);
          });
          // skip appending default cell content
          cell.innerHTML = '';
        } else {
          cell.innerHTML = '&nbsp;';
        }
      }
      row.appendChild(cell);
    }
    board.appendChild(row);
  }
  gameArea.appendChild(board);

  // Side panel: hand, actions
  const side = right.querySelector('#sidepanel');
  side.innerHTML = `<div class="small">Hand (${gameState.players.you.hand.length})</div>`;
  const handDiv = document.createElement('div'); handDiv.style.display='grid'; handDiv.style.gridTemplateColumns='repeat(2,1fr)'; handDiv.style.gap='6px';
  gameState.players.you.hand.forEach((card, idx)=>{
    const cd = document.createElement('div'); cd.className='card';
    cd.innerHTML = `<div style="font-weight:700">${card.name}</div><div class="small">Cost: ${card.cost}</div><button data-idx="${idx}" class="btn">Play</button>`;
    cd.querySelector('button').onclick = ()=> playCardFromHand(idx);
    handDiv.appendChild(cd);
  });
  side.appendChild(handDiv);

  const controls = document.createElement('div'); controls.className='controls';
  const btnMove = document.createElement('button'); btnMove.className='btn'; btnMove.textContent='Move to Front';
  const btnAttackFront = document.createElement('button'); btnAttackFront.className='btn'; btnAttackFront.textContent='Attack Front';
  const btnAttackHQ = document.createElement('button'); btnAttackHQ.className='btn'; btnAttackHQ.textContent='Attack HQ';
  const btnEnd = document.createElement('button'); btnEnd.className='btn'; btnEnd.textContent='End Turn';
  controls.appendChild(btnMove); controls.appendChild(btnAttackFront); controls.appendChild(btnAttackHQ); controls.appendChild(btnEnd);
  side.appendChild(controls);

  btnMove.onclick = moveToFront;
  btnAttackFront.onclick = attackFront;
  btnAttackHQ.onclick = attackHQ;
  btnEnd.onclick = endTurn;

  // Show K / C
  const resources = document.createElement('div'); resources.style.marginTop='12px';
  resources.innerHTML = `<div class="small">K: ${gameState.players.you.K} / C: ${gameState.players.you.C}</div>`;
  side.appendChild(resources);

  // If it's opponent (bot), allow bot to act
  if(gameState.players.opponent.isBot && gameState.whoseTurn === gameState.players.opponent.id){
    setTimeout(()=> runBotTurn(), 400);
  }
}

/* ---------- Game helpers ---------- */
function unitsAtPos(row,col){
  const units = (gameState?.units || []);
  return units.filter(u => u.pos.row === row && u.pos.col === col);
}

async function initLocalGameSessionAsHost(matchId, hostIsLocal=false){
  // when host created match, wait for guest to join; for demo, if no guest, offer a bot
  currentMatch = { id: matchId };
  // subscribe to match & gamestate
  subscribeToMatch(matchId);
  // Wait for guest or create bot opponent for demo after short timeout
  const { data } = await supabase.from('matches').select('*').eq('id', matchId).single();
  if(!data.guest_user){
    // create a bot opponent entry in game_state directly
    // initialize game state with bot as opponent
    await initLocalGameState(matchId, user.id, null, true);
  } else {
    // both players present
    await initLocalGameState(matchId, data.host_user, data.guest_user, false);
  }
}

async function initLocalGameSessionAsGuest(matchId){
  currentMatch = { id: matchId };
  subscribeToMatch(matchId);
  // Load gamestate (host should create it)
  const { data } = await supabase.from('game_states').select('*').eq('match_id', matchId).single();
  if(data) {
    gameState = data.state;
    render();
  } else {
    // wait a bit for host to create game_state
    let tries=0;
    while(tries<6){
      await new Promise(r=>setTimeout(r,1000));
      const res = await supabase.from('game_states').select('*').eq('match_id', matchId).single();
      if(res.data){ gameState = res.data.state; render(); break; }
      tries++;
    }
  }
}

async function initLocalGameState(matchId, hostUserId, guestUserId=null, useBot=false){
  // Build initial game state JSON:
  // players: you & opponent mapping (you: map to local user id)
  const youId = user.id;
  const opponentId = useBot ? 'BOT' : (guestUserId && guestUserId !== youId ? guestUserId : (hostUserId !== youId ? hostUserId : guestUserId));
  // Starter decks: for demo, assume starter deck exists; we'll just set deck counters and sample card description
  const starterCard = { name: 'Soldier', atk:1, hp:2, maxHp:2, cost:1 };
  // Helper to draw n cards from deck: for demo store counts only
  const initial = {
    match_id: matchId,
    turnNumber: 1,
    whoseTurn: hostUserId || youId, // host starts
    players: {
      you: { id: youId, hq:20, deckCount:40, hand:[], K:0, C:0, isBot:false },
      opponent: { id: opponentId || 'BOT', hq:20, deckCount:40, hand:[], K:0, C:0, isBot: useBot }
    },
    units: [], // unit objects
    front: { owner: null, occupantId: null }, // front control
  };
  // Draw 5 cards each
  for(let i=0;i<5;i++){
    initial.players.you.hand.push({ ...starterCard });
    initial.players.opponent.hand.push({ ...starterCard });
  }
  // First player (host) gains 1 K and 1 C immediately
  initial.players.you.K = 0; initial.players.you.C = 0;
  // If host is you, update you
  if(initial.whoseTurn === youId){
    initial.players.you.C = Math.min(12, initial.players.you.C + 1);
    initial.players.you.K = initial.players.you.C;
  } else {
    initial.players.opponent.C = Math.min(12, initial.players.opponent.C + 1);
    initial.players.opponent.K = initial.players.opponent.C;
  }

  // If opponent is bot, set isBot true on opponent
  if(useBot) initial.players.opponent.isBot = true;

  // Save to game_states table (upsert)
  const payload = { match_id: matchId, state: initial };
  const { error } = await supabase.from('game_states').upsert({ match_id: matchId, state: initial }).select().single();
  if(error) console.error('Failed to create game state', error);
  else {
    gameState = initial;
    currentMatch = { id: matchId };
    render();
  }
}

function localUnitId(){ return 'u_' + Math.random().toString(36).slice(2,9); }

async function persistGameState(){
  if(!currentMatch || !gameState) return;
  await supabase.from('game_states').update({ state: gameState, updated_at: new Date() }).eq('match_id', currentMatch.id);
}

/* ---------- Player Actions (Play / Move / Attack / End) ---------- */

async function playCardFromHand(handIndex){
  if(gameState.whoseTurn !== user.id) return alert('Not your turn');
  const card = gameState.players.you.hand[handIndex];
  if(!card) return;
  if(gameState.players.you.K < card.cost) return alert('Not enough K');
  // deduct K
  gameState.players.you.K -= card.cost;
  // create unit and place into reserve area (player row = 2). choose a pos: reserve columns = [3,4]
  const unit = {
    id: localUnitId(),
    owner: user.id,
    name: card.name,
    atk: card.atk,
    hp: card.hp,
    maxHp: card.maxHp || card.hp,
    cost: card.cost,
    ready: false,
    readyTurns: 1, // must wait one turn
    pos: { row: 2, col: 4 } // spawn at far-right reserve for demo
  };
  gameState.units.push(unit);
  // remove card instance from hand and reduce deck count
  gameState.players.you.hand.splice(handIndex,1);
  gameState.players.you.deckCount = Math.max(0, gameState.players.you.deckCount - 1);
  await persistGameState(); render();
}

async function moveToFront(){
  if(gameState.whoseTurn !== user.id) return alert('Not your turn');
  // find any ready unit of you in reserve (not front)
  const readyUnits = gameState.units.filter(u => u.owner === user.id && u.ready && !(u.pos.row===1 && u.pos.col===1));
  if(readyUnits.length === 0) return alert('No ready units to move.');
  // If front occupied, cannot move
  if(gameState.front.owner && gameState.front.owner !== user.id) return alert('Front is occupied by opponent.');
  // Move the first ready unit to front pos {row:1,col:1} and set front.owner
  const u = readyUnits[0];
  u.pos = { row: 1, col: 1 };
  gameState.front.owner = user.id;
  gameState.front.occupantId = u.id;
  await persistGameState(); render();
}

async function attackFront(){
  if(gameState.whoseTurn !== user.id) return alert('Not your turn');
  if(!gameState.front.occupantId) return alert('No unit at front to attack.');
  // find front unit and if it belongs to opponent, attempt to attack with any ready unit
  const frontUnit = gameState.units.find(u => u.id === gameState.front.occupantId);
  if(!frontUnit) { gameState.front.owner = null; gameState.front.occupantId = null; await persistGameState(); return; }
  if(frontUnit.owner === user.id){
    // attack opponent HQ by front occupant? provide separate action
    return alert('You already occupy front; try Attack HQ instead.');
  }
  // find a ready attacker owned by you
  const attacker = gameState.units.find(u => u.owner === user.id && u.ready);
  if(!attacker) return alert('No ready attacker to contest front.');
  // Exchange damage
  frontUnit.hp -= attacker.atk;
  attacker.hp -= frontUnit.atk;
  // Remove dead units
  gameState.units = gameState.units.filter(u => u.hp > 0);
  // If front unit died, clear front (owner remains null) - attacker does not auto-occupy for fairness
  if(frontUnit.hp <= 0) {
    gameState.front.owner = null;
    gameState.front.occupantId = null;
  } else {
    // persist occupantId to current existing (still same id)
    const existing = gameState.units.find(u => u.id === frontUnit.id);
    if(!existing){ gameState.front.owner = null; gameState.front.occupantId = null; }
  }
  await persistGameState(); render();
}

async function attackHQ(){
  if(gameState.whoseTurn !== user.id) return alert('Not your turn');
  // You can attack HQ only if you control front with a unit
  if(gameState.front.owner !== user.id) return alert('You must control front to attack HQ.');
  const frontUnit = gameState.units.find(u => u.id === gameState.front.occupantId);
  if(!frontUnit) return alert('No unit at front to attack HQ.');
  // Deal damage to opponent HQ by frontUnit ATK
  if(gameState.players.you.id === user.id){
    gameState.players.opponent.hq -= frontUnit.atk;
  } else {
    gameState.players.you.hq -= frontUnit.atk;
  }
  // Check HQ death
  await checkForVictory();
  await persistGameState(); render();
}

async function checkForVictory(){
  if(gameState.players.you.hq <= 0){
    showModal(`<h3>Defeat</h3><p>Your HQ was destroyed.</p><div style="display:flex;justify-content:flex-end"><button id="ok" class="btn">OK</button></div>`);
    document.getElementById('ok').onclick = ()=>{ closeModal(); endMatchEarly(); state='title'; render(); };
  } else if(gameState.players.opponent.hq <= 0){
    showModal(`<h3>Victory</h3><p>Opponent HQ destroyed.</p><div style="display:flex;justify-content:flex-end"><button id="ok" class="btn">OK</button></div>`);
    document.getElementById('ok').onclick = ()=>{ closeModal(); endMatchEarly(); state='title'; render(); };
  }
}

/* End Turn: handle K/C increment + ready countdown + draw + change whoseTurn */
async function endTurn(){
  if(gameState.whoseTurn !== user.id) return alert('Not your turn');
  // Mark end: set whoseTurn to opponent
  const nextId = (gameState.players.you.id === gameState.whoseTurn) ? gameState.players.opponent.id : gameState.players.you.id;
  // For the player who ended turn: reduce nothing; update opponent's C by +1 (cap 12) and set K to C at their turn start
  // Decrement readyTurns for all units of next player
  // For simplicity in this demo: perform actions for both sides deterministically
  // Switch turn and draw 1 for the next player
  // increment C for next player
  const nextPlayerKey = (gameState.players.you.id === nextId) ? 'you' : 'opponent';
  gameState.players[nextPlayerKey].C = Math.min(12, (gameState.players[nextPlayerKey].C || 0) + 1);
  gameState.players[nextPlayerKey].K = gameState.players[nextPlayerKey].C;
  // decrement readyTurns for this next player's units and set ready when 0
  for(let u of gameState.units){
    if(u.owner === nextId && typeof u.readyTurns === 'number'){
      u.readyTurns = Math.max(0, (u.readyTurns||0) - 1);
      if(u.readyTurns === 0) u.ready = true;
    }
  }
  // next player draws one card from their deck (starter card for demo)
  const starterCard = { name: 'Soldier', atk:1, hp:2, maxHp:2, cost:1 };
  gameState.players[nextPlayerKey].hand.push({ ...starterCard });
  gameState.players[nextPlayerKey].deckCount = Math.max(0, (gameState.players[nextPlayerKey].deckCount||0)-1);
  // update whoseTurn and turnNumber
  gameState.whoseTurn = nextId;
  gameState.turnNumber = (gameState.turnNumber||1) + 1;
  await persistGameState(); render();
}

/* ---------- Bot logic (simple) ---------- */
async function runBotTurn(){
  // Bot tries to: 1) play if K >= cost; 2) move to front if front empty; 3) attack front if enemy there; 4) attack HQ if front owned; 5) end turn
  const botId = gameState.players.opponent.id;
  if(!gameState.players.opponent.isBot) return;
  // 1. play first playable card
  const bot = gameState.players.opponent;
  for(let i=0;i<bot.hand.length;i++){
    const c = bot.hand[i];
    if(bot.K >= c.cost){
      bot.K -= c.cost;
      const unit = { id: localUnitId(), owner: botId, name: c.name, atk: c.atk, hp: c.hp, maxHp: c.maxHp||c.hp, cost: c.cost, ready:false, readyTurns:1, pos:{row:0,col:0} };
      // spawn at opponent reserve (row 0, col 0)
      unit.pos = { row: 0, col: 4 };
      gameState.units.push(unit);
      bot.hand.splice(i,1);
      bot.deckCount = Math.max(0, bot.deckCount - 1);
      break;
    }
  }
  // 2. If front empty, move a ready bot unit to front
  if(!gameState.front.owner){
    const readyUnits = gameState.units.filter(u => u.owner === botId && u.ready);
    if(readyUnits.length>0){
      const u = readyUnits[0];
      u.pos = { row: 1, col: 1 };
      gameState.front.owner = botId;
      gameState.front.occupantId = u.id;
      await persistGameState(); render();
      // small delay
      await new Promise(r=>setTimeout(r,300));
    }
  }
  // 3. If front occupied by player, attack it if bot has ready unit
  if(gameState.front.owner && gameState.front.owner !== botId){
    const attacker = gameState.units.find(u => u.owner === botId && u.ready);
    if(attacker){
      const frontUnit = gameState.units.find(u => u.id === gameState.front.occupantId);
      if(frontUnit){
        frontUnit.hp -= attacker.atk;
        attacker.hp -= frontUnit.atk;
        gameState.units = gameState.units.filter(u => u.hp > 0);
        if(frontUnit.hp <= 0){ gameState.front.owner = null; gameState.front.occupantId = null; }
        await persistGameState(); render();
      }
    }
  }
  // 4. If front owned by bot, attempt attack HQ
  if(gameState.front.owner === botId){
    const frontUnit = gameState.units.find(u => u.id === gameState.front.occupantId);
    if(frontUnit){
      gameState.players.you.hq -= frontUnit.atk;
      await checkForVictory();
      await persistGameState(); render();
    }
  }

  // End bot turn
  // increment player's (human) C and K on start of their next turn (endTurn will handle switching)
  // For demo, call endTurn on behalf of bot by flipping whoseTurn back
  // But to keep consistent, use same flow as human endTurn: we set whoseTurn to human and perform draw / C increment
  const nextId = gameState.players.you.id;
  gameState.players.you.C = Math.min(12, (gameState.players.you.C||0) + 1);
  gameState.players.you.K = gameState.players.you.C;
  for(let u of gameState.units){ if(u.owner === nextId && typeof u.readyTurns === 'number'){ u.readyTurns = Math.max(0, (u.readyTurns||0) - 1); if(u.readyTurns === 0) u.ready = true; } }
  gameState.players.you.hand.push({ name:'Soldier', atk:1, hp:2, maxHp:2, cost:1 });
  gameState.players.you.deckCount = Math.max(0, gameState.players.you.deckCount - 1);
  gameState.whoseTurn = nextId;
  gameState.turnNumber = (gameState.turnNumber||1) + 1;
  await persistGameState(); render();
}

/* ---------- Subscriptions / Sync ---------- */
function subscribeToMatch(matchId){
  // unsubscribe previous
  if(realtimeSubscription) realtimeSubscription.unsubscribe();
  // subscribe to game_states changes for this match
  realtimeSubscription = supabase.channel('public:game_states')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_states', filter: `match_id=eq.${matchId}` }, payload => {
      const newState = payload.new.state;
      // Replace local gameState but keep local UI reactive
      gameState = newState;
      render();
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_states', filter: `match_id=eq.${matchId}` }, payload => {
      gameState = payload.new.state;
      render();
    })
    .subscribe();
}

/* ---------- Small helpers ---------- */
async function endMatchEarly(){
  if(!currentMatch) { state='title'; render(); return; }
  // mark match finished and remove game state
  await supabase.from('matches').update({ status:'finished' }).eq('id', currentMatch.id);
  await supabase.from('game_states').delete().eq('match_id', currentMatch.id);
  currentMatch = null; gameState = null;
}

/* ---------- Matching timer modal ---------- */
function showMatchingTimer(){
  showModal(`<div class="matching-timer"><div>Matching…</div><div id="timer">0s</div><button id="cancelMatch" class="btn" style="margin-top:8px">Cancel</button></div>`, true);
  let t=0; const timerId = setInterval(()=>{ t+=1; if(document.getElementById('timer')) document.getElementById('timer').innerText = t+'s'; },1000);
  document.getElementById('cancelMatch').onclick = async ()=>{
    clearInterval(timerId);
    await supabase.from('profiles').update({ client_state: 'idle' }).eq('id', user.id);
    closeModal();
  };
}

/* ---------- Modal helpers ---------- */
function showModal(html, keepBackdrop=false){
  closeModal();
  const backdrop = document.createElement('div'); backdrop.className='modal-backdrop';
  const modal = document.createElement('div'); modal.className='modal'; modal.innerHTML = html;
  backdrop.appendChild(modal);
  backdrop.onclick = (e)=>{ if(e.target===backdrop && !keepBackdrop) closeModal(); };
  document.body.appendChild(backdrop);
}
function closeModal(){ const b = document.querySelector('.modal-backdrop'); if(b) b.remove(); }

/* ---------- Misc ---------- */
async function showLogoutConfirm(){
  showModal(`
    <h3>Log Out?</h3>
    <p>Do you want to log out?</p>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button id="resume" class="btn" style="background:transparent;border:1px solid rgba(255,255,255,0.06)">Resume Game</button>
      <button id="logout" class="btn">Log Out</button>
    </div>
  `);
  document.getElementById('logout').onclick = async ()=>{
    await supabase.auth.signOut();
    closeModal(); state='login'; render();
  };
  document.getElementById('resume').onclick = ()=>{ closeModal(); state='title'; render(); };
}

/* ---------- Startup ---------- */
startup();
