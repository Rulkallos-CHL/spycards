// app.js - frontend logic with game play, bot, matching improvements, store seed use and "Get Coins"
import { supabase } from './supabase.js';

const app = document.getElementById('app');
let state = 'login'; // login, title, decks, decksModify, store, playPrep, play
let user = null;
let profile = null;
let currentMatch = null;
let gameState = null;
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
    document.getElementById('yes-save').onclick = async ()=>{ await saveDeckChanges(); closeModal(); state='decks'; render(); };
    return;
  }
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
    document.getElementById('leave').onclick = async ()=>{ await endMatchEarly(); closeModal(); state='title'; render(); };
    return;
  }
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
    right.innerHTML = `<div class="small">${user?user.email:''}</div><div class="coin" id="spy-coin">${profile?.spy_coin||0} SPY</div><button id="get-coins" class="return" style="margin-left:8px">Get Coins</button>`;
    top.appendChild(left); top.appendChild(center); top.appendChild(right);
    app.appendChild(top);
    document.getElementById('btn-return').onclick = handleReturn;
    document.getElementById('get-coins').onclick = giveCoinsModal;
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
    if(data?.user){
      // create profile row (profiles trigger will create starter deck automatically if SQL trigger installed)
      await supabase.from('profiles').insert({ id: data.user.id, display_name: email.split('@')[0], spy_coin: 50 });
      // as extra fallback (if trigger not installed), create deck/cards client-side
      await createStarterDeckClientSide(data.user.id);
      alert('Registered. Check email to confirm (if configured). Then login.');
    } else alert('Registered. Please login.');
  };
}

async function createStarterDeckClientSide(userId){
  try{
    // Create deck, card and deck_cards for starter deck as fallback
    const deckRes = await supabase.from('decks').insert({ owner: userId, name: 'Starter Deck', description: '40 Soldiers (Starter)' }).select().single();
    const cardRes = await supabase.from('cards').insert({ owner: userId, name: 'Soldier', qty_owned: 40, meta: { atk:1, hp:2, cost:1 } }).select().single();
    if(deckRes.data && cardRes.data){
      await supabase.from('deck_cards').insert({ deck_id: deckRes.data.id, card_id: cardRes.data.id, qty: 40 });
    }
  }catch(e){ console.warn('starter deck fallback failed', e); }
}

/* ---------- Title ---------- */
function renderTitle(container){
  const left = document.createElement('div'); left.className='leftcol';
  const startBtn = document.createElement('button'); startBtn.className='menu-button'; startBtn.textContent='Start A Game';
  const vsBotBtn = document.createElement('button'); vsBotBtn.className='menu-button'; vsBotBtn.textContent='Play vs Bot';
  const decksBtn = document.createElement('button'); decksBtn.className='menu-button'; decksBtn.textContent='Decks';
  const storeBtn = document.createElement('button'); storeBtn.className='menu-button'; storeBtn.textContent='Store';
  const logoutBtn = document.createElement('button'); logoutBtn.className='menu-button'; logoutBtn.textContent='Log Out';
  left.appendChild(startBtn); left.appendChild(vsBotBtn); left.appendChild(decksBtn); left.appendChild(storeBtn); left.appendChild(logoutBtn);
  startBtn.onclick = ()=>{ state='playPrep'; render(); };
  vsBotBtn.onclick = ()=>{ // host a match and tell it to use a bot
    state='play';
    // create a match row and immediately init a bot game
    createMatchAndStartBot();
  };
  decksBtn.onclick = ()=>{ state='decks'; render(); };
  storeBtn.onclick = ()=>{ state='store'; render(); };
  logoutBtn.onclick = ()=>{ showLogoutConfirm(); };

  const right = document.createElement('div'); right.className='rightcol';
  const adimg = document.createElement('img'); adimg.className='adimg'; adimg.src = ads[adIndex] || '';
  right.appendChild(adimg);
  container.appendChild(left); container.appendChild(right);
}

