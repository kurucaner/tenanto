import { describe, expect, test } from "bun:test";

import { parseSmsInboundWebhookBody } from "./sms-inbound-utils";

describe("parseSmsInboundWebhookBody", () => {
  test("parses direct curl test payload", () => {
    expect(
      parseSmsInboundWebhookBody({
        message: "STOP",
        phoneNumber: "+13055550100",
      })
    ).toEqual({
      messageBody: "STOP",
      messageKeyword: null,
      originationNumber: "+13055550100",
    });
  });

  test("parses AWS inbound payload", () => {
    expect(
      parseSmsInboundWebhookBody({
        messageBody: "HELP",
        messageKeyword: "HELP",
        originationNumber: "+13055550100",
      })
    ).toEqual({
      messageBody: "HELP",
      messageKeyword: "HELP",
      originationNumber: "+13055550100",
    });
  });

  test("parses SNS Notification wrapper", () => {
    expect(
      parseSmsInboundWebhookBody({
        Message: JSON.stringify({
          messageBody: "STOP",
          messageKeyword: "STOP",
          originationNumber: "+13055550100",
        }),
        Type: "Notification",
      })
    ).toEqual({
      messageBody: "STOP",
      messageKeyword: "STOP",
      originationNumber: "+13055550100",
    });
  });

  test("returns null for invalid payload", () => {
    expect(parseSmsInboundWebhookBody(null)).toBeNull();
    expect(parseSmsInboundWebhookBody({ message: "STOP" })).toBeNull();
  });
});
