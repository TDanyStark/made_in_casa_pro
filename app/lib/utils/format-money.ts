const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

/** COP amount without cents ("$ 2.500.000"). */
export const formatMoney = (value: number) => money.format(value);
