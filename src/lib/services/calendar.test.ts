import { describe, test, expect } from "bun:test";
import { calendarDays, calendarEventSchema, clientCalendarEvents, eventsOnDay } from "./calendar";

const event = { id: "event-1", title: "Audiência de conciliação", kind: "hearing" as const, startsAt: "2026-11-13T10:00:00", responsible: "Dra. Helena Duarte", clientId: "c-1", processId: "p-1", location: "Fórum", notes: "" };
describe("calendário compartilhado demonstrativo", () => {
  test("vista semanal tem sete dias, de segunda a domingo", () => {
    const days = calendarDays(new Date(2026, 10, 13), "week");
    expect(days).toHaveLength(7);
    expect(days[0]?.getDay()).toBe(1);
    expect(days[6]?.getDay()).toBe(0);
  });
  test("vista mensal cobre todos os dias de novembro", () => {
    const days = calendarDays(new Date(2026, 10, 13), "month");
    expect(days.filter((day) => day.getMonth() === 10)).toHaveLength(30);
    expect(days.length % 7).toBe(0);
  });
  test("todo registro exige um responsável", () => {
    expect(calendarEventSchema.safeParse({ ...event, responsible: " " }).success).toBe(false);
    expect(calendarEventSchema.parse(event).responsible).toBe("Dra. Helena Duarte");
  });
  test("prazos e audiências são tipos aceitos", () => {
    expect(calendarEventSchema.parse({ ...event, kind: "deadline" }).kind).toBe("deadline");
    expect(calendarEventSchema.parse(event).kind).toBe("hearing");
  });
  test("cliente recebe apenas seus próprios compromissos", () => {
    expect(clientCalendarEvents([event, { ...event, id: "event-2", clientId: "c-2" }], "c-1").map((item) => item.id)).toEqual(["event-1"]);
  });
  test("compromissos aparecem na data registrada", () => {
    expect(eventsOnDay([event], new Date(2026, 10, 13))).toHaveLength(1);
    expect(eventsOnDay([event], new Date(2026, 10, 14))).toHaveLength(0);
  });
});