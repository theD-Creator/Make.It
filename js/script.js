const filters = [
  { name: 'Kein Filter', emoji: 'ðŸ˜Š', bg: '#111' },
  { name: 'Sonnenuntergang', emoji: 'ðŸŒ…', bg: '#3d1a00' },
  { name: 'Nacht', emoji: 'ðŸŒ™', bg: '#0a0a2a' },
  { name: 'Natur', emoji: 'ðŸŒ¿', bg: '#0a1f00' },
  { name: 'Hund', emoji: 'ðŸ¶', bg: '#2a1500' },
  { name: 'Party', emoji: 'ðŸŽ‰', bg: '#1a0030' },
];
let currentFilter = 0;
let currentUser = null;
let selectedImageDataUrl = null;
let selectedImageFile = null;
let cameraStream = null;
const LOCAL_POSTS_KEY = 'snapgram_local_posts';
const LOCAL_DM_KEY = 'snapgram_dms';

function initFilters() {
  const row = document.getElementById('filters-row');
  row.innerHTML = '';
  filters.forEach((filter, i) => {
    const pill = document.createElement('div');
    pill.className = 'filter-pill' + (i === 0 ? ' active' : '');
    pill.textContent = `${filter.emoji} ${filter.name}`;
    pill.onclick = () => selectFilter(i);
    row.appendChild(pill);
  });
}

function selectFilter(i) {
  currentFilter = i;
  document.querySelectorAll('.filter-pill').forEach((pill, j) => pill.classList.toggle('active', i === j));
  document.getElementById('cam-preview').textContent = filters[i].emoji;
  document.getElementById('filter-label').textContent = filters[i].name;
  document.getElementById('viewfinder').style.background = filters[i].bg;
  if (selectedImageDataUrl) resetImageMode();
}

function openImagePicker() {
  document.getElementById('image-picker')?.click();
}

function onImageSelected(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  stopLiveCamera();
  const reader = new FileReader();
  reader.onload = () => {
    selectedImageDataUrl = String(reader.result || '');
    selectedImageFile = file;
    const image = document.getElementById('cam-preview-image');
    image.src = selectedImageDataUrl;
    image.classList.add('show');
    document.getElementById('cam-preview').style.display = 'none';
    document.getElementById('filter-label').textContent = 'Bildmodus';
    document.getElementById('filters-row').style.display = 'none';
  };
  reader.readAsDataURL(file);
}

async function startLiveCamera() {
  if (!navigator.mediaDevices?.getUserMedia) return;
  if (cameraStream) return;
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    const liveVideo = document.getElementById('cam-live-video');
    liveVideo.srcObject = cameraStream;
    liveVideo.classList.add('show');
    document.getElementById('cam-preview').style.display = 'none';
  } catch {
    cameraStream = null;
  }
}

function stopLiveCamera() {
  if (!cameraStream) return;
  cameraStream.getTracks().forEach(track => track.stop());
  cameraStream = null;
  const liveVideo = document.getElementById('cam-live-video');
  liveVideo.srcObject = null;
  liveVideo.classList.remove('show');
}

function captureFrameFromLiveCamera() {
  const liveVideo = document.getElementById('cam-live-video');
  if (!liveVideo || !liveVideo.videoWidth || !liveVideo.videoHeight) return null;
  const canvas = document.createElement('canvas');
  canvas.width = liveVideo.videoWidth;
  canvas.height = liveVideo.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(liveVideo, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.92);
}

function takeSnap() {
  if (!selectedImageDataUrl && cameraStream) {
    const captured = captureFrameFromLiveCamera();
    if (captured) {
      selectedImageDataUrl = captured;
      selectedImageFile = { name: `camera-${Date.now()}.jpg`, type: 'image/jpeg' };
    }
  }

  if (selectedImageDataUrl) {
    const image = document.getElementById('snap-taken-image');
    image.src = selectedImageDataUrl;
    image.classList.add('show');
    document.getElementById('snap-taken-emoji').style.display = 'none';
  } else {
    document.getElementById('snap-taken-emoji').textContent = filters[currentFilter].emoji;
    document.getElementById('snap-taken-emoji').style.display = 'block';
    document.getElementById('snap-taken-image').classList.remove('show');
  }
  document.getElementById('snap-taken').classList.add('show');
}

function hideTaken() {
  document.getElementById('snap-taken').classList.remove('show');
}

