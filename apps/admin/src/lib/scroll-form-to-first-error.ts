import { type RefObject } from "react";

export function scrollFormToFirstError(
  formRef: RefObject<HTMLFormElement | null>,
  activeStep?: string
): void {
  const formElement = formRef.current;
  if (!formElement) {
    return;
  }

  const scope =
    activeStep === undefined
      ? formElement
      : formElement.querySelector(`[data-start-lease-step="${activeStep}"]:not([hidden])`);

  if (!scope) {
    return;
  }

  const invalidField = scope.querySelector('[aria-invalid="true"]');
  if (invalidField instanceof HTMLElement) {
    invalidField.scrollIntoView({ behavior: "smooth", block: "center" });
    invalidField.focus({ preventScroll: true });
    return;
  }

  const errorMessage = scope.querySelector(".text-destructive");
  if (errorMessage instanceof HTMLElement) {
    errorMessage.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}
