import { evalPlayerTemporalState, calculateSessionEnd } from "./playerTemporalStateService";

describe("Player Temporal State Machine Service", () => {
  const mockSession = {
    id: "s-1",
    date: "2026-07-27",
    start_time: "18:00:00",
    duration_min: 90,
    status: "scheduled",
  };

  test("1. NO_SESSION when session is null", () => {
    const result = evalPlayerTemporalState({
      session: null,
      playerDaily: { hasCheckinToday: false, hasCheckoutToday: false },
    });
    expect(result.state).toBe("NO_SESSION");
    expect(result.actionType).toBe("none");
  });

  test("2. SESSION_CANCELLED when session status is cancelled", () => {
    const result = evalPlayerTemporalState({
      session: { ...mockSession, status: "cancelled" },
      playerDaily: { hasCheckinToday: false, hasCheckoutToday: false },
    });
    expect(result.state).toBe("SESSION_CANCELLED");
  });

  test("3. PRE_CHECKIN_NOT_OPEN > 4h before session", () => {
    const now = new Date(2026, 6, 27, 12, 0, 0); // 12:00 (6h before 18:00)
    const result = evalPlayerTemporalState({
      session: mockSession,
      playerDaily: { hasCheckinToday: false, hasCheckoutToday: false },
      nowTime: now,
    });
    expect(result.state).toBe("PRE_CHECKIN_NOT_OPEN");
    expect(result.actionType).toBe("waiting");
  });

  test("4. PRE_CHECKIN_OPEN 2h before session", () => {
    const now = new Date(2026, 6, 27, 16, 0, 0); // 16:00 (2h before 18:00)
    const result = evalPlayerTemporalState({
      session: mockSession,
      playerDaily: { hasCheckinToday: false, hasCheckoutToday: false },
      nowTime: now,
    });
    expect(result.state).toBe("PRE_CHECKIN_OPEN");
    expect(result.actionType).toBe("checkin");
  });

  test("5. CHECKIN_DONE_WAITING_SESSION when checkin is done before start", () => {
    const now = new Date(2026, 6, 27, 16, 30, 0);
    const result = evalPlayerTemporalState({
      session: mockSession,
      playerDaily: { hasCheckinToday: true, hasCheckoutToday: false },
      nowTime: now,
    });
    expect(result.state).toBe("CHECKIN_DONE_WAITING_SESSION");
    expect(result.actionType).toBe("done");
  });

  test("6. SESSION_IN_PROGRESS at 18:30 (during 90m session)", () => {
    const now = new Date(2026, 6, 27, 18, 30, 0);
    const result = evalPlayerTemporalState({
      session: mockSession,
      playerDaily: { hasCheckinToday: true, hasCheckoutToday: false },
      nowTime: now,
    });
    expect(result.state).toBe("SESSION_IN_PROGRESS");
  });

  test("7. POST_SESSION_CHECKOUT_OPEN at 19:25 (session ends 19:30)", () => {
    const now = new Date(2026, 6, 27, 19, 25, 0); // 19:25 (after 19:15 checkout open threshold)
    const result = evalPlayerTemporalState({
      session: mockSession,
      playerDaily: { hasCheckinToday: true, hasCheckoutToday: false },
      nowTime: now,
    });
    expect(result.state).toBe("POST_SESSION_CHECKOUT_OPEN");
    expect(result.actionType).toBe("checkout");
  });

  test("8. CHECKOUT_DONE when checkout is done", () => {
    const now = new Date(2026, 6, 27, 20, 0, 0);
    const result = evalPlayerTemporalState({
      session: mockSession,
      playerDaily: { hasCheckinToday: true, hasCheckoutToday: true },
      nowTime: now,
    });
    expect(result.state).toBe("CHECKOUT_DONE");
    expect(result.actionType).toBe("done");
  });

  test("9. Calculate Session End priority with start + duration", () => {
    const { startDate, endDate } = calculateSessionEnd("2026-07-27", "10:00", null, 60);
    expect(startDate.getHours()).toBe(10);
    expect(endDate.getHours()).toBe(11);
  });
});