async function sendSnap() {
  const caption = selectedImageDataUrl ? 'Neuer Bild-Snap' : `Neuer Snap mit ${filters[currentFilter].name}`;
  const username = localStorage.getItem('snapgram_username') || 'du';
  const localPost = {
    id: `local-${Date.now()}`,
    caption,
    emoji: filters[currentFilter].emoji,
    image_url: selectedImageDataUrl || null,
    username,
    timeLabel: 'gerade eben'
  };
  if (currentUser) {
    await supabaseDB.createPost(currentUser.id, caption, filters[currentFilter].emoji, selectedImageDataUrl, selectedImageFile?.name);
  }
  saveLocalPost(localPost);
  prependFeedPost(caption, selectedImageDataUrl, filters[currentFilter].emoji);
  renderProfileFromPosts();
  hideTaken();
  resetImageMode();
  goTo('dms');
}

function resetImageMode() {
  selectedImageDataUrl = null;
  selectedImageFile = null;
  stopLiveCamera();
  document.getElementById('cam-preview-image').classList.remove('show');
  document.getElementById('cam-live-video').classList.remove('show');
  document.getElementById('snap-taken-image').classList.remove('show');
  document.getElementById('cam-preview').style.display = 'block';
  document.getElementById('snap-taken-emoji').style.display = 'block';
  document.getElementById('filter-label').textContent = filters[currentFilter].name;
  document.getElementById('filters-row').style.display = 'none';
}

function prependFeedPost(caption, imageUrl, emoji) {
  const feed = document.querySelector('.feed');
  if (!feed) return;
  const username = localStorage.getItem('snapgram_username') || 'du';
  const post = document.createElement('div');
  post.className = 'post';
  post.innerHTML = `<div class="post-header"><div class="post-avatar" style="background:#E6F1FB;">ðŸ˜Š</div><div><div class="post-user">${username}</div><div class="post-time">gerade eben</div></div><i class="ti ti-dots post-more" aria-hidden="true"></i></div><div class="post-img ${imageUrl ? 'real-image' : ''}">${imageUrl ? `<img src="${imageUrl}" alt="Neuer Snap" />` : `<span>${emoji}</span>`}<div class="snap-badge"><i class="ti ti-clock" aria-hidden="true" style="font-size:12px"></i> 24h</div></div><div class="post-actions"><i class="ti ti-heart" aria-label="Like"></i><i class="ti ti-message-circle" aria-hidden="true"></i><i class="ti ti-flame" aria-hidden="true"></i><i class="ti ti-send send-btn" aria-hidden="true"></i></div><div class="post-likes">0 Likes</div><div class="post-caption"><span>${username}</span> ${caption}</div>`;
  feed.prepend(post);
}

function renderPost(postData) {
  const post = document.createElement('div');
  post.className = 'post';
  const content = postData.image_url
    ? `<img src="${postData.image_url}" alt="Snap Bild" />`
    : `<span>${postData.emoji || 'ðŸ“¸'}</span>`;
  post.innerHTML = `<div class="post-header"><div class="post-avatar" style="background:#E6F1FB;">ðŸ˜Š</div><div><div class="post-user">${postData.username || 'du'}</div><div class="post-time">${postData.timeLabel || 'gerade eben'}</div></div><i class="ti ti-dots post-more" aria-hidden="true"></i></div><div class="post-img ${postData.image_url ? 'real-image' : ''}">${content}<div class="snap-badge"><i class="ti ti-clock" aria-hidden="true" style="font-size:12px"></i> 24h</div></div><div class="post-actions"><i class="ti ti-heart" aria-label="Like"></i><i class="ti ti-message-circle" aria-hidden="true"></i><i class="ti ti-flame" aria-hidden="true"></i><i class="ti ti-send send-btn" aria-hidden="true"></i></div><div class="post-likes">0 Likes</div><div class="post-caption"><span>${postData.username || 'du'}</span> ${postData.caption || ''}</div>`;
  return post;
}

