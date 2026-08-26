import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('get-child-session called')

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Non autorisé' }),
        { status: 401, headers: corsHeaders }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    // Vérifier le parent
    const { data: { user: parentUser }, error: authError } =
      await adminClient.auth.getUser(token)

    console.log('parentUser:', parentUser?.id, 'error:', authError?.message)

    if (authError || !parentUser) {
      return new Response(
        JSON.stringify({ error: 'Non autorisé' }),
        { status: 401, headers: corsHeaders }
      )
    }

    const body = await req.json()
    const { childId } = body
    console.log('childId:', childId)

    if (!childId) {
      return new Response(
        JSON.stringify({ error: 'childId requis' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Vérifier lien parent-enfant
    const { data: link, error: linkError } = await adminClient
      .from('parent_child')
      .select('child_id')
      .eq('parent_id', parentUser.id)
      .eq('child_id', childId)
      .single()

    console.log('link:', link, 'linkError:', linkError?.message)

    if (!link) {
      return new Response(
        JSON.stringify({ error: 'Enfant non lié' }),
        { status: 403, headers: corsHeaders }
      )
    }

    // Récupérer email de l'enfant via API REST admin
    const userResponse = await fetch(
      `${supabaseUrl}/auth/v1/admin/users/${childId}`,
      {
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey,
        },
      }
    )
    const childUser = await userResponse.json()
    console.log('childUser email:', childUser.email)

    if (!childUser.email) {
      return new Response(
        JSON.stringify({ error: 'Email enfant introuvable' }),
        { status: 404, headers: corsHeaders }
      )
    }

    // Générer OTP via API REST admin
    const otpResponse = await fetch(
      `${supabaseUrl}/auth/v1/admin/generate_link`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'magiclink',
          email: childUser.email,
        }),
      }
    )
    const otpData = await otpResponse.json()
    console.log('otpData keys:', Object.keys(otpData))
    const hashedToken = otpData.hashed_token || otpData.properties?.hashed_token
    console.log('hashed_token exists:', !!hashedToken)

    if (!hashedToken) {
      return new Response(
        JSON.stringify({ error: 'Erreur OTP: ' + JSON.stringify(otpData) }),
        { status: 500, headers: corsHeaders }
      )
    }

    // Vérifier OTP via API REST
    const verifyResponse = await fetch(
      `${supabaseUrl}/auth/v1/verify`,
      {
        method: 'POST',
        headers: {
          'apikey': anonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'magiclink',
          token_hash: hashedToken,
        }),
      }
    )
    const verifyData = await verifyResponse.json()
    console.log('verifyData keys:', Object.keys(verifyData))
    console.log('has access_token:', !!verifyData.access_token)

    if (!verifyData.access_token) {
      return new Response(
        JSON.stringify({ error: 'Verify failed: ' + JSON.stringify(verifyData) }),
        { status: 500, headers: corsHeaders }
      )
    }

    return new Response(
      JSON.stringify({
        access_token: verifyData.access_token,
        refresh_token: verifyData.refresh_token,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('Unhandled error:', String(err))
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: corsHeaders }
    )
  }
})
