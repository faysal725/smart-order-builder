// Display only. Money stays integer poisha everywhere else.
export const bdt = (poisha: number) => `${(poisha / 100).toFixed(2)} BDT`;