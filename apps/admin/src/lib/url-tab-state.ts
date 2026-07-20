import { type DefinedUrlFilterSchema, defineUrlFilterSchema } from "@/lib/url-search-params";

export type UrlTabDefinition<T extends string> = {
  label: string;
  value: T;
};

export function defineUrlTabSchema<const T extends readonly string[]>(
  tabs: T,
  options: { defaultTab: T[number]; param?: string }
): {
  defaultTab: T[number];
  schema: DefinedUrlFilterSchema<{ tab: string }>;
  tabs: T;
} {
  const schema = defineUrlFilterSchema<{ tab: string }>({
    tab: {
      defaultValue: options.defaultTab,
      ...(options.param ? { param: options.param } : {}),
    },
  });

  return {
    defaultTab: options.defaultTab,
    schema,
    tabs,
  };
}

export function resolveUrlTab<const T extends readonly string[]>(
  raw: string,
  tabs: T,
  defaultTab: T[number]
): T[number] {
  if ((tabs as readonly string[]).includes(raw)) {
    return raw as T[number];
  }
  return defaultTab;
}

export function buildUrlTabDefinitions<const T extends string>(
  tabs: readonly T[],
  labels: Record<T, string>
): UrlTabDefinition<T>[] {
  return tabs.map((value) => ({
    label: labels[value],
    value,
  }));
}
