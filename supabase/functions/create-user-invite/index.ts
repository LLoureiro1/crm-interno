/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface CreateUserRequest {
  name: string;
  email: string;
  profile: 'admin' | 'direcao' | 'entrevistador' | 'padrao';
  unit_id?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }

  try {
    // Create admin client with service role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Create regular client to verify the requesting user
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    
    if (authError || !user) {
      console.error('Authentication error:', authError?.message)
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid or missing authentication token' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check if the user has admin permissions
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('profile')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || profile.profile !== 'admin') {
      console.error('Permission error:', profileError?.message, 'User profile:', profile?.profile)
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions. Only admin users can create new users.' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Parse request body
    let requestBody: CreateUserRequest;
    try {
      requestBody = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const { name, email, profile: userProfile, unit_id } = requestBody;

    // Validate required fields
    if (!name?.trim() || !email?.trim() || !userProfile) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: name, email, profile' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validate profile value
    const validProfiles = ['admin', 'direcao', 'entrevistador', 'padrao'];
    if (!validProfiles.includes(userProfile)) {
      return new Response(
        JSON.stringify({ error: 'Invalid profile. Must be one of: ' + validProfiles.join(', ') }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`Checking for existing user with email: ${email.toLowerCase().trim()}`)
    
    // Check if user already exists in auth system
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const authUserExists = existingUsers.users.some(u => u.email === email.toLowerCase().trim())
    
    console.log(`Auth user exists: ${authUserExists}`)
    
    // Check if profile already exists
    const { data: existingProfile, error: profileCheckError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, name')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle()
    
    if (profileCheckError) {
      console.error('Error checking for existing profile:', profileCheckError)
    }
    
    console.log(`Profile exists: ${!!existingProfile}`, existingProfile ? `Profile data: ${JSON.stringify(existingProfile)}` : '')
    
    // If user exists in auth but not in profiles, it's an orphaned user
    if (authUserExists && !existingProfile) {
      const orphanedUser = existingUsers.users.find(u => u.email === email.toLowerCase().trim())
      if (orphanedUser) {
        console.log(`Cleaning up orphaned auth user: ${orphanedUser.id} (${orphanedUser.email})`)
        try {
          await supabaseAdmin.auth.admin.deleteUser(orphanedUser.id)
          console.log(`Successfully deleted orphaned user: ${orphanedUser.id}`)
        } catch (deleteError) {
          console.error(`Failed to delete orphaned user: ${deleteError}`)
        }
      }
    }
    
    // If profile exists, user is fully created
    if (existingProfile) {
      console.log(`User already exists - returning 409 error`)
      return new Response(
        JSON.stringify({ error: 'User with this email already exists' }),
        { 
          status: 409, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
    
    console.log(`No existing user found - proceeding with user creation`)

    // Create the user with admin privileges
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      email_confirm: false, // User will confirm via invite
      user_metadata: {
        name: name,
        profile: userProfile,
        unit_id: unit_id || null
      }
    })

    if (createError) {
      console.error('Error creating user:', createError.message, createError)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create user: ' + createError.message,
          details: createError.code || 'unknown_error'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!authData.user) {
      return new Response(
        JSON.stringify({ error: 'Failed to create user: no user data returned' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Create profile in the profiles table with better error handling
    const { error: profileCreateError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authData.user.id,
        name: name,
        email: email.toLowerCase().trim(),
        profile: userProfile,
        unit_id: unit_id || null
      })

    if (profileCreateError) {
      console.error('Error creating profile:', profileCreateError.message, profileCreateError)
      
      // Enhanced rollback: delete the auth user if profile creation failed
      try {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
        console.log(`Rolled back auth user: ${authData.user.id}`)
      } catch (rollbackError) {
        console.error('Failed to rollback auth user:', rollbackError)
      }
      
      // Return more specific error message
      if (profileCreateError.code === '23505') {
        return new Response(
          JSON.stringify({ error: 'User profile already exists. Please try again.' }),
          { 
            status: 409, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
      
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create user profile: ' + profileCreateError.message,
          details: profileCreateError.code || 'unknown_error'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Generate invite link
    const origin = req.headers.get('origin') || req.headers.get('referer')?.split('/').slice(0, 3).join('/') || 'http://localhost:5173';
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email: email.toLowerCase().trim(),
      options: {
        redirectTo: `${origin}/set-password`
      }
    })

    if (inviteError) {
      console.error('Error generating invite link:', inviteError.message, inviteError)
      // Don't fail the entire operation if invite generation fails
      // The user was created successfully, just log the error
    }

    // Log successful user creation
    console.log(`User created successfully: ${email} by admin: ${user.email}`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'User created successfully and invite sent',
        user: {
          id: authData.user.id,
          email: authData.user.email,
          name: name,
          profile: userProfile,
          unit_id: unit_id
        },
        invite_link: inviteData?.properties?.action_link || null,
        invite_error: inviteError?.message || null
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
