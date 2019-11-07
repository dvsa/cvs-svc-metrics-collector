import sinon = require("sinon");
import * as AWSMock from "aws-sdk-mock";
import AWS = require("aws-sdk");
import { Dynamo } from "../../src/dynamodb";
import { ScanInput, ScanOutput } from "aws-sdk/clients/dynamodb";


const sandbox = sinon.createSandbox();

describe("The dynamodb class", () => {
    let ddb: Dynamo;
    beforeEach(() => {
        ddb = new Dynamo();
    });
    afterEach(() => sandbox.restore());
    it("should scan a dynamodb table", async () => {
        const input: ScanInput = { TableName: "testTable" };
        const output: ScanOutput = { Count: 1 };
        const dSpy = sinon.fake.resolves(output);
        AWSMock.setSDKInstance(AWS);
        AWSMock.mock("DynamoDB", "scan", dSpy);
        const res = await ddb.scanCount(input);
        expect(res).toBe(4);
        expect(dSpy.callCount === 4 && dSpy.calledWith(input)).toBeTruthy();
        AWSMock.restore("DynamoDB");
    });
    it("should return a count of the total visits for the day", async () => {
       const scan = sandbox.stub(Dynamo.prototype, "scanCount").resolves(1);
       const res = await ddb.getVisits();
       expect(res).toBe(1);
       expect(scan.calledOnce).toBeTruthy();
    });
    it("should return a count of old visits for the day", async () => {
       const scan = sandbox.stub(Dynamo.prototype, "scanCount").resolves(1);
       const res = await ddb.getOldVisits();
       expect(res).toBe(1);
       expect(scan.calledOnce).toBeTruthy();
    });
});
