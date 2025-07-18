import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get yesterday's date
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    // Find students with interview scheduled for yesterday and status still "atendimento_agendado"
    const { data: studentsWithMissedInterviews, error: fetchError } = await supabaseClient
      .from('students')
      .select('id, student_name, interview_date')
      .eq('status', 'atendimento_agendado')
      .eq('interview_date', yesterdayStr)

    if (fetchError) {
      throw fetchError
    }

    // Update status to "faltou_ao_atendimento" for these students
    if (studentsWithMissedInterviews && studentsWithMissedInterviews.length > 0) {
      const { error: updateError } = await supabaseClient
        .from('students')
        .update({ status: 'faltou_ao_atendimento' })
        .in('id', studentsWithMissedInterviews.map(s => s.id))

      if (updateError) {
        throw updateError
      }

      // Add interaction records for each student
      const interactions = studentsWithMissedInterviews.map(student => ({
        student_id: student.id,
        interaction_type: 'mudanca_status',
        comments: `Status automaticamente alterado para "Faltou ao Atendimento" - entrevista agendada para ${new Date(student.interview_date).toLocaleDateString('pt-BR')} não foi registrada.`
      }))

      const { error: interactionError } = await supabaseClient
        .from('student_interactions')
        .insert(interactions)

      if (interactionError) {
        console.error('Error inserting interactions:', interactionError)
      }

      return new Response(
        JSON.stringify({ 
          message: `Updated ${studentsWithMissedInterviews.length} students to "faltou_ao_atendimento"`,
          updated_students: studentsWithMissedInterviews.length
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }

    return new Response(
      JSON.stringify({ message: 'No missed interviews found' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})