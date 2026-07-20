declare module "@tanstack/react-query" {
  interface Register {
    queryMeta: {
      persist?: boolean;
    };
  }
}
