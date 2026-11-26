# DECISIONS

All money is integer poisha (1 BDT = 100 poisha). The engine in `src/engine/` is pure and takes the menu as an argument. It never imports the fixture.

## Checkpoints (answered before building)

### C1 - Why 679.50 as a float is risky, and how 75.48 is rounded (TC-06)

JavaScript numbers are binary floats. Most decimals have no exact binary form:
`0.1 + 0.2 === 0.30000000000000004` and `1.005 * 100 === 100.49999999999999`.
679.50 alone is exact (679 + 1/2). The risk starts when I multiply it by 0.15 or 0.05 and then round.
A true half-way value can land just below .5 and round the wrong way by one poisha.
Fix: store all money as integer poisha and compute percentages with integer math, half-up:
`Math.floor((2 * amount * rate + 100) / 200)`.

TC-06 by hand (poisha):
- Cart B x1 + C x2: 67950 + 2 x 49000 = 165950 (1,659.50 BDT)
- C1 (subtotal >= 1,200 BDT): 10000
- C2 MORNING15 at 10:59:59 (strictly before 11:00): 15% of 165950 = 24892.5, capped at 15000
- Larger wins, so C2: discount 15000
- Discounted subtotal: 165950 - 15000 = 150950
- VAT 5%: 150950 x 5 / 100 = 7547.5, half-up = 7548 (75.48 BDT)
- Total: 150950 + 7548 = 158498 (1,584.98 BDT)
- Payable, rounded half-up to whole BDT: 1,585

### C2 - Gemini bot: supported questions and functions

Gemini only picks a function and its inputs, then phrases the result.
My code computes every number from the orders JSON. Raw orders are never sent to the model.
Revenue = sum of `pricing.payable` (integer poisha, shown also as BDT).

| Question | Function | Inputs | Output |
|---|---|---|---|
| How many orders? | getOrderCount | optional from, to (YYYY-MM-DD) | { count } |
| Total revenue? | getTotalRevenue | optional from, to | { revenue: { poisha, bdt } } |
| Revenue by payment method? | getRevenueByPayment | optional from, to | { card, bkash, cash } each { poisha, bdt } |
| Best-selling option (by units)? | getTopOptions | optional limit, from, to | { top: [{ optionId, name, units }] } |
| Average order value? | getAverageOrderValue | optional from, to | { average: { poisha, bdt } } |
| How many orders got the coupon? | getCouponAppliedCount | optional from, to | { count } (only orders where C2 won) |
| Orders on a given date? | getOrdersOnDate | date (YYYY-MM-DD) | { date, count } |

Not supported (bot must say it cannot know): customer names, anything not in the order data.

### C3

TODO: copy the C3 question from the brief and answer it here.

## Decision points

### D1 - Two tabs, last egg

**Question:** Tab A is adding an item while tab B takes the last egg. What does tab A see on save, and does the user lose what they typed?

**My choice:** The server decides. Tab A's reserve call gets 409 with "Short: 1 egg". Tab A keeps its draft. Nothing is lost.

**Why:** Stock lives only on the server, so a stale tab cannot overwrite or oversell. Failed reserve writes nothing (all-or-nothing), so no phantom hold. The draft state is only cleared after a success.

**Trade-off:** Tab A shows old stock numbers until its next refresh (it polls every 10 seconds), so the user may click a button that then fails with a clear message.

### D2 - When is a price locked

**Question:** When is a price locked: at Add to cart, at checkout, or never?

**My choice:** Locked at checkout. The /price preview is only a preview.

**Why:** TC-06 and TC-07 use the same cart. At 10:59:59 the coupon works (payable 1,585). At 11:00:00 it is rejected (payable 1,637). So the final price must depend on server time at the moment of payment. Locking at Add to cart would break TC-07.

**Trade-off:** A user can see one price while configuring and pay a different one if the coupon expires in between. The cart shows the breakdown again before Pay.

### D3 - Reservation expires while editing

