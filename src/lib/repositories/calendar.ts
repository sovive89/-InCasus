import { appointmentRepository } from "./index";
import { calendarEventSchema, type CalendarEvent } from "../services/calendar";

// Local demo adapter. Real cross-device sharing must use authenticated Cloud storage.
const STORAGE_KEY = "incasus.calendar.demo.v1";
const CHANGE_EVENT = "incasus:calendar-change";
type Changes = { events: CalendarEvent[]; deleted: string[] };

function baseEvents(): CalendarEvent[] {
  return appointmentRepository.list().map((event) => ({
    ...event, responsible: "Dra. Helena Duarte", processId: "", notes: "",
  }));
}

function readChanges(): Changes {
  if (typeof window === "undefined") return { events: [], deleted: [] };
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { events: [], deleted: [] };
  const schema = calendarEventSchema.array();
  try {
    const value = JSON.parse(raw) as Changes;
    const events = schema.safeParse(value.events);
    return { events: events.success ? events.data : [], deleted: Array.isArray(value.deleted) ? value.deleted.filter((id) => typeof id === "string") : [] };
  } catch { return { events: [], deleted: [] }; }
}

function writeChanges(changes: Changes) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(changes));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export const calendarRepository = {
  list(): CalendarEvent[] {
    const changes = readChanges();
    const overridden = new Set([...changes.events.map((event) => event.id), ...changes.deleted]);
    return [...baseEvents().filter((event) => !overridden.has(event.id)), ...changes.events];
  },
  save(input: CalendarEvent) {
    const event = calendarEventSchema.parse(input);
    const changes = readChanges();
    writeChanges({ events: [...changes.events.filter((item) => item.id !== event.id), event], deleted: changes.deleted.filter((id) => id !== event.id) });
  },
  remove(id: string) {
    const changes = readChanges();
    writeChanges({ events: changes.events.filter((event) => event.id !== id), deleted: [...new Set([...changes.deleted, id])] });
  },
  subscribe(callback: () => void) {
    const storage = (event: StorageEvent) => { if (event.key === STORAGE_KEY || event.key === null) callback(); };
    window.addEventListener(CHANGE_EVENT, callback);
    window.addEventListener("storage", storage);
    return () => { window.removeEventListener(CHANGE_EVENT, callback); window.removeEventListener("storage", storage); };
  },
};