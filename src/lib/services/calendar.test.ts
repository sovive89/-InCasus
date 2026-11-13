import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { calendarDays, calendarEventSchema, clientCalendarEvents, eventsOnDay } from "./calendar";

const event = { id: "event-1", title: "Audiência de conciliação", kind: "hearing" as const, startsAt: "2026-11-13T10:00:00", responsible: "Dra. Helena Duarte", clientId: "c-1", processId: "p-1", location: "Fórum", notes: "" };
describe("calendário compartilhado demonstrativo", () => {
  test("vista semanal tem sete dias, de segunda a domingo", () => {
    const days = calendarDays(new Date(2026, 10, 13), "week");
    assert.equal(days.length, 7);
    assert.equal(days[0]?.getDay(), 1);
    assert.equal(days[6]?.getDay(), 0);
  });
  test("vista mensal cobre todos os dias de novembro", () => {
    const days = calendarDays(new Date(2026, 10, 13), "month");
    assert.equal(days.filter((day) => day.getMonth() === 10).length, 30);
    assert.equal(days.length % 7, 0);
  });
  test("todo registro exige um responsável", () => {
    assert.equal(calendarEventSchema.safeParse({ ...event, responsible: " " }).success, false);
    assert.equal(calendarEventSchema.parse(event).responsible, "Dra. Helena Duarte");
  });
  test("prazos e audiências são tipos aceitos", () => {
    assert.equal(calendarEventSchema.parse({ ...event, kind: "deadline" }).kind, "deadline");
    assert.equal(calendarEventSchema.parse(event).kind, "hearing");
  });
  test("cliente recebe apenas seus próprios compromissos", () => {
    assert.deepEqual(clientCalendarEvents([event, { ...event, id: "event-2", clientId: "c-2" }], "c-1").map((item) => item.id), ["event-1"]);
  });
  test("compromissos aparecem na data registrada", () => {
    assert.equal(eventsOnDay([event], new Date(2026, 10, 13)).length, 1);
    assert.equal(eventsOnDay([event], new Date(2026, 10, 14)).length, 0);
  });
});