**Question:** What happens to unsaved changes, and what does the screen say?

**My choice:** An expired item turns read-only: struck through with "EXPIRED, stock released". Remove still works. The server refuses edits on an expired reservation (410).

**Why:** The server already gave the stock back, so saving the edit would claim stock the user no longer holds.

**Trade-off:** The user has to add the item again, and the stock may be gone by then.

**Status:** The edit-in-place screen is NOT built yet. Expiry and read-only are built. Server edit (PUT) exists and is tested at engine level (TC-09 to TC-11).

### D4 - Who creates order id and timestamp, and double-click on Pay

**Question:** Who creates the order id and timestamp, and how is a double-click on Pay stopped?

**My choice:** The server creates both. The browser sends one idempotency key per Pay attempt.

**Why:** The browser clock can be wrong (the mock server clock is 90 seconds ahead on purpose), so the browser cannot be trusted for time or ids. The server remembers key -> order id. A second request with the same key returns the same order, never a new one. The Pay button is also disabled while the request is pending.

**Same idea for Add to cart:** One key is made when a draft starts and reused for every click on that draft. A new key is made only after a success. A new key per click would turn a triple click into three items. TC-13 needs exactly one.

### D5 - "Who is our best customer?"

**Question:** Orders store no customer. What does the bot reply and how do I stop it inventing a name?

**My choice:** The bot says it cannot know this from the data.

**How:** (1) No customer tool exists, so the model has nothing to call. (2) The system prompt says orders hold no customer data and forbids guessing. (3) Raw orders are never sent to the model, so there is no data to invent from.

**Limit:** Point 2 depends on the model following the prompt. Unit tests cannot prove it. I check TC-20 by asking it by hand.



### D6 - Stored order JSON shape

**Question:** Which fields, which money unit, how is a coupon that was entered but not applied recorded?

**My choice:**
{
  "id": "ORD-1007",
  "createdAt": "2026-11-26T10:05:00+06:00",
  "paymentMethod": "card | bkash | cash",
  "couponCode": "MORNING15 or null",
  "lines": [{ "qty": 1, "options": { "toast": 1 } }],
  "pricing": {
    "lines": [...], "subtotal": 0, "c1": 0, "c2": 0,
    "applied": "C1 | C2 | null", "discount": 0,
    "discountedSubtotal": 0, "vat": 0, "total": 0, "payable": 0
  }
}
Downloaded file: { "schemaVersion": 1, "currency": "BDT", "orders": [...] }

**Money unit:** Integer poisha everywhere. 100 poisha = 1 BDT. No floats are stored.

**Coupon entered but not applied:** `couponCode` keeps what the user typed. `pricing.applied` says which discount won. So MORNING15 typed after 11:00 gives `couponCode: "MORNING15"` and `applied: "C1"` or `null`. `pricing.c2` is 0.

**Why:** One record answers both "who typed a coupon" and "who actually got it". Prices are stored so later rule changes cannot change old totals.



## Other decisions

- **Seed orders do not use stock.** They are past orders (20 and 21 Nov). Stock starts from Appendix A numbers.
- **Seed pricing:** priced with my own engine at each order's `createdAt`, so MORNING15 on 10:05 counts and on 12:40 would not.
- **Combo (P1) counts option units** in the Eggs and Protein groups (Omelette x1 = 1 unit), not egg ingredients. Reason: the brief says "eggs >= 4" about options. TC-10 gives 643.50 with this reading.
- **Rounding:** every percentage step is half-up on integer poisha using integer math. Only the final payable rounds to whole BDT.
- **Tie between C1 and C2:** C1 wins, per the brief.
- **Sauce max:** Appendix A gives no sauce max, so the limit is only maxDistinct 2 and maxPerOption 1.
- **Plus button not blocked at group max.** The rule message shows instead, and Add is disabled while rules fail. The server validates again.
- **Date for stats:** I slice `createdAt` (already +06:00) and never convert through UTC.