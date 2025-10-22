// app.js - main frontend logic (simplified demo)
import { supabase } from './supabase.js';

const app = document.getElementById('app');
let state = 'login'; // initial
let user = null;
let ads = [
  '/ads/ad1.png','/ads/ad2.png','/ads/ad3.png'
]; // put your pngs in /ads
let adIndex = 0;
let adInterval;

async function startup(){
  // check if logged in
  const { data: { user: sessionUser } } = await supabase.auth.getUser();
  if(sessionUser) {
    user = sessionUser;
    await loadProfile();
    state = 'title';
  } else {
    state = 'login';
  }
  render();
  startAdCarousel();
  supabase.auth.onAuthStateChange((event, session) => {
    if(session?.user) { user = session.user; loadProfile(); state='title'; render(); }
    else { user=null; state='login'; render(); }
  });
}

async function loadProfile(){
  if(!user) return;
  // load minimal player info: profile and SPY-Coin
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  window.profile = data;
}

function startAdCarousel(){
  if(adInterval) clearInterval(adInterval);
  adInterval = setInterval(()=>{
    adIndex = (adIndex+1) % ads.length;
    const img = document.querySelector('.adimg');
    if(img) img.src = ads[adIndex];
  }, 5000);
}

function render(){
  app.innerHTML = '';
  // Topbar: only present in certain states (decks, store, playPrep, title)
  const showTop = ['decks','store','playPrep','title','decksModify','playCodeDeploy'].includes(state);
  if(showTop){
    const top = document.createElement('div'); top.className='topbar';
    const left = document.createElement('div'); left.className='left';
    left.innerHTML = `<div class="brand">SpyCards</div>`;
    const center = document.createElement('div'); center.className='center';
    center.innerHTML = `<div class="small">Game</div>`;
    const right = document.createElement('div'); right.className='right';
    right.innerHTML = `<div class="small">${user?user.email:''}</div><div class="coin">${window.profile?.spy_coin||0} SPY</div>`;
    top.appendChild(left); top.appendChild(center); top.appendChild(right);
    app.appendChild(top);
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
    const email = box.querySelector('#email').value;
    const password = box.querySelector('#password').value;
    if(!email || !password) return alert('enter credentials');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if(error) alert(error.message);
  };
  box.querySelector('#btn-register').onclick = async ()=>{
    const email = box.querySelector('#email').value;
    const password = box.querySelector('#password').value;
    if(!email || !password) return alert('enter credentials');
    const { data, error } = await supabase.auth.signUp({ email, password });
    if(error) return alert(error.message);
    alert('Check your email to confirm registration (if enabled). After confirming, login here.');
  };
}

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
  const adimg = document.createElement('img'); adimg.className='adimg'; adimg.src = ads[adIndex];
  right.appendChild(adimg);

  container.appendChild(left); container.appendChild(right);
}

function showLogoutConfirm(){
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
    closeModal();
    state='login'; render();
  };
  document.getElementById('resume').onclick = ()=>{ closeModal(); state='title'; render(); };
}

function renderDecks(container){
  const left = document.createElement('div'); left.className='leftcol';
  const header = document.createElement('div'); header.innerHTML = `<h3>Your Decks</h3>`;
  left.appendChild(header);

  // placeholder: list deck icons (max 5 columns per row => 5 columns)
  const grid = document.createElement('div'); grid.style.display='grid'; grid.style.gridTemplateColumns='repeat(5,1fr)'; grid.style.gap='10px';
  // fetch decks
  supabase.from('decks').select('*').eq('owner', user.id).then(res=>{
    const data = res.data || [];
    if(data.length===0){
      const p = document.createElement('div'); p.className='small'; p.textContent='No decks yet.';
      left.appendChild(p);
    } else {
      data.forEach(d=>{
        const card = document.createElement('div'); card.className='card';
        card.innerHTML = `<div style="font-weight:700">${d.name}</div><div class="small">${d.description||''}</div>`;
        card.onclick = ()=>{ openDeckModify(d.id); };
        grid.appendChild(card);
      });
      left.appendChild(grid);
    }
  });

  const right = document.createElement('div'); right.className='rightcol';
  right.innerHTML = `<div class="small">Ads / Info</div> <img class="adimg" src="${ads[adIndex]}" />`;
  container.appendChild(left); container.appendChild(right);
}

let currentEditDeck = null;
let deckWorkingCopy = { cards: [] };

