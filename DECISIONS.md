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

### C2 - Bot questions and the function behind each

Gemini only chooses the function and fills inputs. My code computes every number from the orders JSON.
Revenue always means the sum of `pricing.payable` per order.

| Question | Function | Inputs | Output |
|---|---|---|---|
| How many orders? | getOrderCount | none | number |
| Total revenue? | getTotalRevenue | none | poisha |
| Best-selling option (by units)? | getTopOption | none | { optionId, units } |
| Revenue by payment method? | getRevenueByPayment | none | { card, bkash, cash } in poisha |
| Average order value? | getAverageOrderValue | none | poisha, rounded half-up |
| How many orders actually got the coupon? | getCouponAppliedCount | none | number (orders with pricing.applied = "C2") |
| Orders on a given date? | getOrdersOnDate | date (YYYY-MM-DD) | number |
| Anything else (e.g. best customer) | none | - | bot says it cannot know from this data |

Units = option count x line qty, summed over all lines.
Date uses the first 10 characters of `createdAt`, which is already Dhaka time. No timezone conversion.

### C3

TODO: copy the C3 question from the brief and answer it here.

## Decision points

### D1 - Two tabs, last egg taken by the other tab

Server is the source of truth. If tab A takes the last eggs, tab B's reserve call returns 409 with
"Short: N egg". Tab B keeps the user's draft untouched, so nothing typed is lost. It then reloads
available stock, and the affected options show as blocked with the reason.

### D2 - When is a price locked

At checkout, not at Add to cart. TC-06 and TC-07 use the same cart and give different results
(10:59:59 vs 11:00:00), so the price cannot be frozen earlier. The live preview uses server time.
Pay re-prices with server time. If the coupon stopped applying since the item was added,
the UI shows a note before Pay.
TODO: add one line on how your UI shows the TC-07 case.

### D3 - Reservation expires while the user edits

Unsaved changes stay on screen. A banner says the reservation expired at HH:MM, stock was released,
and the item is read-only. Save is disabled (the server returns 410 on edit). The user can remove
the item, or add the draft again as a new item, which tries a fresh reserve and may fail on stock.

### D4 - Who creates order id and timestamp, and double-click on Pay

Server creates both. The id is the next ORD number. The timestamp is server time in Dhaka ISO
(+06:00), the same shape as the seed file. The browser clock is wrong by 90 seconds by design.
Double-click: the client makes one idempotency key per Pay attempt and disables the button while
the call is pending. The server stores key to order id, so the same key returns the same order.
Result: exactly one order, and sold stock is not released again.
Add to cart works the same way. One key per draft, reused on every click, replaced only after success.

### D5 - "Who is our best customer?"

Orders hold no customer data, so no tool can answer it. The bot is given no customer tool, and its
system instruction says to refuse questions its tools cannot answer. Reply:
"Orders do not store customer information, so I can't tell you that."

### D6 - Stored order JSON shape

```json
{
  "id": "ORD-1009",
  "createdAt": "2026-11-26T10:15:00+06:00",
  "paymentMethod": "card",
  "couponCode": "MORNING15",
  "lines": [{ "qty": 1, "options": { "toast": 1, "fried": 2, "sausage": 1 } }],
  "pricing": {
    "subtotal": 0, "c1": 0, "c2": 0, "applied": "C2",
    "discount": 0, "discountedSubtotal": 0, "vat": 0, "total": 0, "payable": 0
  }
}
```

Money unit: integer poisha. `couponCode` is what the user typed. `pricing.applied` is what was
used ("C1", "C2" or null). So "entered but not applied" = couponCode set and applied is not "C2".
Why: seed orders have no price, and I price them with my engine at each `createdAt`.
Stored prices stay stable even if promo rules change later.

## Other assumptions

- Sauce group has no max in Appendix A. I set max 99 so `maxDistinct 2` is the real limit.
- Combo (eggs >= 4 and protein >= 2) counts option units in the Eggs and Protein groups.
  An omelette is one unit. Counting egg ingredients would differ.
- Tie between C1 and C2: C1 wins, as the brief says.
- Seed orders do not consume stock. They are past orders from 20 and 21 Nov.
- Reservation lives 5 minutes. The mock server clock runs 90 seconds ahead.
  The client learns the offset from `serverTime` in every response.
- Group ids `eggs`, `protein` and `extras` are constants at the top of `pricing.ts`.