import { afterEach, describe, expect, mock, test } from "bun:test";

const toastSuccessMock = mock(() => "success-toast-id");
const toastWarningMock = mock(() => "warning-toast-id");
const toastInfoMock = mock(() => "info-toast-id");
const navigateMock = mock(() => undefined);

mock.module("sonner", () => ({
  toast: {
    info: toastInfoMock,
    success: toastSuccessMock,
    warning: toastWarningMock,
  },
}));

mock.module("@/app/router", () => ({
  router: {
    navigate: navigateMock,
  },
}));

const { showNotificationToast } = await import("./show-notification-toast");

const baseNotification = {
  body: "3 sent",
  contextResourceId: "campaign-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  id: "notification-1",
  readAt: null,
  resourceId: "property-1",
  resourceType: "property" as const,
  title: "Notification delivered",
  type: "tenant_email_campaign_completed" as const,
};

afterEach(() => {
  toastSuccessMock.mockClear();
  toastWarningMock.mockClear();
  toastInfoMock.mockClear();
  navigateMock.mockClear();
});

describe("showNotificationToast", () => {
  test("shows a success campaign completion toast with a details action", () => {
    showNotificationToast(baseNotification);

    expect(toastSuccessMock).toHaveBeenCalledWith("Notification delivered", {
      action: {
        label: "View details",
        onClick: expect.any(Function),
      },
      description: "3 sent",
      id: "campaign-completed-campaign-1",
    });
    expect(toastInfoMock).not.toHaveBeenCalled();
  });

  test("shows a warning campaign completion toast when delivery had exceptions", () => {
    showNotificationToast({
      ...baseNotification,
      body: "1 sent · 2 failed",
      title: "Delivered with exceptions",
    });

    expect(toastWarningMock).toHaveBeenCalledWith("Delivered with exceptions", {
      action: {
        label: "View details",
        onClick: expect.any(Function),
      },
      description: "1 sent · 2 failed",
      id: "campaign-completed-campaign-1",
    });
  });

  test("keeps generic info toast behavior for other notification types", () => {
    showNotificationToast({
      ...baseNotification,
      contextResourceId: null,
      title: "Export ready",
      type: "export_ready",
    });

    expect(toastInfoMock).toHaveBeenCalledWith("Export ready", {
      action: {
        label: "View",
        onClick: expect.any(Function),
      },
      description: "3 sent",
      id: "notification-1",
    });
  });
});
