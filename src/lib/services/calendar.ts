import { z } from "zod";
import { addDays, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns";

export const eventKinds = { deadline: "Prazo processual", hearing: "Audiência", meeting: "Reunião", call: "Chamada" } as const;
export const calendarEventSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1, "Informe o título.").max(180),
  kind: z.enum(["deadline", "hearing", "meeting", "call"]),
  startsAt: z.string().refine((value) => !Number.isNaN(new Date(value).getTime()), "Informe uma data válida."),
  responsible: z.string().trim().min(1, "Informe o responsável.").max(100),
  clientId: z.string(),
  processId: z.string(),
  location: z.string().trim().max(240),
  notes: z.string().trim().max(2000),
});
export type CalendarEvent = z.infer<typeof calendarEventSchema>;
export type CalendarView = "month" | "week";

export function calendarDays(date: Date, view: CalendarView): Date[] {
  const start = startOfWeek(view === "month" ? startOfMonth(date) : date, { weekStartsOn: 1 });
  const end = endOfWeek(view === "month" ? endOfMonth(date) : date, { weekStartsOn: 1 });
  const days: Date[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) days.push(day);
  return days;
}

export function eventsOnDay(events: CalendarEvent[], day: Date) {
  const key = format(day, "yyyy-MM-dd");
  return events.filter((event) => format(new Date(event.startsAt), "yyyy-MM-dd") === key)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export function clientCalendarEvents(events: CalendarEvent[], clientId: string) {
  return events.filter((event) => event.clientId === clientId);
}