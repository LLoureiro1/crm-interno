/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getBearerToken(req: Request): string | null {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7).trim();
}

function isServiceRoleToken(token: string): boolean {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return serviceKey.length > 0 && token === serviceKey;
}

async function parseJsonBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const text = await req.text();
    if (!text.trim()) return {};
    const parsed = JSON.parse(text);
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function jsonError(error: string, status: number): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

type AuthResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; status: number; error: string };

async function authorizeServiceRoleOnly(req: Request): Promise<AuthResult> {
  const token = getBearerToken(req);
  if (!token) {
    return { ok: false, status: 401, error: 'Authorization required' };
  }

  if (!isServiceRoleToken(token)) {
    return { ok: false, status: 403, error: 'Service role required' };
  }

  const body = await parseJsonBody(req);
  return { ok: true, body };
}

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const AUDIENCE_ID = Deno.env.get("RESEND_AUDIENCE_ID");

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const auth = await authorizeServiceRoleOnly(req);

    if (!auth.ok) {
      return jsonError(auth.error, auth.status);
    }

    const payload = auth.body;
    const { type, record, old_record } = payload as {
      type?: string;
      record?: { id?: string; email?: string; student_name?: string; status?: string };
      old_record?: { status?: string; email?: string; student_name?: string };
    };

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
