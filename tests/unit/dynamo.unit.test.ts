import { Dynamo } from "../../src/dynamodb";
import { ScanInput } from "aws-sdk/clients/dynamodb";
import { DynamoDB } from "aws-sdk";
import * as os from "os";

describe("The dynamodb class", () => {
  const ddb = new Dynamo();
  jest.mock("aws-sdk/clients/dynamodb");
  let mockFn = jest.fn().mockImplementation(() => ({ promise: () => Promise.resolve({ Count: 1 }) }));
  DynamoDB.prototype.scan = mockFn;
  process.env.BRANCH = "local";
  it("should scan a dynamodb table", async () => {
    const input: ScanInput = { TableName: "testTable" };
    expect.assertions(2);
    await expect(ddb.scanCount(input)).resolves.toBe(os.cpus().length);
    expect(mockFn.mock.calls.length).toBe(os.cpus().length);
  });
  it("should return with 0, if ScanOutput.Count is undefined", async () => {
    mockFn = jest.fn().mockImplementation(() => ({ promise: () => Promise.resolve({ Count: undefined }) }));
    DynamoDB.prototype.scan = mockFn;
    const input: ScanInput = { TableName: "testTable" };
    expect.assertions(2);
    await expect(ddb.scanCount(input)).resolves.toBe(0);
    expect(mockFn.mock.calls.length).toBe(os.cpus().length);
  });
  it("should return a count of the total visits for the day", async () => {
    mockFn = jest.fn().mockImplementation(() => 1);
    Dynamo.prototype.scanCount = mockFn;
    expect.assertions(2);
    await expect(ddb.getVisits()).resolves.toBe(1);
    expect(mockFn.mock.calls.length).toBe(1);
  });
  it("should return a count of old visits for the day", async () => {
    mockFn = jest.fn().mockImplementation(() => 1);
    Dynamo.prototype.scanCount = mockFn;
    expect.assertions(2);
    await expect(ddb.getOldVisits()).resolves.toBe(1);
    expect(mockFn.mock.calls.length).toBe(1);
  });
  it("should return a count of open visits", async () => {
    mockFn = jest.fn().mockImplementation(() => 1);
    Dynamo.prototype.scanCount = mockFn;
    expect.assertions(2);
    await expect(ddb.getOpenVisits()).resolves.toBe(1);
    expect(mockFn.mock.calls.length).toBe(1);
  });
});
