/** Total number of scrollytelling sections (0: goal-picker landing ... 4: result). */
export const STEP_COUNT = 5

// Rail labels for the five sections. The goal-picker carousel is now the landing
// screen (there's no separate title card — see design/adr/0009), so the flow is
// Goal -> Details -> Budget -> Plan -> Result.
export const STEP_LABELS = ['Goal', 'Details', 'Budget', 'Plan', 'Result']
