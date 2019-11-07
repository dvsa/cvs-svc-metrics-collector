import sinon = require("sinon");
import * as AWSMock from "aws-sdk-mock";
import AWS = require("aws-sdk");
import { CW } from "../../src/cloudwatch";

const sandbox = sinon.createSandbox();
describe("The CloudWatch class", () => {
    let cw: CW;
    beforeEach(() => {
        cw = new CW();
    });
    afterEach(() => sandbox.restore());

    it("should send visit metrics", async () => {
        const visitsToday = 42;
        const oldVisits = 0;
        const openVisits = 5;
        const pSpy = sinon.fake.resolves({});
        AWSMock.setSDKInstance(AWS);
        AWSMock.mock("CloudWatch", "putMetricData", pSpy);
        const res = await cw.sendVisits(visitsToday, oldVisits, openVisits);
        expect(res).toBe(`visits: ${visitsToday}, oldVisits: ${oldVisits}, openVisits: ${openVisits}`);
        expect(pSpy.calledOnce).toBeTruthy();
        AWSMock.restore("CloudWatch");
    });

    it("should send timeout metrics", async () => {
        const pSpy = sinon.fake.resolves({});
        AWSMock.setSDKInstance(AWS);
        AWSMock.mock("CloudWatch", "putMetricData", pSpy);
        const res = await cw.sendTimeouts("testGroup", [{ id: "asdf", timestamp: 0, message: "[ERROR] Task timed out" }]);
        expect(res).toBe("testGroup: 1");
        expect(pSpy.calledOnce).toBeTruthy();
        AWSMock.restore("CloudWatch");
    });

    it("should send timeout metrics even when none returned", async () => {
        const pSpy = sinon.fake.resolves({});
        AWSMock.setSDKInstance(AWS);
        AWSMock.mock("CloudWatch", "putMetricData", pSpy);
        const res = await cw.sendTimeouts("testGroup", [{ id: "asdf", timestamp: 0, message: "[ERROR] Fatal error" }]);
        expect(res).toBe("testGroup: 0");
        expect(pSpy.calledOnce).toBeTruthy();
        AWSMock.restore("CloudWatch");
    });
});
