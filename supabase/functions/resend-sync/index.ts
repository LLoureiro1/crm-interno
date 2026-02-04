/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const AUDIENCE_ID = Deno.env.get("RESEND_AUDIENCE_ID");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const { type, record, old_record } = payload;

    console.log(`Processing ${type} event for student ID: ${record?.id}`);

    // Basic validation
    if (!record || !record.email) {
      console.log('Skipping: No record or email found');
      return new Response(
        JSON.stringify({ message: 'No email found in record' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Check configuration
    if (!AUDIENCE_ID) {
      console.error("RESEND_AUDIENCE_ID is not set");
      return new Response(
        JSON.stringify({ error: 'RESEND_AUDIENCE_ID not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const email = record.email;
    const name = record.student_name || "";
    const status = record.status;
    
    // Split name into first and last name for Resend
    // Logic: First word is firstName, rest is lastName
    const nameParts = name.trim().split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    let shouldSync = false;

    if (type === 'INSERT') {
      shouldSync = true;
      console.log(`New student inserted: ${email}`);
    } else if (type === 'UPDATE') {
      // Check if relevant fields changed
      // Note: We use optional chaining just in case old_record is missing on some updates (though unusual for UPDATE trigger)
      const statusChanged = record.status !== old_record?.status;
      const emailChanged = record.email !== old_record?.email;
      const nameChanged = record.student_name !== old_record?.student_name;

      if (statusChanged || emailChanged || nameChanged) {
        shouldSync = true;
        console.log(`Student updated: ${email} (Status changed: ${statusChanged})`);
      } else {
        console.log('Update ignored: No relevant changes');
      }
    }

    if (shouldSync) {
      console.log(`Syncing ${email} to Resend Audience ${AUDIENCE_ID}...`);
      
      const { data, error } = await resend.contacts.create({
        audienceId: AUDIENCE_ID,
        email: email,
        firstName: firstName,
        lastName: lastName,
        unsubscribed: false,
        // Sync the status as a custom attribute (must be defined in Resend Audience if strict schema is used)
        data: {
            student_status: status
        }
      });

      if (error) {
        console.error('Resend API Error:', error);
        throw error;
      }

      console.log('Resend Sync Success:', data);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Unexpected Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
