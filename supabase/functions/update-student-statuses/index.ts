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

    const { source } = await req.json()
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const sevenDaysAgo = new Date(today.getTime() - (7 * 24 * 60 * 60 * 1000))
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]

    console.log(`Running student status update - Source: ${source}, Today: ${todayStr}`)

    let totalUpdates = 0
    let totalInteractions = 0

    // Rule 1: Mark students as "ausente" if exam date has passed and no grades recorded
    const { data: studentsForAbsent, error: fetchAbsentError } = await supabaseClient
      .from('students')
      .select(`
        id, 
        student_name, 
        exam_date, 
        portuguese_grade, 
        math_grade,
        classes!inner(has_exam)
      `)
      .eq('classes.has_exam', true)
      .lt('exam_date', todayStr)
      .is('portuguese_grade', null)
      .is('math_grade', null)
      .not('status', 'eq', 'ausente')

    if (fetchAbsentError) {
      console.error('Error fetching students for absent status:', fetchAbsentError)
      throw fetchAbsentError
    }

    if (studentsForAbsent && studentsForAbsent.length > 0) {
      console.log(`Found ${studentsForAbsent.length} students to mark as absent`)

      const { error: updateAbsentError } = await supabaseClient
        .from('students')
        .update({ status: 'ausente' })
        .in('id', studentsForAbsent.map(s => s.id))

      if (updateAbsentError) {
        console.error('Error updating students to absent:', updateAbsentError)
        throw updateAbsentError
      }

      // Add interaction records for absent students
      const absentInteractions = studentsForAbsent.map(student => ({
        student_id: student.id,
        interaction_type: 'mudanca_status',
        comments: `Status automaticamente alterado para "Ausente" - exame agendado para ${new Date(student.exam_date).toLocaleDateString('pt-BR')} e nenhuma nota foi registrada.`
      }))

      const { error: interactionAbsentError } = await supabaseClient
        .from('student_interactions')
        .insert(absentInteractions)

      if (interactionAbsentError) {
        console.error('Error inserting absent interactions:', interactionAbsentError)
      } else {
        totalInteractions += absentInteractions.length
      }

      totalUpdates += studentsForAbsent.length
    }

    // Rule 2: Mark students as "atendimento_ha_mais_de_uma_semana" if interview was more than 7 days ago
    const { data: studentsForWeekOld, error: fetchWeekOldError } = await supabaseClient
      .from('students')
      .select('id, student_name, interview_date')
      .eq('status', 'atendimento_recentemente')
      .lt('interview_date', sevenDaysAgoStr)

    if (fetchWeekOldError) {
      console.error('Error fetching students for week-old status:', fetchWeekOldError)
      throw fetchWeekOldError
    }

    if (studentsForWeekOld && studentsForWeekOld.length > 0) {
      console.log(`Found ${studentsForWeekOld.length} students to mark as week-old interview`)

      const { error: updateWeekOldError } = await supabaseClient
        .from('students')
        .update({ status: 'atendimento_ha_mais_de_uma_semana' })
        .in('id', studentsForWeekOld.map(s => s.id))

      if (updateWeekOldError) {
        console.error('Error updating students to week-old:', updateWeekOldError)
        throw updateWeekOldError
      }

      // Add interaction records for week-old students
      const weekOldInteractions = studentsForWeekOld.map(student => ({
        student_id: student.id,
        interaction_type: 'mudanca_status',
        comments: `Status automaticamente alterado para "Atendimento há mais de uma semana" - entrevista realizada em ${new Date(student.interview_date).toLocaleDateString('pt-BR')} há mais de 7 dias.`
      }))

      const { error: interactionWeekOldError } = await supabaseClient
        .from('student_interactions')
        .insert(weekOldInteractions)

      if (interactionWeekOldError) {
        console.error('Error inserting week-old interactions:', interactionWeekOldError)
      } else {
        totalInteractions += weekOldInteractions.length
      }

      totalUpdates += studentsForWeekOld.length
    }

    const responseMessage = totalUpdates > 0 
      ? `Updated ${totalUpdates} student statuses and added ${totalInteractions} interaction records`
      : 'No students required status updates'

    console.log(responseMessage)

    return new Response(
      JSON.stringify({ 
        message: responseMessage,
        updated_students: totalUpdates,
        interactions_added: totalInteractions,
        rules_applied: {
          absent: studentsForAbsent?.length || 0,
          week_old_interview: studentsForWeekOld?.length || 0
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Error in update-student-statuses function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})