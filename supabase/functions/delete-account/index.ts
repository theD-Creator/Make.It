import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authorization = request.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!authorization?.startsWith("Bearer ") || !supabaseUrl || !anonKey || !serviceKey) {
    return json({ error: "Unauthorized" }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const authUserId = authData.user.id;

  try {
    const { data: profile, error: profileError } = await admin
      .from("users")
      .select("id")
      .eq("auth_user_id", authUserId)
      .maybeSingle();
    if (profileError) throw profileError;

    if (profile?.id) {
      const { data: files, error: listError } = await admin.storage
        .from("snapgram-images")
        .list(authUserId, { limit: 1000 });
      if (listError) throw listError;
      const paths = (files || [])
        .filter((file) => file.id)
        .map((file) => `${authUserId}/${file.name}`);
      if (paths.length) {
        const { error } = await admin.storage.from("snapgram-images").remove(paths);
        if (error) throw error;
      }

      const { error: messagesError } = await admin
        .from("messages")
        .delete()
        .or(`sender_id.eq.${profile.id},recipient_id.eq.${profile.id}`);
      if (messagesError) throw messagesError;

      const { error: followersError } = await admin
        .from("followers")
        .delete()
        .or(`user_id.eq.${profile.id},follower_id.eq.${profile.id}`);
      if (followersError) throw followersError;

      const { error: postsError } = await admin.from("posts").delete().eq("user_id", profile.id);
      if (postsError) throw postsError;

      const { error: profileDeleteError } = await admin.from("users").delete().eq("id", profile.id);
      if (profileDeleteError) throw profileDeleteError;
    }

    const { error: deleteUserError } = await admin.auth.admin.deleteUser(authUserId);
    if (deleteUserError) throw deleteUserError;
    return json({ success: true });
  } catch (error) {
    console.error("Account deletion failed", error);
    return json({ error: "Account deletion failed" }, 500);
  }
});
