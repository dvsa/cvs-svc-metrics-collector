import { DynamoDB } from "aws-sdk";
import { ClientConfiguration, ScanInput } from "aws-sdk/clients/dynamodb";
import { DateTime } from "luxon";
import { dynamoLogger } from "./handler";
import AWSXRay from "aws-xray-sdk";
import * as os from "os";

export class Dynamo {
  private readonly config: ClientConfiguration;
  private readonly tableName: string;
  private readonly branch: string = (process.env.BRANCH ?? "local").toLocaleLowerCase();
  private readonly now: DateTime = DateTime.utc();
  private readonly numOfScanners: number;

  public constructor(config?: ClientConfiguration, numOfScanners: number = os.cpus().length) {
    this.config = config ?? { region: process.env.AWS_REGION ?? "eu-west-1" };
    this.tableName = `cvs-${this.branch.toLowerCase()}-activities`;
    this.numOfScanners = numOfScanners;
  }

  /**
   * Returns the date formatted to CVS project standard.
   * @param {DateTime} date A Luxon Datetime.
   * @returns {string}
   */
  public static toCVSDate(date: DateTime): string {
    return date.toISO({ includeOffset: false }) + "Z";
  }

  /**
   * Returns the count of records as per the input
   * @param {ScanInput} scanInput The input for the scan
   */
  private async scanDB(scanInput: ScanInput): Promise<number> {
    const client = AWSXRay.captureAWSClient(new DynamoDB(this.config));
    let ExclusiveStartKey: DynamoDB.Key | undefined
    let count = 0
    do {
      if (ExclusiveStartKey) scanInput.ExclusiveStartKey = ExclusiveStartKey
      const res = await client.scan(scanInput).promise()
      ExclusiveStartKey = res.LastEvaluatedKey
      count += res.Count ?? 0
    } while (ExclusiveStartKey)
    return count
  }

  /**********************************************************
   * Runs a scan against a DynamoDB table specified in {@link ScanInput} and returns the count of records returned.
   * @public
   * @see getVisits()
   * @see getOldVisits()
   * @param {ScanInput} query The scan input for the request.
   * @returns {Promise<number>} Count of records from the scan.
   */
  public async scanCount(query: ScanInput): Promise<number> {
    const scanners: Promise<number>[] = [];
    while (scanners.length < this.numOfScanners) {
      const scanInput = query;
      scanInput.Segment = scanners.length;
      scanInput.TotalSegments = this.numOfScanners;
      scanners.push(this.scanDB(scanInput));
    }
    return (await Promise.all(scanners)).reduce((total, num) => total + num, 0);
  }

  /**
   * Retrieves the amount of visits since 00:00 UTC today.
   * @public
   * @returns {number} Number of visits.
   */
  public async getVisits(): Promise<number> {
    dynamoLogger.info("Retrieving total visits today");
    const startOfDay: DateTime = this.now.startOf("day");
    const query: ScanInput = {
      TableName: this.tableName,
      FilterExpression: "startTime >= :today",
      ExpressionAttributeValues: {
        ":today": { S: Dynamo.toCVSDate(startOfDay) }
      }
    };
    const result = await this.scanCount(query);
    dynamoLogger.info(`Total visits for ${startOfDay}: ${result}`);
    return result;
  }

  /**
   * Retrieves the amount of visits opened older than 10 hours.
   * @public
   * @returns {number} Number of visits.
   */
  public async getOldVisits(): Promise<number> {
    const tenHoursAgo: DateTime = this.now.minus({ hours: 10 });
    dynamoLogger.info(`Retrieving total open visits older than ${tenHoursAgo}`);
    const query: ScanInput = {
      TableName: this.tableName,
      FilterExpression: "startTime <= :tenHours and endTime = :NULL",
      ExpressionAttributeValues: {
        ":tenHours": { S: Dynamo.toCVSDate(tenHoursAgo) },
        ":NULL": { NULL: true }
      }
    };
    const result = await this.scanCount(query);
    dynamoLogger.info(`Total old visits older than ${tenHoursAgo}: ${result}`);
    return result;
  }

  /**
   * Retrieves the amount of open visits.
   * @public
   * @returns {number} Number of visits.
   */
  public async getOpenVisits(): Promise<number> {
    dynamoLogger.info(`Retrieving total open visits`);
    const query: ScanInput = {
      TableName: this.tableName,
      FilterExpression: "endTime = :NULL",
      ExpressionAttributeValues: {
        ":NULL": { NULL: true }
      }
    };
    const result = await this.scanCount(query);
    dynamoLogger.info(`Total open visits: ${result}`);
    return result;
  }
}