function getLocalPosts() {
  try {
    const raw = localStorage.getItem(LOCAL_POSTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalPost(post) {
  const posts = getLocalPosts();
  posts.unshift(post);
  localStorage.setItem(LOCAL_POSTS_KEY, JSON.stringify(posts.slice(0, 100)));
}

function removeLocalPost(localId) {
  const posts = getLocalPosts().filter(p => p.id !== localId);
  localStorage.setItem(LOCAL_POSTS_KEY, JSON.stringify(posts));
}

function loadLocalPostsIntoFeed() {
  const feed = document.querySelector('.feed');
  if (!feed) return;
  feed.querySelectorAll('.post[data-own-post="true"]').forEach(node => node.remove());
  const posts = getLocalPosts();
  posts.slice().reverse().forEach(entry => {
    const uiPost = renderPost(entry);
    uiPost.dataset.ownPost = 'true';
    feed.prepend(uiPost);
  });
}

function getProfilePosts() {
  return getLocalPosts();
}

function renderProfileFromPosts() {
  const posts = getProfilePosts();
  const profileGrid = document.getElementById('profile-grid');
  if (!profileGrid) return;
  profileGrid.innerHTML = '';

  posts.forEach(post => {
    const item = document.createElement('div');
    item.className = `profile-post ${post.image_url ? 'real-image' : ''}`;
    item.innerHTML = post.image_url
      ? `<img src="${post.image_url}" alt="Profilbild-Post" />`
      : `${post.emoji || 'ðŸ“¸'}`;
    const removeBtn = document.createElement('button');
    removeBtn.className = 'profile-post-delete';
    removeBtn.textContent = 'Ã—';
    removeBtn.onclick = async (event) => {
      event.stopPropagation();
      await deleteProfilePost(post);
    };
    item.appendChild(removeBtn);
    profileGrid.appendChild(item);
  });

  const postsCount = document.getElementById('profile-posts-count');
  if (postsCount) postsCount.textContent = String(posts.length);
  const followersCount = document.getElementById('profile-followers-count');
  if (followersCount && !followersCount.textContent.trim()) followersCount.textContent = '0';
  const followingCount = document.getElementById('profile-following-count');
  if (followingCount && !followingCount.textContent.trim()) followingCount.textContent = '0';
}

async function deleteProfilePost(post) {
  if (!confirm('Diesen Post lÃ¶schen?')) return;
  if (post.id && !String(post.id).startsWith('local-')) {
    await supabaseDB.deletePostAndImage(post.id, post.image_url);
  }
  removeLocalPost(post.id);
  await loadOwnPostsIntoFeed();
  renderProfileFromPosts();
}

function getConversations() {
  try {
    const raw = localStorage.getItem(LOCAL_DM_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return [];
}

function saveConversations(list) {
  localStorage.setItem(LOCAL_DM_KEY, JSON.stringify(list));
}

function seedConversationsIfEmpty() {
  const current = getConversations();
  if (current.length) return;
  saveConversations([]);
}

function renderDmList() {
  const list = document.getElementById('dm-list');
  if (!list) return;
  const conversations = getConversations().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  list.innerHTML = '';
  conversations.forEach(conv => {
    const preview = conv.messages?.[conv.messages.length - 1]?.text || 'Noch keine Nachricht';
    const item = document.createElement('div');
    item.className = 'dm-item';
    item.innerHTML = `<div class="dm-avatar" style="background:${conv.avatarBg || '#E6F1FB'};">${conv.avatar || 'ðŸ™‚'}</div><div class="dm-info"><div class="dm-name">${conv.username}</div><div class="dm-preview">${preview}</div></div><div class="dm-meta"><div class="dm-time">jetzt</div></div>`;
    item.onclick = () => openChat(conv.username, conv.avatar || 'ðŸ™‚', conv.avatarBg || '#E6F1FB');
    list.appendChild(item);
  });
}

async function loadOwnPostsIntoFeed() {
  if (!currentUser) return;
  const feed = document.querySelector('.feed');
  if (!feed) return;
  loadLocalPostsIntoFeed();
  const posts = await supabaseDB.getUserPosts(currentUser.id);
  if (!posts.length) return;

  const username = localStorage.getItem('snapgram_username') || 'du';
  const synced = posts.map(entry => ({
    id: entry.id,
    caption: entry.caption || '',
    emoji: entry.emoji || 'ðŸ“¸',
    image_url: entry.image_url || null,
    username,
    timeLabel: 'gerade eben'
  }));
  localStorage.setItem(LOCAL_POSTS_KEY, JSON.stringify(synced));
  const existing = feed.querySelectorAll('.post[data-own-post="true"]');
  existing.forEach(node => node.remove());

  synced.slice().reverse().forEach(entry => {
    const uiPost = renderPost(entry);
    uiPost.dataset.ownPost = 'true';
    feed.prepend(uiPost);
  });
  renderProfileFromPosts();
}

function goTo(screen) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(`screen-${screen}`)?.classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelector(`button[onclick="goTo('${screen}')"]`)?.classList.add('active');
  if (screen === 'camera') {
    startLiveCamera();
  } else {
    stopLiveCamera();
  }
  if (screen === 'profile') {
    renderProfileFromPosts();
  }
  if (screen === 'dms') {
    renderDmList();
  }
  if (screen === 'search') {
    handleUserSearch();
  }
}

function toggleSettingsMenu(show) {
  document.getElementById('settingsOverlay')?.classList.toggle('show', show);
}

async function handleDeleteAccount() {
  if (!currentUser?.id) return;
  if (!confirm('Konto wirklich lÃ¶schen? Alle Bilder und Posts werden gelÃ¶scht.')) return;
  const ok = await supabaseDB.deleteAccountAndData(currentUser.id);
  if (!ok) {
    alert('Konto konnte in Supabase nicht komplett gelÃ¶scht werden. Du wirst trotzdem lokal abgemeldet.');
    await handleLogout();
    return;
  }
  localStorage.removeItem('snapgram_user');
  localStorage.removeItem('snapgram_username');
  localStorage.removeItem('snapgram_name');
  localStorage.removeItem(LOCAL_POSTS_KEY);
  localStorage.removeItem(LOCAL_DM_KEY);
  toggleSettingsMenu(false);
  currentUser = null;
  goTo('auth');
}

async function handleUserSearch() {
  const results = document.getElementById('search-results');
  if (!results) return;
  const query = document.getElementById('search-input')?.value?.trim() || '';
  results.innerHTML = '';
  if (!query) return;

  let users = [];
  if (supabaseDB.isConnected()) {
    users = await supabaseDB.searchUsers(query);
  }

  users
    .filter(u => u.username !== (localStorage.getItem('snapgram_username') || ''))
    .forEach(user => {
      const item = document.createElement('div');
      item.className = 'dm-item';
      item.innerHTML = `<div class="dm-avatar" style="background:#E6F1FB;">${user.avatar_url || 'ðŸ™‚'}</div><div class="dm-info"><div class="dm-name">${user.username}</div><div class="dm-preview">${user.name || 'SnapGram User'}</div></div>`;
      item.onclick = () => openChat(user.username, user.avatar_url || 'ðŸ™‚', '#E6F1FB');
      results.appendChild(item);
    });
}

function showSnap(emoji) {
  document.getElementById('snapEmoji').textContent = emoji;
  document.getElementById('snapOverlay').classList.add('show');
}

function hideSnap() {
  document.getElementById('snapOverlay').classList.remove('show');
}

function toggleLike(hId, lId) {
  const h = document.getElementById(hId);
  const l = document.getElementById(lId);
  const liked = h.classList.toggle('liked');
  const n = parseInt(l.textContent.replace(/\D/g, ''), 10);
  l.textContent = `${(liked ? n + 1 : n - 1).toLocaleString('de-DE')} Likes`;
}

function toggleAuthForm() {
  document.getElementById('login-form').classList.toggle('hidden');
  document.getElementById('register-form').classList.toggle('hidden');
  clearAuthMessage();
}

function showAuthMessage(message, isError = false) {
  const msg = document.getElementById('auth-message');
  msg.textContent = message;
  msg.className = `auth-message ${isError ? 'error' : 'success'}`;
}

function clearAuthMessage() {
  const msg = document.getElementById('auth-message');
  msg.className = 'auth-message';
  msg.textContent = '';
}

async function handleLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value.trim();
  if (!username || !password) return showAuthMessage('Nutzername und Passwort erforderlich', true);
  showAuthMessage('Anmelden...');
  if (!supabaseDB.isConnected()) {
    currentUser = { id: `demo-${username}`, username };
    localStorage.setItem('snapgram_user', currentUser.id);
    localStorage.setItem('snapgram_username', username);
    showAuthMessage('Demo-Login aktiv');
    return setTimeout(() => goTo('feed'), 250);
  }
  const result = await supabaseDB.signIn(username, password);
  if (!result.success) return showAuthMessage(result.error || 'Anmeldung fehlgeschlagen', true);
  currentUser = result.user;
  localStorage.setItem('snapgram_user', result.user.id);
  localStorage.setItem('snapgram_username', result.user.username || username);
  showAuthMessage('Erfolgreich angemeldet');
  setTimeout(async () => {
    goTo('feed');
    await loadOwnPostsIntoFeed();
  }, 250);
}

async function handleRegister() {
  const firstname = document.getElementById('register-firstname').value.trim();
  const lastname = document.getElementById('register-lastname').value.trim();
  const username = document.getElementById('register-username').value.trim();
  const password = document.getElementById('register-password').value.trim();
  if (!firstname || !lastname || !username || !password) return showAuthMessage('Alle Felder erforderlich', true);
  if (password.length < 6) return showAuthMessage('Passwort muss mindestens 6 Zeichen haben', true);
  showAuthMessage('Registriere Konto...');
  if (!supabaseDB.isConnected()) {
    currentUser = { id: `demo-${username}`, username };
    localStorage.setItem('snapgram_user', currentUser.id);
    localStorage.setItem('snapgram_username', username);
    localStorage.setItem('snapgram_name', `${firstname} ${lastname}`);
    showAuthMessage('Demo-Registrierung aktiv');
    return setTimeout(() => goTo('feed'), 250);
  }
  const result = await supabaseDB.signUp(username, password, `${firstname} ${lastname}`);
  if (!result.success) return showAuthMessage(result.error || 'Registrierung fehlgeschlagen', true);
  currentUser = result.user;
  localStorage.setItem('snapgram_user', result.user.id);
  localStorage.setItem('snapgram_username', result.user.username || username);
  localStorage.setItem('snapgram_name', `${firstname} ${lastname}`);
  showAuthMessage('Konto erstellt');
  setTimeout(async () => {
    goTo('feed');
    await loadOwnPostsIntoFeed();
  }, 250);
}

async function handleLogout() {
  toggleSettingsMenu(false);
  await supabaseDB.signOut();
  localStorage.removeItem('snapgram_user');
  localStorage.removeItem('snapgram_username');
  localStorage.removeItem('snapgram_name');
  currentUser = null;
  document.getElementById('login-username').value = '';
  document.getElementById('login-password').value = '';
  goTo('auth');
}

function loadProfile() {
  const username = localStorage.getItem('snapgram_username') || 'deinusername';
  const name = localStorage.getItem('snapgram_name') || 'Dein Name';
  document.getElementById('profile-name').textContent = name;
  document.getElementById('profile-username').textContent = `@${username}`;
}

async function checkAuth() {
  const authUser = await supabaseDB.getCurrentUser();
  if (authUser) {
    currentUser = authUser;
    localStorage.setItem('snapgram_user', authUser.id);
    localStorage.setItem('snapgram_username', authUser.username || '');
    goTo('feed');
    await loadOwnPostsIntoFeed();
    return;
  }
  const userId = localStorage.getItem('snapgram_user');
  const savedUsername = localStorage.getItem('snapgram_username');
  if (userId && savedUsername) {
    currentUser = { id: userId, username: savedUsername };
    goTo('feed');
    await loadOwnPostsIntoFeed();
    return;
  }
  goTo('auth');
}

function openChat(name, emoji, bg) {
  document.getElementById('chat-name').textContent = name;
  const av = document.getElementById('chat-avatar');
  av.textContent = emoji;
  av.style.background = bg;
  const msgs = document.getElementById('chat-messages');
  msgs.innerHTML = '';
  const conv = getConversations().find(x => x.username === name);
  const messages = conv?.messages || [];
  if (!messages.length) {
    msgs.appendChild(Object.assign(document.createElement('div'), { className: 'msg them', textContent: 'Chat ist bereit.' }));
  } else {
    messages.forEach(message => {
      const node = document.createElement('div');
      node.className = `msg ${message.from === 'me' ? 'me' : 'them'}`;
      node.textContent = message.text;
      msgs.appendChild(node);
    });
  }
  const list = getConversations();
  if (!list.find(x => x.username === name)) {
    list.push({ username: name, avatar: emoji || 'ðŸ™‚', avatarBg: bg || '#E6F1FB', messages: [], updatedAt: Date.now() });
    saveConversations(list);
  }
  goTo('chat');
}

function sendMsg(event) {
  if (event.key !== 'Enter') return;
  sendMsgClick();
}

function sendMsgClick() {
  const input = document.getElementById('chat-input');
  const value = input.value.trim();
  if (!value) return;
  const msg = document.createElement('div');
  msg.className = 'msg me';
  msg.textContent = value;
  document.getElementById('chat-messages').appendChild(msg);
  const chatName = document.getElementById('chat-name').textContent.trim();
  if (chatName) {
    const list = getConversations();
    let conv = list.find(x => x.username === chatName);
    if (!conv) {
      conv = { username: chatName, avatar: 'ðŸ™‚', avatarBg: '#E6F1FB', messages: [], updatedAt: Date.now() };
      list.push(conv);
    }
    conv.messages.push({ from: 'me', text: value });
    conv.updatedAt = Date.now();
    saveConversations(list);
  }
  input.value = '';
}

document.addEventListener('DOMContentLoaded', () => {
  const splash = document.getElementById('app-splash');
  window.setTimeout(() => splash?.classList.add('is-hidden'), 1500);
  window.setTimeout(() => splash?.remove(), 1900);
  initFilters();
  document.getElementById('filters-row').style.display = 'none';
  loadProfile();
  renderProfileFromPosts();
  seedConversationsIfEmpty();
  renderDmList();
  checkAuth();
});

