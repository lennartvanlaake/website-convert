// Status vocabulary (Scrum-flavoured). These are the only accepted values; the
// zod enums below enforce them so the model can't invent statuses.
export const TASK_STATUSES = [
  "todo",
  "in-progress",
  "done",
  "blocked",
] as const;

export type TaskStatusType = (typeof TASK_STATUSES)[number];

export const TaskStatus = Object.fromEntries(
  TASK_STATUSES.map((v) => [v, v]),
) as {
  [K in TaskStatusType]: K;
};
