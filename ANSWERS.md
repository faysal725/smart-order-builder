
=== Q1 max item C from an empty cart ===
max C: 2
first blocked at 3: Short: 2 cheese
C unit price: 490.00

=== Q2 cheapest valid configuration ===
combinations checked: 1368570
cheapest unit price: 360.00 | ties: 2
first: {"toast":1,"fried":2,"tofu":1}

=== Q3 cart A x3, coupon MORNING15 ===
10:59:59: subtotal 1140.00 | C1 0.00 | C2 150.00 | applied C2 (-150.00) | after 990.00 | VAT 49.50 | total 1039.50 | payable 1040.00
11:30:00: subtotal 1140.00 | C1 0.00 | C2 0.00 | applied none (-0.00) | after 1140.00 | VAT 57.00 | total 1197.00 | payable 1197.00

=== Q4 cart after TC-10 (B = omelette 1, fried 3; C x2) ===
10:59:59: subtotal 1623.50 | C1 100.00 | C2 150.00 | applied C2 (-150.00) | after 1473.50 | VAT 73.68 | total 1547.18 | payable 1547.00
11:30:00: subtotal 1623.50 | C1 100.00 | C2 0.00 | applied C1 (-100.00) | after 1523.50 | VAT 76.18 | total 1599.68 | payable 1600.00

=== Q5 payable of each seed order, total revenue ===
ORD-1001 2026-11-20T09:15:00+06:00 coupon=MORNING15 applied=C2 subtotal 380.00 discount 57.00 VAT 16.15 payable 339.00
ORD-1002 2026-11-20T12:40:00+06:00 coupon=- applied=none subtotal 679.50 discount 0.00 VAT 33.98 payable 713.00
ORD-1003 2026-11-21T10:05:00+06:00 coupon=MORNING15 applied=C2 subtotal 1360.00 discount 150.00 VAT 60.50 payable 1271.00
ORD-1004 2026-11-21T19:30:00+06:00 coupon=- applied=none subtotal 550.00 discount 0.00 VAT 27.50 payable 578.00
ORD-1005 2026-11-22T08:50:00+06:00 coupon=MORNING15 applied=C2 subtotal 970.00 discount 145.50 VAT 41.23 payable 866.00
ORD-1006 2026-11-22T13:10:00+06:00 coupon=MORNING15 applied=none subtotal 1169.50 discount 0.00 VAT 58.48 payable 1228.00
TOTAL revenue: 4995.00 (6 orders)

=== Q6 best-selling options (units = line qty x option qty) ===
fried        10
sausage      8
scrambled    8
cheese       6
omelette     6
mushroom     5
hollandaise  4
paratha      4
bacon        3
beans        3
croissant    3
hashbrown    3
toast        3
tofu         3
chili        2
ketchup      2

=== Q7 revenue by payment method ===
card   2145.00
bkash  1579.00
cash   1271.00

=== Q8 orders that actually got MORNING15 ===
count applied: 3
ORD-1006 had MORNING15 but NOT applied | time 13:10:00 | C1 0.00 vs C2 0.00 | applied none
