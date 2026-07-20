// Pure filtering for searchable select/combobox inputs, shared by the UI and
// its tests. Case-insensitive substring match over the visible label and the
// optional group name; an empty query returns everything unchanged.

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  group?: string;
}

export function filterSelectOptions<T extends string>(
  options: SelectOption<T>[],
  query: string,
): SelectOption<T>[] {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  return options.filter(
    (o) =>
      o.label.toLowerCase().includes(q) ||
      (o.group ?? '').toLowerCase().includes(q),
  );
}
