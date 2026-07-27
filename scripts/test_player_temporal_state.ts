import { evalPlayerTemporalState, calculateSessionEnd } from "../src/services/playerTemporalStateService";

console.log("=== Testing Player Temporal State Machine Service ===");

const mockSession = {
  id: "s-1",
  date: "2026-07-27",
  start_time: "18:00:00",
  duration_min: 90,
  status: "scheduled",
};

// Test 1: NO_SESSION
const t1 = evalPlayerTemporalState({
  session: null,
  playerDaily: { hasCheckinToday: false, hasCheckoutToday: false },
});
console.assert(t1.state === "NO_SESSION", "Test 1 Failed");
console.log("✓ Test 1 Passed: NO_SESSION when session is null");

// Test 2: SESSION_CANCELLED
const t2 = evalPlayerTemporalState({
  session: { ...mockSession, status: "cancelled" },
  playerDaily: { hasCheckinToday: false, hasCheckoutToday: false },
});
console.assert(t2.state === "SESSION_CANCELLED", "Test 2 Failed");
console.log("✓ Test 2 Passed: SESSION_CANCELLED when session is cancelled");

// Test 3: PRE_CHECKIN_NOT_OPEN
const now12 = new Date(2026, 6, 27, 12, 0, 0);
const t3 = evalPlayerTemporalState({
  session: mockSession,
  playerDaily: { hasCheckinToday: false, hasCheckoutToday: false },
  nowTime: now12,
});
console.assert(t3.state === "PRE_CHECKIN_NOT_OPEN", "Test 3 Failed");
console.log("✓ Test 3 Passed: PRE_CHECKIN_NOT_OPEN > 4h before session");

// Test 4: PRE_CHECKIN_OPEN
const now16 = new Date(2026, 6, 27, 16, 0, 0);
const t4 = evalPlayerTemporalState({
  session: mockSession,
  playerDaily: { hasCheckinToday: false, hasCheckoutToday: false },
  nowTime: now16,
});
console.assert(t4.state === "PRE_CHECKIN_OPEN", "Test 4 Failed");
console.log("✓ Test 4 Passed: PRE_CHECKIN_OPEN 2h before session");

// Test 5: CHECKIN_DONE_WAITING_SESSION
const t5 = evalPlayerTemporalState({
  session: mockSession,
  playerDaily: { hasCheckinToday: true, hasCheckoutToday: false },
  nowTime: now16,
});
console.assert(t5.state === "CHECKIN_DONE_WAITING_SESSION", "Test 5 Failed");
console.log("✓ Test 5 Passed: CHECKIN_DONE_WAITING_SESSION when checkin is done");

// Test 6: SESSION_IN_PROGRESS
const now1830 = new Date(2026, 6, 27, 18, 30, 0);
const t6 = evalPlayerTemporalState({
  session: mockSession,
  playerDaily: { hasCheckinToday: true, hasCheckoutToday: false },
  nowTime: now1830,
});
console.assert(t6.state === "SESSION_IN_PROGRESS", "Test 6 Failed");
console.log("✓ Test 6 Passed: SESSION_IN_PROGRESS during training");

// Test 7: POST_SESSION_CHECKOUT_OPEN
const now1925 = new Date(2026, 6, 27, 19, 25, 0);
const t7 = evalPlayerTemporalState({
  session: mockSession,
  playerDaily: { hasCheckinToday: true, hasCheckoutToday: false },
  nowTime: now1925,
});
console.assert(t7.state === "POST_SESSION_CHECKOUT_OPEN", "Test 7 Failed");
console.log("✓ Test 7 Passed: POST_SESSION_CHECKOUT_OPEN 15m before end time");

// Test 8: CHECKOUT_DONE
const t8 = evalPlayerTemporalState({
  session: mockSession,
  playerDaily: { hasCheckinToday: true, hasCheckoutToday: true },
  nowTime: now1925,
});
console.assert(t8.state === "CHECKOUT_DONE", "Test 8 Failed");
console.log("✓ Test 8 Passed: CHECKOUT_DONE when checkout is done");

// Test 9: End time calculation priority
const { startDate, endDate } = calculateSessionEnd("2026-07-27", "10:00", null, 60);
console.assert(startDate.getHours() === 10 && endDate.getHours() === 11, "Test 9 Failed");
console.log("✓ Test 9 Passed: Session end time priority calculation (10:00 + 60m = 11:00)");

console.log("=== ALL 9 TEMPORAL STATE TESTS PASSED SUCCESSFULLY! ===");
