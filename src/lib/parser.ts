export function parseExpenseText(text: string) {
  return {
    text,
    amount: null,
    category: 'general',
  };
}
