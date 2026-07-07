import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import {
  SEED_EXPENSES,
  SEED_INCOME,
  type ExpenseRow,
  type IncomeRow,
} from "@/lib/accountsData";
import { useCollectionState } from "@/lib/collectionState";

function maxSeq(rows: { id: string }[], prefix: string): number {
  let max = 0;
  for (const r of rows) {
    if (!r.id.startsWith(prefix)) continue;
    const n = parseInt(r.id.slice(prefix.length), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}

interface AccountsContextValue {
  income: IncomeRow[];
  expenses: ExpenseRow[];
  postIncome: (row: Omit<IncomeRow, "id"> & { id?: string }) => IncomeRow;
  postExpense: (row: Omit<ExpenseRow, "id">) => ExpenseRow;
  postReversal: (originalOrderId: string, amount: number, reason: string, at: number) => ExpenseRow;
}

const AccountsContext = createContext<AccountsContextValue | undefined>(undefined);

export function AccountsProvider({ children }: { children: ReactNode }) {
  const [income, setIncome] = useCollectionState<IncomeRow[]>("accounts_income", SEED_INCOME);
  const [expenses, setExpenses] = useCollectionState<ExpenseRow[]>("accounts_expenses", SEED_EXPENSES);

  const incomeSeq = useRef(maxSeq(income, "BIL-"));
  const expenseSeq = useRef(maxSeq(expenses, "EXP-"));

  const postIncome = useCallback((row: Omit<IncomeRow, "id"> & { id?: string }): IncomeRow => {
    incomeSeq.current += 1;
    const full: IncomeRow = { ...row, id: row.id ?? `BIL-${incomeSeq.current}` };
    setIncome((prev) => [full, ...prev]);
    return full;
  }, [setIncome]);

  const postExpense = useCallback((row: Omit<ExpenseRow, "id">): ExpenseRow => {
    expenseSeq.current += 1;
    const full: ExpenseRow = { ...row, id: `EXP-${expenseSeq.current}` };
    setExpenses((prev) => [full, ...prev]);
    return full;
  }, [setExpenses]);

  const postReversal = useCallback(
    (originalOrderId: string, amount: number, reason: string, at: number): ExpenseRow => {
      return postExpense({
        at,
        description: `Refund reversal â€” ${originalOrderId}: ${reason}`,
        category: "Misc",
        amount,
        mode: "Adjustment",
        hasBill: false,
        paidTo: "Customer Refund",
      });
    },
    [postExpense],
  );

  const value = useMemo<AccountsContextValue>(
    () => ({ income, expenses, postIncome, postExpense, postReversal }),
    [income, expenses, postIncome, postExpense, postReversal],
  );

  return (
    <AccountsContext.Provider value={value}>{children}</AccountsContext.Provider>
  );
}

export function useAccounts(): AccountsContextValue {
  const ctx = useContext(AccountsContext);
  if (!ctx) throw new Error("useAccounts must be used within an AccountsProvider");
  return ctx;
}