async function openDeckModify(deckId){
  // load deck data and owned cards
  const { data: deck } = await supabase.from('decks').select('*').eq('id', deckId).single();
  currentEditDeck = deck;
  // load all cards owned by user
  const owned = (await supabase.from('cards').select('*').eq('owner', user.id)).data || [];
  const inDeckRows = (await supabase.from('deck_cards').select('*').eq('deck_id', deckId)).data || [];
  deckWorkingCopy.cards = inDeckRows.map(r => ({ card_id: r.card_id, qty: r.qty }));
  state='decksModify';
  window.ownedCards = owned;
  render();
}

function renderDecksModify(container){
  const wrapper = document.createElement('div'); wrapper.className='leftcol';
  wrapper.style.flexDirection='column';
  wrapper.style.padding='0';
  const header = document.createElement('div'); header.style.padding='12px'; header.innerHTML = `<h3>Edit Deck: ${currentEditDeck?.name||''}</h3>`;
  wrapper.appendChild(header);
  const content = document.createElement('div'); content.className='decks-modify'; content.style.padding='12px';

  // left: owned cards grid (4 per row, infinite columns scroll)
  const left = document.createElement('div'); left.className='left-cards';
  const grid = document.createElement('div'); grid.className='grid';
  (window.ownedCards||[]).forEach(c=>{
    const el = document.createElement('div'); el.className='card';
    el.innerHTML = `<div style="font-weight:700">${c.name}</div><div class="small">x${c.qty_owned||1}</div>`;
    el.onclick = ()=>{
      // add to deckWorkingCopy
      const existing = deckWorkingCopy.cards.find(x=>x.card_id===c.id);
      if(existing) existing.qty += 1;
      else deckWorkingCopy.cards.push({ card_id: c.id, qty: 1 });
      render(); // re-render to update right view
    };
    grid.appendChild(el);
  });
  left.appendChild(grid);

  // right: in-deck list, scrollable, word list (card names + qty)
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

  content.appendChild(left);
  content.appendChild(right);
  wrapper.appendChild(content);
  container.appendChild(wrapper);

  // ESC => show quit-box
  document.onkeydown = (e)=>{
    if(e.key==='Escape'){
      showSaveDeckPrompt();
    }
  };
}

function showSaveDeckPrompt(){
  showModal(`
    <h3>Quit deck editor?</h3>
    <p>Save changes to deck "${currentEditDeck.name}"?</p>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button id="no-save" class="btn" style="background:transparent;border:1px solid rgba(255,255,255,0.06)">No</button>
      <button id="yes-save" class="btn">Yes, Save</button>
    </div>
  `);
  document.getElementById('no-save').onclick = ()=>{ closeModal(); state='decks'; document.onkeydown = null; render(); };
  document.getElementById('yes-save').onclick = async ()=>{
    // persist deckWorkingCopy: NOTE: production should call a server-side function to validate content and enforce limits
    // For demo, we delete existing deck_cards and reinsert
    await supabase.from('deck_cards').delete().eq('deck_id', currentEditDeck.id);
    if(deckWorkingCopy.cards.length>0){
      const inserts = deckWorkingCopy.cards.map(c=>({ deck_id: currentEditDeck.id, card_id: c.card_id, qty: c.qty }));
      await supabase.from('deck_cards').insert(inserts);
    }
    closeModal();
    state='decks';
    document.onkeydown = null;
    render();
  };
}

function renderStore(container){
  const left = document.createElement('div'); left.className='leftcol';
  left.innerHTML = `<h3>Store</h3>`;
  const gridWrap = document.createElement('div'); gridWrap.className='store-grid';
  // fetch store items
  supabase.from('store_items').select('*').then(res=>{
    (res.data||[]).forEach(item=>{
      const el = document.createElement('div'); el.className='card';
      el.innerHTML = `<div style="font-weight:700">${item.name}</div><div class="small">${item.description||''}</div><div style="margin-top:8px;color:var(--muted)">${item.price} SPY</div><button class="btn" style="margin-top:8px">Buy</button>`;
      el.querySelector('button').onclick = ()=>{ showStoreDetail(item); };
      gridWrap.appendChild(el);
    });
  });
  left.appendChild(gridWrap);

  const right = document.createElement('div'); right.className='rightcol';
  right.innerHTML = `<div class="small">Store Info</div><img class="adimg" src="${ads[adIndex]}" />`;
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
    // IMPORTANT: real purchases should be via server-side function to avoid coin forgery
    const price = item.price;
    // Check balance first
    const profile = (await supabase.from('profiles').select('*').eq('id', user.id).single()).data;
    if((profile.spy_coin||0) < price){ alert('Not enough SPY-Coin'); return; }
    // For demo: deduct client-side (but still perform DB update)
    const { error } = await supabase.from('profiles').update({ spy_coin: (profile.spy_coin||0) - price }).eq('id', user.id);
    if(error) alert(error.message);
    else {
      // record purchase
      await supabase.from('purchases').insert({ user_id: user.id, item_id: item.id, price });
      alert('Purchase complete.');
      closeModal();
      await loadProfile(); render();
    }
  };
}

