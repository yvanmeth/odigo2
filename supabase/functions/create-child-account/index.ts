import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders })
    }

    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Non autorisé' }),
        { status: 401, headers: corsHeaders }
      )
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Non autorisé' }),
        { status: 401, headers: corsHeaders }
      )
    }

    const { data: profile } = await userClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'parent') {
      return new Response(
        JSON.stringify({ error: 'Réservé aux parents' }),
        { status: 403, headers: corsHeaders }
      )
    }

    const { firstName, password, relationship } = await req.json()

    if (!firstName || !password) {
      return new Response(
        JSON.stringify({ error: 'Prénom et mot de passe requis' }),
        { status: 400, headers: corsHeaders }
      )
    }

    const randomSuffix = Math.random().toString(36).substring(2, 8)
    const fakeEmail = `${firstName.toLowerCase().replace(/[^a-z0-9]/g, '')}-${randomSuffix}@children.odigo.app`

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: fakeEmail,
      password,
      email_confirm: true,
      user_metadata: { first_name: firstName },
    })

    if (createError || !newUser.user) {
      return new Response(
        JSON.stringify({ error: createError?.message || 'Erreur création' }),
        { status: 500, headers: corsHeaders }
      )
    }

    const childId = newUser.user.id

    await adminClient.from('profiles').insert({
      id: childId,
      first_name: firstName,
      role: 'child',
      has_met_odigo: false,
    })

    await adminClient.from('parent_child').insert({
      parent_id: user.id,
      child_id: childId,
      relationship: relationship || 'parent',
    })

    return new Response(
      JSON.stringify({ success: true, childId, email: fakeEmail }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('Unhandled error:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: corsHeaders }
    )
  }
})
