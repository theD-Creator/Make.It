const SUPABASE_URL = 'https://iymxywnwxjziewjnfgto.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_l1oQDv-PGUN2ZiJA4KGzcQ_gEWPxJQV';

let client = null;

function initSupabase() {
  if (!window.supabase?.createClient) return false;
  client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  return true;
}

function profileFromRow(row) {
  if (!row) return null;
  const { auth_user_id: authUserId, ...profile } = row;
  return { ...profile, authUserId };
}

async function getProfileForAuthUser(authUser) {
  if (!client || !authUser?.id) return null;
  const { data, error } = await client
    .from('users')
    .select('id, username, name, bio, avatar_url, auth_user_id')
    .eq('auth_user_id', authUser.id)
    .maybeSingle();
  if (error || !data) return null;
  return profileFromRow(data);
}

async function signUp(email, password, username, name) {
  if (!client) return { success: false, error: 'Keine Supabase-Verbindung.' };
  const cleanEmail = email.trim().toLowerCase();
  const cleanUsername = username.trim().toLowerCase();

  try {
    const { data: existing, error: lookupError } = await client
      .from('users')
      .select('id')
      .eq('username', cleanUsername)
      .maybeSingle();
    if (lookupError) return { success: false, error: lookupError.message };
    if (existing) return { success: false, error: 'Dieser Nutzername ist bereits vergeben.' };

    const { data, error } = await client.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: { username: cleanUsername, full_name: name.trim() },
        emailRedirectTo: window.location.href.split('#')[0]
      }
    });

    if (error) return { success: false, error: error.message };
    if (!data.session) {
      return {
        success: true,
        needsEmailConfirmation: true,
        user: null
      };
    }

    const profile = await getProfileForAuthUser(data.user);
    if (!profile) {
      await client.auth.signOut();
      return { success: false, error: 'Das Profil konnte nicht angelegt werden. Bitte versuche es später erneut.' };
    }
    return { success: true, user: profile };
  } catch (error) {
    return { success: false, error: error?.message || 'Registrierung fehlgeschlagen.' };
  }
}

async function signIn(email, password) {
  if (!client) return { success: false, error: 'Keine Supabase-Verbindung.' };
  try {
    const { data, error } = await client.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password
    });
    if (error) return { success: false, error: error.message };
    const profile = await getProfileForAuthUser(data.user);
    if (!profile) {
      await client.auth.signOut();
      return { success: false, error: 'Dein Nutzerprofil fehlt. Bitte registriere dich erneut oder kontaktiere den Betreiber.' };
    }
    return { success: true, user: profile };
  } catch (error) {
    return { success: false, error: error?.message || 'Anmeldung fehlgeschlagen.' };
  }
}

async function signOut() {
  if (!client) return true;
  const { error } = await client.auth.signOut();
  return !error;
}

async function getCurrentUser() {
  if (!client) return null;
  try {
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return null;
    return await getProfileForAuthUser(data.user);
  } catch {
    return null;
  }
}

async function getUserProfile(userId) {
  if (!client) return null;
  const { data, error } = await client
    .from('users')
    .select('id, username, name, bio, avatar_url, followers_count, following_count, created_at')
    .eq('id', userId)
    .maybeSingle();
  return error ? null : data;
}

async function updateUserProfile(userId, updates) {
  if (!client) return false;
  const safeUpdates = {};
  for (const field of ['username', 'name', 'bio', 'avatar_url']) {
    if (Object.hasOwn(updates || {}, field)) safeUpdates[field] = updates[field];
  }
  const { error } = await client.from('users').update(safeUpdates).eq('id', userId);
  return !error;
}

async function getUserPosts(userId) {
  if (!client) return [];
  const { data, error } = await client
    .from('posts')
    .select('id, user_id, caption, image_url, emoji, likes_count, comments_count, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return error ? [] : (data || []);
}

function decodeDataUrl(dataUrl) {
  const match = /^data:([^;,]+);base64,([\s\S]+)$/.exec(dataUrl || '');
  if (!match) throw new Error('Das Bildformat ist ungültig.');
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return { bytes, mimeType: match[1] };
}

async function createPost(userId, caption, emoji, imageDataUrl, fileName, authUserId) {
  if (!client) return null;
  let imageUrl = null;
  let imagePath = null;

  try {
    if (imageDataUrl) {
      if (!authUserId) throw new Error('Supabase-Sitzung fehlt.');
      const { bytes, mimeType } = decodeDataUrl(imageDataUrl);
      const safeName = String(fileName || 'snap.jpg').replace(/[^a-zA-Z0-9._-]/g, '-');
      imagePath = `${authUserId}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await client.storage
        .from('snapgram-images')
        .upload(imagePath, bytes, { upsert: false, contentType: mimeType });
      if (uploadError) throw uploadError;
      imageUrl = client.storage.from('snapgram-images').getPublicUrl(imagePath).data.publicUrl;
    }

    const { data, error } = await client
      .from('posts')
      .insert({ user_id: userId, caption, emoji, image_url: imageUrl })
      .select('id, user_id, caption, image_url, emoji, created_at')
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    if (imagePath) await client.storage.from('snapgram-images').remove([imagePath]).catch(() => {});
    console.error('Supabase post creation failed:', error);
    return null;
  }
}

async function getFollowers(userId) {
  if (!client) return 0;
  const { count, error } = await client
    .from('followers')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  return error ? 0 : (count || 0);
}

async function followUser(userId, targetUserId) {
  if (!client) return false;
  const { error } = await client
    .from('followers')
    .insert({ user_id: targetUserId, follower_id: userId });
  return !error;
}

function extractStoragePathFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const marker = '/storage/v1/object/public/snapgram-images/';
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  try {
    return decodeURIComponent(url.substring(idx + marker.length));
  } catch {
    return url.substring(idx + marker.length);
  }
}

async function deletePostAndImage(postId, imageUrl) {
  if (!client) return false;
  try {
    const storagePath = extractStoragePathFromUrl(imageUrl);
    if (storagePath) {
      const { error: imageError } = await client.storage.from('snapgram-images').remove([storagePath]);
      if (imageError) return false;
    }
    const { error } = await client.from('posts').delete().eq('id', postId);
    return !error;
  } catch {
    return false;
  }
}

async function getConversation(userId, otherUserId) {
  if (!client) return { success: false, messages: [] };
  try {
    const filter = `and(sender_id.eq.${userId},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${userId})`;
    const { data, error } = await client
      .from('messages')
      .select('id, sender_id, recipient_id, text, created_at')
      .or(filter)
      .order('created_at', { ascending: true })
      .limit(200);
    if (error) return { success: false, messages: [] };
    return { success: true, messages: data || [] };
  } catch {
    return { success: false, messages: [] };
  }
}

async function sendMessage(senderId, recipientId, text) {
  if (!client) return { success: false };
  const { data, error } = await client
    .from('messages')
    .insert({ sender_id: senderId, recipient_id: recipientId, text: String(text).trim() })
    .select('id, sender_id, recipient_id, text, created_at')
    .single();
  return { success: !error, message: data || null, error: error?.message };
}

async function deleteAccountAndData() {
  if (!client) return false;
  const { error } = await client.functions.invoke('delete-account', { method: 'POST' });
  if (error) return false;
  await client.auth.signOut();
  return true;
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
  return error ? [] : (data || []);
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
  getConversation,
  sendMessage,
  getFollowers,
  followUser,
  isConnected: () => client !== null
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSupabase);
} else {
  initSupabase();
}