/* ---------- Decks & decksModify ---------- */
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
    // Demo: do client-side profile update (production: run server function)
    await supabase.from('profiles').update({ spy_coin: (prof.spy_coin||0)-item.price }).eq('id', user.id);
    await supabase.from('purchases').insert({ user_id: user.id, item_id: item.id, price: item.price });
    alert('Purchase complete.');
    closeModal(); await loadProfile(); render();
  };
}

/* ---------- Play Prep: Generate / Join / Match / Play vs Bot ---------- */
function renderPlayPrep(container){
  const left = document.createElement('div'); left.className='leftcol';
  left.innerHTML = `<h3>Play — Prepare</h3>`;
  const btnMatch = document.createElement('button'); btnMatch.className='menu-button'; btnMatch.textContent='Match a Match';
  const btnGen = document.createElement('button'); btnGen.className='menu-button'; btnGen.textContent='Generate Play Code';
  const btnJoin = document.createElement('button'); btnJoin.className='menu-button'; btnJoin.textContent='Join by Play Code';
  const btnBot = document.createElement('button'); btnBot.className='menu-button'; btnBot.textContent='Play vs Bot';
  const txt = document.createElement('input'); txt.className='input'; txt.placeholder='5-digit code';
  left.appendChild(btnMatch); left.appendChild(btnGen); left.appendChild(txt); left.appendChild(btnJoin); left.appendChild(btnBot);

  btnGen.onclick = async ()=>{
    const code = Math.floor(10000 + Math.random()*90000).toString();
    const { data } = await supabase.from('matches').insert({ host_user: user.id, play_code: code, status: 'waiting' }).select().single();
    alert('Play code: ' + code);
    subscribeToMatch(data.id);
    currentMatch = data;
    // create game state and wait for guest or bot fallback
    await initLocalGameSessionAsHost(data.id, true);
  };
  btnJoin.onclick = async ()=>{
    const code = txt.value.trim(); if(!/^\d{5}$/.test(code)) return alert('Enter a 5-digit code');
    // use RPC for atomic claim
    const { data, error } = await supabase.rpc('claim_match_by_code', { p_code: code, p_user_id: user.id });
    if(error) return alert('Join failed: ' + error.message);
    if(!data) return alert('No matching available match found.');
    // successfully claimed
    currentMatch = data;
    subscribeToMatch(data.id);
    // if host has already started a game_state, load it. otherwise wait for it and transition to play
    state='play'; await initLocalGameSessionAsGuest(data.id); render();
  };
  btnMatch.onclick = async ()=>{
    await supabase.from('profiles').update({ client_state: 'available' }).eq('id', user.id);
    showMatchingTimer();
  };
  btnBot.onclick = async ()=>{
    // create match and start bot play immediately
    const { data } = await supabase.from('matches').insert({ host_user: user.id, status: 'started' }).select().single();
    currentMatch = data;
    state='play';
    subscribeToMatch(data.id);
    await initLocalGameState(data.id, user.id, null, true);
    render();
  };

  const right = document.createElement('div'); right.className='rightcol'; right.innerHTML = `<p class="small">Use Generate Play Code to host, Join by Play Code to join, or Play vs Bot to play a bot immediately.</p>`;
  container.appendChild(left); container.appendChild(right);
}

