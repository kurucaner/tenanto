export function scrollFormToFirstError(formElement: HTMLFormElement | null): void {
  if (!formElement) {
    return;
  }

  const invalidField = formElement.querySelector('[aria-invalid="true"]');
  if (invalidField instanceof HTMLElement) {
    invalidField.scrollIntoView({ behavior: "smooth", block: "center" });
    invalidField.focus({ preventScroll: true });
    return;
  }

  const errorMessage = formElement.querySelector(".text-destructive");
  if (errorMessage instanceof HTMLElement) {
    errorMessage.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}
