export interface ColumnWeights {
  [key: string]: number | undefined;
  rowNo?: number;
  item?: number;
  quantity?: number;
  unit?: number;
  unitCost?: number;
  total?: number;
}
