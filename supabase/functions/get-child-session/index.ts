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
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Non autorisé' }),
        { status: 401, headers: corsHeaders }
      )
    }

    const token = authHeader.replace('Bearer ', '')

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Vérifier le parent
    const { data: { user: parentUser }, error: authError } =
      await adminClient.auth.getUser(token)

    if (authError || !parentUser) {
      return new Response(
        JSON.stringify({ error: 'Non autorisé' }),
        { status: 401, headers: corsHeaders }
      )
    }

    // Récupérer childId depuis le body
    const { childId } = await req.json()
    if (!childId) {
      return new Response(
        JSON.stringify({ error: 'childId requis' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Vérifier que le parent est bien lié à cet enfant
    const { data: link } = await adminClient
      .from('parent_child')
      .select('child_id')
      .eq('parent_id', parentUser.id)
      .eq('child_id', childId)
      .single()

    if (!link) {
      return new Response(
        JSON.stringify({ error: 'Enfant non lié à ce parent' }),
        { status: 403, headers: corsHeaders }
      )
    }

    // Récupérer l'email de l'enfant
    const { data: childData, error: childError } =
      await adminClient.auth.admin.getUserById(childId)

    if (childError || !childData.user?.email) {
      return new Response(
        JSON.stringify({ error: 'Enfant introuvable' }),
        { status: 404, headers: corsHeaders }
      )
    }

    // Générer le lien magique
    const { data: linkData, error: linkError } =
      await adminClient.auth.admin.generateLink({
        type: 'magiclink',
        email: childData.user.email,
      })

    if (linkError || !linkData?.properties?.hashed_token) {
      return new Response(
        JSON.stringify({ error: 'Erreur generateLink: ' + linkError?.message }),
        { status: 500, headers: corsHeaders }
      )
    }

    // Échanger le hashed_token contre une session côté serveur
    const { data: otpData, error: otpError } =
      await adminClient.auth.verifyOtp({
        token_hash: linkData.properties.hashed_token,
        type: 'magiclink',
      })

    if (otpError || !otpData?.session) {
      return new Response(
        JSON.stringify({ error: 'Erreur verifyOtp: ' + otpError?.message }),
        { status: 500, headers: corsHeaders }
      )
    }

    return new Response(
      JSON.stringify({
        access_token: otpData.session.access_token,
        refresh_token: otpData.session.refresh_token,
      }),
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