function renderPlayPrep(container){
  const left = document.createElement('div'); left.className='leftcol';
  left.innerHTML = `<h3>Play — Prepare</h3>`;
  const btnMatch = document.createElement('button'); btnMatch.className='menu-button'; btnMatch.textContent='Match a Match';
  const btnGen = document.createElement('button'); btnGen.className='menu-button'; btnGen.textContent='Generate Play Code';
  const btnJoin = document.createElement('button'); btnJoin.className='menu-button'; btnJoin.textContent='Join by Play Code';
  const txt = document.createElement('input'); txt.className='input'; txt.placeholder='5-digit code';
  left.appendChild(btnMatch); left.appendChild(btnGen); left.appendChild(txt); left.appendChild(btnJoin);

  btnGen.onclick = async ()=>{
    // generate a code locally (in production, call server-side to reserve)
    const code = Math.floor(10000 + Math.random()*90000).toString();
    // store a match row as host (production: use server-side)
    const { data } = await supabase.from('matches').insert({ host_user: user.id, play_code: code, status: 'waiting' }).select().single();
    alert('Play code: ' + code);
  };
  btnJoin.onclick = async ()=>{
    const code = txt.value.trim();
    if(!/^\d{5}$/.test(code)) return alert('Enter a 5-digit code');
    // find match with that code
    const { data: match } = await supabase.from('matches').select('*').eq('play_code', code).eq('status','waiting').limit(1).single();
    if(!match) return alert('No matching public game found.');
    // join match: in production, use server function to ensure atomicity
    await supabase.from('matches').update({ guest_user: user.id, status: 'started' }).eq('id', match.id);
    state='play'; render();
  };
  btnMatch.onclick = async ()=>{
    // mark available
    await supabase.from('profiles').update({ client_state: 'available' }).eq('id', user.id);
    showMatchingTimer();
    // subscribe to matches / pairing logic should be server-side for proper atomicity
  };

  const right = document.createElement('div'); right.className='rightcol';
  right.innerHTML = `<p class="small">Match options explained: "Match a Match" will try to pair 2 players who are available. For production, run pairing on server (Edge Function).</p>`;
  container.appendChild(left); container.appendChild(right);
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

function renderPlay(container){
  const left = document.createElement('div'); left.className='leftcol';
  left.innerHTML = `<h3>Play — Simulated Match</h3><p class="small">(This demo simply chooses a random winner)</p>`;
  const playBtn = document.createElement('button'); playBtn.className='menu-button'; playBtn.textContent='Play Round (simulate)';
  const finishBtn = document.createElement('button'); finishBtn.className='menu-button'; finishBtn.textContent='Finish Match';
  left.appendChild(playBtn); left.appendChild(finishBtn);
  playBtn.onclick = ()=>{ alert(Math.random()<0.5? 'You won this round!':'You lost this round.'); };
  finishBtn.onclick = async ()=>{
    // change states back to title and mark profile idle
    await supabase.from('profiles').update({ client_state:'idle' }).eq('id', user.id);
    state='title'; render();
  };
  const right = document.createElement('div'); right.className='rightcol';
  right.innerHTML = `<div class="small">Match area (cards UI to be implemented). After match, players return to Title.</div>`;
  container.appendChild(left); container.appendChild(right);
}

/* Modal helpers */
function showModal(html, keepBackdrop=false){
  const backdrop = document.createElement('div'); backdrop.className='modal-backdrop';
  const modal = document.createElement('div'); modal.className='modal'; modal.innerHTML = html;
  backdrop.appendChild(modal);
  backdrop.onclick = (e)=>{ if(e.target===backdrop && !keepBackdrop) closeModal(); };
  document.body.appendChild(backdrop);
}
function closeModal(){ const b = document.querySelector('.modal-backdrop'); if(b) b.remove(); }

/* startup */
startup();