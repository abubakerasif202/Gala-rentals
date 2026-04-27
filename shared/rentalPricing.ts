const roundCurrency = (value: number) => Number(value.toFixed(2));

export const calculateBondFromWeeklyRent = (weeklyRent: number) =>
  roundCurrency(weeklyRent * 2);

export const calculateUpfrontDueFromWeeklyRent = (weeklyRent: number) =>
  roundCurrency(weeklyRent * 3);