/* ---------- Play (game) ---------- */
/* (Much of the game logic kept - updated to check both-client flow) */
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
    return;
  }

  const statusBar = document.createElement('div'); statusBar.innerHTML = `<div class="small">Turn: ${gameState.turnNumber} — ${gameState.whoseTurn === user.id ? 'Your turn' : 'Opponent turn'}</div>`;
  gameArea.appendChild(statusBar);

  const board = document.createElement('div'); board.className='board';
  for(let r=0;r<3;r++){
    const row = document.createElement('div'); row.className='row';
    for(let c=0;c<5;c++){
      const cell = document.createElement('div'); cell.className='cell';
      const cellUnits = unitsAtPos(r,c);
      if(r===0 && c===2){
        cell.innerHTML = `<div class="small">Opponent HQ</div><div class="unit">HP: ${gameState.players.opponent.hq}</div>`;
      } else if(r===2 && c===2){
        cell.innerHTML = `<div class="small">Your HQ</div><div class="unit">HP: ${gameState.players.you.hq}</div>`;
      } else {
        if(cellUnits.length){
          cellUnits.forEach(u=>{
            const div = document.createElement('div'); div.className='unit';
            div.innerHTML = `<div style="font-weight:700">${u.name}</div><div class="small">ATK:${u.atk} HP:${u.hp}/${u.maxHp}</div><div class="small">${u.ready ? 'Ready' : 'Waiting'}</div>`;
            row.appendChild(div);
          });
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

  const resources = document.createElement('div'); resources.style.marginTop='12px';
  resources.innerHTML = `<div class="small">K: ${gameState.players.you.K} / C: ${gameState.players.you.C}</div>`;
  side.appendChild(resources);

  if(gameState.players.opponent.isBot && gameState.whoseTurn === gameState.players.opponent.id){
    setTimeout(()=> runBotTurn(), 400);
  }
}

/* ---------- Game helpers (unchanged behavior) ---------- */
function unitsAtPos(row,col){
  const units = (gameState?.units || []);
  return units.filter(u => u.pos.row === row && u.pos.col === col);
}

/* When hosting for a bot or guest we call this */
async function createMatchAndStartBot(){
  const { data } = await supabase.from('matches').insert({ host_user: user.id, status: 'started' }).select().single();
  currentMatch = data;
  subscribeToMatch(data.id);
  await initLocalGameState(data.id, user.id, null, true);
}

async function initLocalGameSessionAsHost(matchId, hostIsLocal=false){
  currentMatch = { id: matchId };
  subscribeToMatch(matchId);
  const { data } = await supabase.from('matches').select('*').eq('id', matchId).single();
  if(!data.guest_user){
    // if guest never came, create bot
    await initLocalGameState(matchId, user.id, null, true);
  } else {
    await initLocalGameState(matchId, data.host_user, data.guest_user, false);
  }
}

async function initLocalGameSessionAsGuest(matchId){
  currentMatch = { id: matchId };
  subscribeToMatch(matchId);
  const { data } = await supabase.from('game_states').select('*').eq('match_id', matchId).single();
  if(data) { gameState = data.state; render(); }
  else {
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
  const youId = user.id;
  const opponentId = useBot ? 'BOT' : (guestUserId && guestUserId !== youId ? guestUserId : (hostUserId !== youId ? hostUserId : guestUserId));
  const starterCard = { name: 'Soldier', atk:1, hp:2, maxHp:2, cost:1 };
  const initial = {
    match_id: matchId,
    turnNumber: 1,
    whoseTurn: hostUserId || youId,
    players: {
      you: { id: youId, hq:20, deckCount:40, hand:[], K:0, C:0, isBot:false },
      opponent: { id: opponentId || 'BOT', hq:20, deckCount:40, hand:[], K:0, C:0, isBot: useBot }
    },
    units: [],
    front: { owner: null, occupantId: null }
  };
  for(let i=0;i<5;i++){
    initial.players.you.hand.push({ ...starterCard });
    initial.players.opponent.hand.push({ ...starterCard });
  }
  if(initial.whoseTurn === youId){
    initial.players.you.C = Math.min(12, initial.players.you.C + 1);
    initial.players.you.K = initial.players.you.C;
  } else {
    initial.players.opponent.C = Math.min(12, initial.players.opponent.C + 1);
    initial.players.opponent.K = initial.players.opponent.C;
  }
  if(useBot) initial.players.opponent.isBot = true;

  const { error } = await supabase.from('game_states').upsert({ match_id: matchId, state: initial }).select().single();
  if(error) console.error('Failed to create game state', error);
  else { gameState = initial; currentMatch = { id: matchId }; render(); }
}

function localUnitId(){ return 'u_' + Math.random().toString(36).slice(2,9); }

async function persistGameState(){
  if(!currentMatch || !gameState) return;
  await supabase.from('game_states').update({ state: gameState, updated_at: new Date() }).eq('match_id', currentMatch.id);
}

/* ---------- Player Actions (unchanged core logic) ---------- */

async function playCardFromHand(handIndex){
  if(gameState.whoseTurn !== user.id) return alert('Not your turn');
  const card = gameState.players.you.hand[handIndex];
  if(!card) return;
  if(gameState.players.you.K < card.cost) return alert('Not enough K');
  gameState.players.you.K -= card.cost;
  const unit = {
    id: localUnitId(),
    owner: user.id,
    name: card.name,
    atk: card.atk,
    hp: card.hp,
    maxHp: card.maxHp || card.hp,
    cost: card.cost,
    ready: false,
    readyTurns: 1,
    pos: { row: 2, col: 4 }
  };
  gameState.units.push(unit);
  gameState.players.you.hand.splice(handIndex,1);
  gameState.players.you.deckCount = Math.max(0, gameState.players.you.deckCount - 1);
  await persistGameState(); render();
}

async function moveToFront(){
  if(gameState.whoseTurn !== user.id) return alert('Not your turn');
  const readyUnits = gameState.units.filter(u => u.owner === user.id && u.ready && !(u.pos.row===1 && u.pos.col===1));
  if(readyUnits.length === 0) return alert('No ready units to move.');
  if(gameState.front.owner && gameState.front.owner !== user.id) return alert('Front is occupied by opponent.');
  const u = readyUnits[0];
  u.pos = { row: 1, col: 1 };
  gameState.front.owner = user.id;
  gameState.front.occupantId = u.id;
  await persistGameState(); render();
}

async function attackFront(){
  if(gameState.whoseTurn !== user.id) return alert('Not your turn');
  if(!gameState.front.occupantId) return alert('No unit at front to attack.');
  const frontUnit = gameState.units.find(u => u.id === gameState.front.occupantId);
  if(!frontUnit) { gameState.front.owner = null; gameState.front.occupantId = null; await persistGameState(); return; }
  if(frontUnit.owner === user.id) return alert('You already occupy front; try Attack HQ instead.');
  const attacker = gameState.units.find(u => u.owner === user.id && u.ready);
  if(!attacker) return alert('No ready attacker to contest front.');
  frontUnit.hp -= attacker.atk;
  attacker.hp -= frontUnit.atk;
  gameState.units = gameState.units.filter(u => u.hp > 0);
  if(frontUnit.hp <= 0) { gameState.front.owner = null; gameState.front.occupantId = null; }
  else {
    const existing = gameState.units.find(u => u.id === frontUnit.id);
    if(!existing){ gameState.front.owner = null; gameState.front.occupantId = null; }
  }
  await persistGameState(); render();
}

async function attackHQ(){
  if(gameState.whoseTurn !== user.id) return alert('Not your turn');
  if(gameState.front.owner !== user.id) return alert('You must control front to attack HQ.');
  const frontUnit = gameState.units.find(u => u.id === gameState.front.occupantId);
  if(!frontUnit) return alert('No unit at front to attack HQ.');
  gameState.players.opponent.hq -= frontUnit.atk;
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

async function endTurn(){
  if(gameState.whoseTurn !== user.id) return alert('Not your turn');
  const nextId = (gameState.players.you.id === gameState.whoseTurn) ? gameState.players.opponent.id : gameState.players.you.id;
  const nextPlayerKey = (gameState.players.you.id === nextId) ? 'you' : 'opponent';
  gameState.players[nextPlayerKey].C = Math.min(12, (gameState.players[nextPlayerKey].C || 0) + 1);
  gameState.players[nextPlayerKey].K = gameState.players[nextPlayerKey].C;
  for(let u of gameState.units){
    if(u.owner === nextId && typeof u.readyTurns === 'number'){
      u.readyTurns = Math.max(0, (u.readyTurns||0) - 1);
      if(u.readyTurns === 0) u.ready = true;
    }
  }
  const starterCard = { name: 'Soldier', atk:1, hp:2, maxHp:2, cost:1 };
  gameState.players[nextPlayerKey].hand.push({ ...starterCard });
  gameState.players[nextPlayerKey].deckCount = Math.max(0, (gameState.players[nextPlayerKey].deckCount||0)-1);
  gameState.whoseTurn = nextId;
  gameState.turnNumber = (gameState.turnNumber||1) + 1;
  await persistGameState(); render();
}

/* ---------- Bot logic ---------- */
async function runBotTurn(){
  const botId = gameState.players.opponent.id;
  if(!gameState.players.opponent.isBot) return;
  const bot = gameState.players.opponent;
  for(let i=0;i<bot.hand.length;i++){
    const c = bot.hand[i];
    if(bot.K >= c.cost){
      bot.K -= c.cost;
      const unit = { id: localUnitId(), owner: botId, name: c.name, atk: c.atk, hp: c.hp, maxHp: c.maxHp||c.hp, cost: c.cost, ready:false, readyTurns:1, pos:{row:0,col:4} };
      gameState.units.push(unit);
      bot.hand.splice(i,1);
      bot.deckCount = Math.max(0, bot.deckCount - 1);
      break;
    }
  }
  if(!gameState.front.owner){
    const readyUnits = gameState.units.filter(u => u.owner === botId && u.ready);
    if(readyUnits.length>0){
      const u = readyUnits[0];
      u.pos = { row: 1, col: 1 };
      gameState.front.owner = botId;
      gameState.front.occupantId = u.id;
      await persistGameState(); render();
      await new Promise(r=>setTimeout(r,300));
    }
  }
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
  if(gameState.front.owner === botId){
    const frontUnit = gameState.units.find(u => u.id === gameState.front.occupantId);
    if(frontUnit){
      gameState.players.you.hq -= frontUnit.atk;
      await checkForVictory();
      await persistGameState(); render();
    }
  }
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
  if(realtimeSubscription) realtimeSubscription.unsubscribe();
  realtimeSubscription = supabase.channel('public:game_states')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_states', filter: `match_id=eq.${matchId}` }, payload => {
      const newState = payload.new.state;
      gameState = newState;
      render();
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_states', filter: `match_id=eq.${matchId}` }, payload => {
      gameState = payload.new.state;
      render();
    })
    .subscribe();
}

/* ---------- Helpers: end match, matching modal, get coins ---------- */
async function endMatchEarly(){
  if(!currentMatch) { state='title'; render(); return; }
  await supabase.from('matches').update({ status:'finished' }).eq('id', currentMatch.id);
  await supabase.from('game_states').delete().eq('match_id', currentMatch.id);
  currentMatch = null; gameState = null;
}

function showMatchingTimer(){
  showModal(`<div class="matching-timer"><div>Matching…</div><div id="timer">0s</div><button id="cancelMatch" class="btn" style="margin-top:8px">Cancel</button></div>`, true);
  let t=0; const timerId = setInterval(()=>{ t+=1; if(document.getElementById('timer')) document.getElementById('timer').innerText = t+'s'; },1000);
  document.getElementById('cancelMatch').onclick = async ()=>{
    clearInterval(timerId);
    await supabase.from('profiles').update({ client_state: 'idle' }).eq('id', user.id);
    closeModal();
  };
}

/* ---------- Get Coins ---------- */
function giveCoinsModal(){
  showModal(`
    <h3>Get Coins</h3>
    <p>Click the button to get +100 SPY-Coin (demo: unlimited)</p>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button id="get-coins-cancel" class="btn" style="background:transparent;border:1px solid rgba(255,255,255,0.06)">Close</button>
      <button id="get-coins-ok" class="btn">Give +100 SPY</button>
    </div>
  `);
  document.getElementById('get-coins-cancel').onclick = ()=> closeModal();
  document.getElementById('get-coins-ok').onclick = async ()=>{
    await supabase.from('profiles').update({ spy_coin: (profile?.spy_coin||0) + 100 }).eq('id', user.id);
    await loadProfile();
    closeModal();
    render();
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

/* ---------- Start ---------- */
startup();
