const SUPABASE_URL = 'https://iymxywnwxjziewjnfgto.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXh5d253eGp6aWV3am5mZ3RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMDI0NjgsImV4cCI6MjA5NDc3ODQ2OH0.aHxFP6VDOIejqCaun8-dGVZa7aQ7cwvQme9wDIZled4';

let client = null;
const SESSION_KEY = 'snapgram_session';

function initSupabase() {
  if (!window.supabase) return false;
  const { createClient } = window.supabase;
  client = createClient(SUPABASE_URL, SUPABASE_KEY);
  return true;
}

async function hashPassword(password, username) {
  const source = `${username}::${password}`;
  const bytes = new TextEncoder().encode(source);
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hashBuffer)).map(x => x.toString(16).padStart(2, '0')).join('');
}

function saveSession(user) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    id: user.id,
    username: user.username,
    name: user.name || ''
  }));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

async function signUp(username, password, name) {
  if (!client) return { success: false, error: 'Keine Supabase-Verbindung' };
  try {
    const cleanUsername = username.trim().toLowerCase();
    const passwordHash = await hashPassword(password, cleanUsername);

    const { data: existing, error: existingError } = await client
      .from('users')
      .select('id')
      .eq('username', cleanUsername)
      .maybeSingle();

    if (existingError) return { success: false, error: existingError.message };
    if (existing) return { success: false, error: 'Nutzername ist schon vergeben' };

    const { data, error } = await client
      .from('users')
      .insert([{
        username: cleanUsername,
        name,
        avatar_url: '😊',
        password_hash: passwordHash
      }])
      .select('id, username, name')
      .single();

    if (error) return { success: false, error: error.message };
    saveSession(data);
    return { success: true, user: data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function signIn(username, password) {
  if (!client) return { success: false, error: 'Keine Supabase-Verbindung' };
  try {
    const cleanUsername = username.trim().toLowerCase();
    const passwordHash = await hashPassword(password, cleanUsername);

    const { data, error } = await client
      .from('users')
      .select('id, username, name, password_hash')
      .eq('username', cleanUsername)
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    if (!data || data.password_hash !== passwordHash) {
      return { success: false, error: 'Nutzername oder Passwort falsch' };
    }

    const user = { id: data.id, username: data.username, name: data.name || '' };
    saveSession(user);
    return { success: true, user };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function signOut() {
  clearSession();
  return true;
}

async function getCurrentUser() {
  if (!client) return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session?.id) return null;

    const { data, error } = await client
      .from('users')
      .select('id, username, name')
      .eq('id', session.id)
      .maybeSingle();

    if (error || !data) {
      clearSession();
      return null;
    }
    return data;
  } catch {
    clearSession();
    return null;
  }
}

async function getUserProfile(userId) {
  if (!client) return null;
  const { data, error } = await client.from('users').select('*').eq('id', userId).single();
  if (error) return null;
  return data;
}

async function updateUserProfile(userId, updates) {
  if (!client) return false;
  const { error } = await client.from('users').update(updates).eq('id', userId);
  return !error;
}

async function getUserPosts(userId) {
  if (!client) return [];
  const { data, error } = await client.from('posts').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (error) return [];
  return data || [];
}

function decodeBase64(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function createPost(userId, caption, emoji) {
  if (!client) return null;
  let imageUrl = null;
  try {
    if (arguments[3]) {
      const rawDataUrl = arguments[3];
      const mimeMatch = rawDataUrl.match(/^data:(.*?);base64,/);
      const mimeType = mimeMatch?.[1] || 'image/jpeg';
      const base64Data = rawDataUrl.split(',')[1];
      const fileName = arguments[4] || `snap-${Date.now()}.jpg`;
      const imagePath = `${userId}/${Date.now()}-${fileName.replace(/\s+/g, '-')}`;
      const { error: uploadError } = await client.storage
        .from('snapgram-images')
        .upload(imagePath, decodeBase64(base64Data), { upsert: true, contentType: mimeType });
      if (!uploadError) {
        const { data: urlData } = client.storage.from('snapgram-images').getPublicUrl(imagePath);
        imageUrl = urlData.publicUrl;
      } else {
        imageUrl = rawDataUrl;
      }
    }
    const { data, error } = await client.from('posts').insert([{ user_id: userId, caption, emoji, image_url: imageUrl }]);
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

async function getFollowers(userId) {
  if (!client) return 0;
  const { count, error } = await client.from('followers').select('*', { count: 'exact' }).eq('user_id', userId);
  if (error) return 0;
  return count || 0;
}

async function followUser(userId, targetUserId) {
  if (!client) return false;
  const { error } = await client.from('followers').insert([{ user_id: targetUserId, follower_id: userId }]);
  return !error;
}

function extractStoragePathFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const marker = '/storage/v1/object/public/snapgram-images/';
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.substring(idx + marker.length));
}

async function searchUsers(query) {
  if (!client) return [];
  const term = (query || '').trim().toLowerCase();
  if (!term) return [];
  const { data, error } = await client
    .from('users')
    .select('id, username, name, avatar_url')
    .ilike('username', `%${term}%`)
    .limit(20);
  if (error) return [];
  return data || [];
}

async function deletePostAndImage(postId, imageUrl) {
  if (!client) return false;
  try {
    const storagePath = extractStoragePathFromUrl(imageUrl);
    if (storagePath) {
      await client.storage.from('snapgram-images').remove([storagePath]);
    }
    const { error } = await client.from('posts').delete().eq('id', postId);
    return !error;
  } catch {
    return false;
  }
}

async function deleteAccountAndData(userId) {
  if (!client) return false;
  try {
    const { data: posts } = await client.from('posts').select('id, image_url').eq('user_id', userId);
    const storagePaths = (posts || [])
      .map(p => extractStoragePathFromUrl(p.image_url))
      .filter(Boolean);
    if (storagePaths.length) {
      await client.storage.from('snapgram-images').remove(storagePaths);
    }
    await client.from('posts').delete().eq('user_id', userId);
    await client.from('followers').delete().eq('user_id', userId);
    await client.from('followers').delete().eq('follower_id', userId);
    await client.from('messages').delete().eq('sender_id', userId);
    const { error } = await client.from('users').delete().eq('id', userId);
    clearSession();
    return !error;
  } catch {
    try {
      const { error } = await client.from('users').delete().eq('id', userId);
      clearSession();
      return !error;
    } catch {
      return false;
    }
  }
}

window.supabaseDB = {
  signUp,
  signIn,
  signOut,
  getCurrentUser,
  getUserProfile,
  updateUserProfile,
  getUserPosts,
  createPost,
  searchUsers,
  deletePostAndImage,
  deleteAccountAndData,
  getFollowers,
  followUser,
  isConnected: () => client !== null
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSupabase);
} else {
  initSupabase();
}
