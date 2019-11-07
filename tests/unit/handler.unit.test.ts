import { handler } from "../../src/handler";
import mockContext = require("aws-lambda-mock-context");
import sinon = require("sinon");
import { CloudWatchLogsDecodedData } from "aws-lambda";
import { gzip } from "node-gzip";
import { Dynamo } from "../../src/dynamodb";
import { CW } from "../../src/cloudwatch";


const sandbox = sinon.createSandbox();
const event: CloudWatchLogsDecodedData = {
    messageType: "DATA_MESSAGE",
    owner: "123456789123",
    logGroup: "testLogGroup",
    logStream: "testLogStream",
    subscriptionFilters: ["testFilter"],
    logEvents: [
        { id: "eventId1", timestamp: 1440442987000, message: "[ERROR] First test message" },
        { id: "eventId2", timestamp: 1440442987001, message: "[ERROR] Second test message" }
    ]
};

async function encodeEvent(ev: CloudWatchLogsDecodedData) {
    return (await gzip(JSON.stringify(ev))).toString("base64");
}

describe("The lambda handler", () => {
    const ctx = mockContext();
    describe("with a valid event", () => {
        afterEach(() => sandbox.restore());
        it("should handle the incoming event", async () => {
            const getVisitsStub = sandbox.stub(Dynamo.prototype, "getVisits").resolves(0);
            const getOldVisitsStub = sandbox.stub(Dynamo.prototype, "getOldVisits").resolves(0);
            const sendVisitsStub = sandbox.stub(CW.prototype, "sendVisits").resolves("visits: 0, oldVisits: 0");
            const sendTimeoutsStub = sandbox.stub(CW.prototype, "sendTimeouts").resolves("testLogGroup: 0");
            await handler({ awslogs: { data: await encodeEvent(event) } }, ctx, () => {
                return;
            });
            sandbox.assert.notCalled(getVisitsStub);
            sandbox.assert.notCalled(getOldVisitsStub);
            sandbox.assert.notCalled(sendVisitsStub);
            sandbox.assert.calledWith(sendTimeoutsStub, event.logGroup, event.logEvents);
        });
    });
    describe("when it is handling the activities logs", () => {
        afterEach(() => sandbox.restore());
        const act: CloudWatchLogsDecodedData = { ...event };
        act.logGroup = "/aws/lambda/activities-develop";
        it("should retrieve the visit stats", async () => {
            const getVisitsStub = sandbox.stub(Dynamo.prototype, "getVisits").resolves(0);
            const getOldVisitsStub = sandbox.stub(Dynamo.prototype, "getOldVisits").resolves(0);
            const sendVisitsStub = sandbox.stub(CW.prototype, "sendVisits").resolves("visits: 0, oldVisits: 0");
            const sendTimeoutsStub = sandbox.stub(CW.prototype, "sendTimeouts").resolves("/aws/lambda/activities-develop: 0");
            await handler({ awslogs: { data: await encodeEvent(act) } }, ctx, () => {
                return;
            });
            sandbox.assert.called(getVisitsStub);
            sandbox.assert.called(getOldVisitsStub);
            sandbox.assert.called(sendVisitsStub);
            sandbox.assert.calledWith(sendTimeoutsStub, act.logGroup, act.logEvents);
        });
    });
});

