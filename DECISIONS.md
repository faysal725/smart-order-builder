# DECISIONS

## Checkpoints (answer BEFORE building)

### C1 - priceCart, float risk (TC-06)
JS numbers are binary floats. Most decimals (0.1, 0.05, 0.15) have no exact binary form, so math drifts:
0.1 + 0.2 === 0.30000000000000004.
679.50 alone is exact in binary (it is 679 + 1/2). The risk is the next step: multiplying it by 0.15 or 0.05
gives a value that can land just below or above a .5 boundary. Rounding then flips by 1 poisha.
Example: 1509.5 * 0.05 should be 75.475 (a half-way tie) but float may give 75.47499999..., which rounds DOWN.

Fix: all money is integer poisha (BDT x 100). Percentages use integer math: (amount * rate) / 100,
then Math.floor(x + 0.5) style half-up rounding on integers. No decimals touch money.

TC-06 by hand (poisha):
- Cart: B x1 + C x2 = 67950 + 98000 = 165950  (1,659.50 BDT)
- Coupon MORNING15 valid (10:59:59 is before 11:00): 15% = 24892.5 -> capped at 15000
- C1 discount (subtotal >= 1000): 10000. Only larger applies -> 15000
- Discounted subtotal: 165950 - 15000 = 150950
- VAT 5%: 150950 * 5 / 100 = 7547.5 -> half-up = 7548 (75.48 BDT)
- Total: 150950 + 7548 = 158498 (1,584.98 BDT)
- Payable rounded half-up to whole BDT: 1,585

### C2 - Gemini bot, supported questions
Gemini only picks the function and fills inputs. My code computes every number from orders JSON.

| Question | Function | Inputs | Output |
|---|---|---|---|
| How many orders? | getOrderCount | optional from, to | number |
| Total revenue? | getTotalRevenue | optional from, to | poisha total |
| Revenue by payment method? | getRevenueByPayment | optional from, to | {card, bkash, cash} |
| Best-selling option? | getTopOptions | limit | [{optionId, units}] |
| Average order value? | getAverageOrderValue | optional from, to | poisha |
| Who is our best customer? | none | - | refuse: orders store no customer data |


## Decision points

### D1 - Two tabs, last egg
Question:
My choice:
Why:

### D2 - Promo timing / price lock
### D3 - Reservation expires mid-edit
### D4 - Order id + timestamp, double-click Pay
### D5 - "Who is our best customer?"
### D6 - Saved order JSON shape