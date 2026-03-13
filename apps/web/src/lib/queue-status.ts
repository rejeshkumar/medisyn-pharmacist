/**
 * Design-aligned status labels (from medisyn_complete_solution_design.docx)
 * Maps implementation status to design document names.
 */
export const QUEUE_STATUS_DESIGN: Record<string, { label: string; color: string; bg: string }> = {
  waiting:           { label: 'Registered',       color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200' },
  in_precheck:       { label: 'Pre-check In Progress', color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200' },
  precheck_done:     { label: 'Pre-check Done',   color: 'text-teal-700',   bg: 'bg-teal-50 border-teal-200' },
  in_consultation:   { label: 'Consultation In Progress', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  consultation_done:{ label: 'Prescribed',       color: 'text-indigo-700',  bg: 'bg-indigo-50 border-indigo-200' },
  dispensing:        { label: 'At Pharmacy',     color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
  payment_pending:   { label: 'Payment Pending',  color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200' },
  completed:         { label: 'Completed',       color: 'text-green-700',  bg: 'bg-green-50 border-green-200' },
  cancelled:         { label: 'Cancelled',       color: 'text-red-600',    bg: 'bg-red-50 border-red-200' },
  no_show:           { label: 'No Show',         color: 'text-gray-500',   bg: 'bg-gray-50 border-gray-200' },
};

export default QUEUE_STATUS_DESIGN;
