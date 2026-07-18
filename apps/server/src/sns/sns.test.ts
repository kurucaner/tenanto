import { beforeEach, describe, expect, mock, test } from "bun:test";

import { mockAsyncFn } from "@/test-fixtures/mocks";

const mockSnsSend = mockAsyncFn((_cmd: { input: Record<string, unknown> }) =>
  Promise.resolve({ MessageId: "msg-123" })
);

mock.module("@aws-sdk/client-sns", () => ({
  PublishCommand: class PublishCommand {
    input: unknown;

    constructor(input: unknown) {
      this.input = input;
    }
  },
  SNSClient: class SNSClient {
    send = mockSnsSend;
  },
}));

const { resolveSmsPhoneNumber, sendSms } = await import("./sns");

describe("resolveSmsPhoneNumber", () => {
  test("accepts valid E.164 numbers", () => {
    expect(resolveSmsPhoneNumber("+14155552671")).toBe("+14155552671");
  });

  test("normalizes formatted numbers to E.164", () => {
    expect(resolveSmsPhoneNumber("(415) 555-2671")).toBe("+14155552671");
  });

  test("throws for invalid numbers", () => {
    expect(() => resolveSmsPhoneNumber("not-a-phone")).toThrow(
      "phoneNumber must be a valid E.164 phone number"
    );
  });

  test("uses a custom field name in validation errors", () => {
    expect(() => resolveSmsPhoneNumber("not-a-phone", "fromPhoneNumber")).toThrow(
      "fromPhoneNumber must be a valid E.164 phone number"
    );
  });
});

describe("sendSms", () => {
  beforeEach(() => {
    mockSnsSend.mockClear();
    delete process.env.SNS_SMS_ORIGINATION_NUMBER;
  });

  test("publishes a transactional SMS to a normalized phone number", async () => {
    await sendSms({
      message: "Rent payment received.",
      phoneNumber: "(415) 555-2671",
    });

    expect(mockSnsSend).toHaveBeenCalledTimes(1);
    const command = mockSnsSend.mock.calls[0]![0] as { input: Record<string, unknown> };
    expect(command.input.PhoneNumber).toBe("+14155552671");
    expect(command.input.Message).toBe("Rent payment received.");
    expect(command.input.MessageAttributes).toEqual({
      "AWS.SNS.SMS.SenderID": {
        DataType: "String",
        StringValue: "PropertyOS",
      },
      "AWS.SNS.SMS.SMSType": {
        DataType: "String",
        StringValue: "Transactional",
      },
    });
  });

  test("sets the origination number when fromPhoneNumber is provided", async () => {
    await sendSms({
      fromPhoneNumber: "+1 (800) 555-0100",
      message: "Rent payment received.",
      phoneNumber: "+14155552671",
    });

    const command = mockSnsSend.mock.calls[0]![0] as { input: Record<string, unknown> };
    expect(command.input.MessageAttributes).toMatchObject({
      "AWS.MM.SMS.OriginationNumber": {
        DataType: "String",
        StringValue: "+18005550100",
      },
    });
  });

  test("uses SNS_SMS_ORIGINATION_NUMBER when fromPhoneNumber is omitted", async () => {
    process.env.SNS_SMS_ORIGINATION_NUMBER = "+18005550199";

    await sendSms({
      message: "Rent payment received.",
      phoneNumber: "+14155552671",
    });

    const command = mockSnsSend.mock.calls[0]![0] as { input: Record<string, unknown> };
    expect(command.input.MessageAttributes).toMatchObject({
      "AWS.MM.SMS.OriginationNumber": {
        DataType: "String",
        StringValue: "+18005550199",
      },
    });
  });

  test("prefers fromPhoneNumber over SNS_SMS_ORIGINATION_NUMBER", async () => {
    process.env.SNS_SMS_ORIGINATION_NUMBER = "+18005550199";

    await sendSms({
      fromPhoneNumber: "+18005550100",
      message: "Rent payment received.",
      phoneNumber: "+14155552671",
    });

    const command = mockSnsSend.mock.calls[0]![0] as { input: Record<string, unknown> };
    expect(command.input.MessageAttributes).toMatchObject({
      "AWS.MM.SMS.OriginationNumber": {
        DataType: "String",
        StringValue: "+18005550100",
      },
    });
  });

  test("throws when message is blank", async () => {
    await expect(
      sendSms({
        message: "   ",
        phoneNumber: "+14155552671",
      })
    ).rejects.toThrow("message is required");

    expect(mockSnsSend).not.toHaveBeenCalled();
  });

  test("throws when phone number is invalid", async () => {
    await expect(
      sendSms({
        message: "Hello",
        phoneNumber: "not-a-phone",
      })
    ).rejects.toThrow("phoneNumber must be a valid E.164 phone number");

    expect(mockSnsSend).not.toHaveBeenCalled();
  });

  test("throws when fromPhoneNumber is invalid", async () => {
    await expect(
      sendSms({
        fromPhoneNumber: "not-a-phone",
        message: "Hello",
        phoneNumber: "+14155552671",
      })
    ).rejects.toThrow("fromPhoneNumber must be a valid E.164 phone number");

    expect(mockSnsSend).not.toHaveBeenCalled();
  });
});
