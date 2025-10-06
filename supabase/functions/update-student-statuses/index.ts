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
    // Verificar se há atendimento realizado antes de alterar o status
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

    let studentsToMarkAbsent = []
    if (studentsForAbsent && studentsForAbsent.length > 0) {
      console.log(`Found ${studentsForAbsent.length} students to check for absent status`)

      // Verificar quais alunos NÃO têm atendimento realizado
      for (const student of studentsForAbsent) {
        const { data: appointments, error: appointmentError } = await supabaseClient
          .from('appointments')
          .select('id, status')
          .eq('student_id', student.id)
          .eq('status', 'realizado')

        if (appointmentError) {
          console.error(`Error fetching appointments for student ${student.id}:`, appointmentError)
          continue
        }

        // Só marca como ausente se NÃO houver atendimento realizado
        const hasRealizedAppointment = appointments && appointments.length > 0
        
        if (!hasRealizedAppointment) {
          studentsToMarkAbsent.push(student)
        }
      }

      if (studentsToMarkAbsent.length > 0) {
        console.log(`Found ${studentsToMarkAbsent.length} students to mark as absent (without realized appointments)`)

        const { error: updateAbsentError } = await supabaseClient
          .from('students')
          .update({ status: 'ausente' })
          .in('id', studentsToMarkAbsent.map(s => s.id))

        if (updateAbsentError) {
          console.error('Error updating students to absent:', updateAbsentError)
          throw updateAbsentError
        }

        // Add interaction records for absent students
        const absentInteractions = studentsToMarkAbsent.map(student => ({
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

        totalUpdates += studentsToMarkAbsent.length
      }
    }

    // Rule 2: Mark students as "faltou_ao_atendimento" if interview date has passed and no "realizado" appointment
    const { data: studentsForMissedInterview, error: fetchMissedInterviewError } = await supabaseClient
      .from('students')
      .select(`
        id, 
        student_name, 
        interview_date,
        status
      `)
      .not('interview_date', 'is', null)
      .lt('interview_date', todayStr)
      .in('status', ['atendimento_agendado', 'confirmado'])

    if (fetchMissedInterviewError) {
      console.error('Error fetching students for missed interview status:', fetchMissedInterviewError)
      throw fetchMissedInterviewError
    }

    let studentsToUpdate = []
    if (studentsForMissedInterview && studentsForMissedInterview.length > 0) {
      console.log(`Found ${studentsForMissedInterview.length} students to check for missed interviews`)

      // Verificar quais alunos não têm appointment com status "realizado"
      for (const student of studentsForMissedInterview) {
        // Buscar appointments para este aluno na data da entrevista
        const { data: appointments, error: appointmentError } = await supabaseClient
          .from('appointments')
          .select('id, status, appointment_date')
          .eq('student_id', student.id)
          .eq('appointment_date', student.interview_date)

        if (appointmentError) {
          console.error(`Error fetching appointments for student ${student.id}:`, appointmentError)
          continue
        }

        // Se não há appointment ou nenhum tem status "realizado", marcar como faltou
        const hasRealizedAppointment = appointments?.some(apt => apt.status === 'realizado')
        
        if (!hasRealizedAppointment) {
          studentsToUpdate.push(student)
        }
      }

      if (studentsToUpdate.length > 0) {
        console.log(`Found ${studentsToUpdate.length} students to mark as missed interview`)

        const { error: updateMissedError } = await supabaseClient
          .from('students')
          .update({ status: 'faltou_ao_atendimento' })
          .in('id', studentsToUpdate.map(s => s.id))

        if (updateMissedError) {
          console.error('Error updating students to missed interview:', updateMissedError)
          throw updateMissedError
        }

        // Add interaction records for missed interview students
        const missedInterviewInteractions = studentsToUpdate.map(student => ({
          student_id: student.id,
          interaction_type: 'mudanca_status',
          comments: `Status automaticamente alterado para "Faltou ao Atendimento" - entrevista agendada para ${new Date(student.interview_date).toLocaleDateString('pt-BR')} não foi registrada como realizada.`
        }))

        const { error: interactionMissedError } = await supabaseClient
          .from('student_interactions')
          .insert(missedInterviewInteractions)

        if (interactionMissedError) {
          console.error('Error inserting missed interview interactions:', interactionMissedError)
        } else {
          totalInteractions += missedInterviewInteractions.length
        }

        totalUpdates += studentsToUpdate.length
      }
    }

    // Rule 3: Mark students as "atendimento_ha_mais_de_uma_semana" if interview was more than 7 days ago
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
          absent: studentsToMarkAbsent?.length || 0,
          missed_interview: studentsToUpdate?.length || 0,
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