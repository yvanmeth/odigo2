import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Non autorisé' }),
        { status: 401 }
      )
    }

    // Client avec les droits de l'utilisateur connecté (vérifie l'identité)
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Non autorisé' }),
        { status: 401 }
      )
    }

    // Client admin pour supprimer le compte (service role key)
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // La suppression auth cascade sur toutes les tables liées (ON DELETE CASCADE)
    const { error: deleteError } = await adminClient.auth.admin
      .deleteUser(user.id)

    if (deleteError) {
      return new Response(
        JSON.stringify({ error: deleteError.message }),
        { status: 500 }
      )
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch {
    return new Response(
      JSON.stringify({ error: 'Erreur serveur' }),
      { status: 500 }
    )
  }
})
