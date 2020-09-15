import { handler } from "../../src/handler";
import { CloudWatchLogsDecodedData, FirehoseTransformationEvent } from "aws-lambda";
import { Dynamo } from "../../src/dynamodb";
import { CW } from "../../src/cloudwatch";
import { gzip } from "node-gzip";

const FHEvent: FirehoseTransformationEvent = {
  deliveryStreamArn: "",
  invocationId: "",
  region: "",
  records: [
    {
      recordId: "",
      approximateArrivalTimestamp: 0,
      data: "",
    },
  ],
};

const logs: CloudWatchLogsDecodedData = {
  messageType: "DATA_MESSAGE",
  owner: "123456789123",
  logGroup: "testLogGroup",
  logStream: "testLogStream",
  subscriptionFilters: ["testFilter"],
  logEvents: [
    { id: "eventId1", timestamp: 1440442987000, message: "[ERROR] First test message" },
    { id: "eventId2", timestamp: 1440442987001, message: "[ERROR] Second test message" },
  ],
};

async function encodeEvent(ev: CloudWatchLogsDecodedData) {
  return (await gzip(JSON.stringify(ev))).toString("base64");
}

const getVisitsMock = jest.fn().mockImplementation(() => 0);
const getOldVisitsMock = jest.fn().mockImplementation(() => 0);
const getOpenVisitsMock = jest.fn().mockImplementation(() => 0);
const sendVisitsMock = jest.fn().mockImplementation(() => "visits: 0, oldVisits: 0");
let sendTimeoutsMock = jest.fn().mockImplementation(() => "testLogGroup: 0");
const failTimeoutsMock = jest.fn().mockImplementation(() => {
  throw new Error("This is a fake error");
});

describe("The lambda handler", () => {
  process.env.BRANCH = "local";
  Dynamo.prototype.getVisits = getVisitsMock;
  Dynamo.prototype.getOldVisits = getOldVisitsMock;
  Dynamo.prototype.getOpenVisits = getOpenVisitsMock;
  CW.prototype.sendVisits = sendVisitsMock;
  CW.prototype.sendTimeouts = sendTimeoutsMock;

  describe("with a valid event", () => {
    it("should handle the incoming event", async () => {
      const ev = { ...FHEvent };
      ev.records[0].data = await encodeEvent(logs);
      await handler(ev);
      expect(getVisitsMock).not.toHaveBeenCalled();
      expect(getOldVisitsMock).not.toHaveBeenCalled();
      expect(getOpenVisitsMock).not.toHaveBeenCalled();
      expect(sendTimeoutsMock).toHaveBeenCalledWith(logs.logGroup, logs.logEvents);
    });
  });
  describe("when a function fails", () => {
    beforeEach(() => {
      CW.prototype.sendTimeouts = failTimeoutsMock;
    });
    it("should return the data with ProcessingFailed", async () => {
      expect.assertions(1);
      const ev = { ...FHEvent };
      ev.records[0].data = await encodeEvent(logs);
      const resp = await handler(ev);
      expect(resp.records[0].result).toEqual("ProcessingFailed");
    });
    afterEach(() => {
      CW.prototype.sendTimeouts = sendTimeoutsMock;
    });
  });
  describe("when it is handling the activities logs", () => {
    sendTimeoutsMock = jest.fn().mockImplementation(() => "/aws/lambda/activities-develop: 0");
    CW.prototype.sendTimeouts = sendTimeoutsMock;
    it("should retrieve the visit stats", async () => {
      const ev = { ...FHEvent };
      const actLogs = { ...logs };
      actLogs.logGroup = "/aws/lambda/activities-develop";
      ev.records[0].data = await encodeEvent(actLogs);
      await handler(ev);
      expect(getVisitsMock).toHaveBeenCalled();
      expect(getOldVisitsMock).toHaveBeenCalled();
      expect(getOpenVisitsMock).toHaveBeenCalled();
      expect(sendTimeoutsMock).toHaveBeenCalledWith(actLogs.logGroup, actLogs.logEvents);
    });
  });
});
