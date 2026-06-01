import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './client';
import type { Database } from './types';

const db = supabase as SupabaseClient<Database>;

export type RescheduleAccessResult = {
  success?: boolean;
  eligible?: boolean;
  error?: string;
  reason?: string;
  student_id?: string;
  student_name?: string;
  unit_id?: string;
  class_id?: string;
  unit_name?: string;
  unit_address?: string;
  unit_phone?: string;
};

export type AppointmentCheckResult = {
  success?: boolean;
  has_appointment?: boolean;
  error?: string;
};

export type ScheduleRpcResult = {
  success?: boolean;
  error?: string;
  appointment_id?: string;
};

export async function getRescheduleAccess(
  studentId: string,
  registrationToken: string,
) {
  return db.rpc('get_reschedule_access', {
    p_student_id: studentId,
    p_registration_token: registrationToken,
  });
}

export async function getMyAppointment(
  studentId: string,
  registrationToken: string,
) {
  return db.rpc('get_my_appointment', {
    p_student_id: studentId,
    p_registration_token: registrationToken,
  });
}

export async function publicScheduleInterview(params: {
  studentId: string;
  interviewerId: string;
  date: string;
  time: string;
  registrationToken: string;
  comments: string;
}) {
  return db.rpc('public_schedule_interview', {
    p_student_id: params.studentId,
    p_interviewer_id: params.interviewerId,
    p_date: params.date,
    p_time: params.time,
    p_registration_token: params.registrationToken,
    p_comments: params.comments,
  });
}

export async function publicRescheduleAfterMiss(params: {
  studentId: string;
  interviewerId: string;
  date: string;
  time: string;
  registrationToken: string;
  comments: string;
}) {
  return db.rpc('public_reschedule_after_miss', {
    p_student_id: params.studentId,
    p_interviewer_id: params.interviewerId,
    p_date: params.date,
    p_time: params.time,
    p_registration_token: params.registrationToken,
    p_comments: params.comments,
  });
}
