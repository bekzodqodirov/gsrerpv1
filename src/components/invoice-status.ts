// Invoys holati badge ranglari.
export const invoiceStatusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  issued: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  partially_paid:
    "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  paid: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  void: "bg-gray-100 text-gray-500 line-through dark:bg-gray-800 dark:text-gray-400",
};
