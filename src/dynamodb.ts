import { DynamoDB } from "aws-sdk";
import { ClientConfiguration, ScanInput } from "aws-sdk/clients/dynamodb";
import { DateTime } from "luxon";
import { dynamoLogger } from "./handler";
// @ts-ignore
// tslint:disable-next-line:no-var-requires
const AWSXRay = require("aws-xray-sdk");

export class Dynamo {
    private readonly config: ClientConfiguration;
    private readonly tableName: string;
    private readonly branch: string;
    private readonly now: DateTime = DateTime.utc();
    private readonly numOfScanners: number;

    public constructor(config?: ClientConfiguration, branch?: string, numOfScanners: number = 4) {
        this.config = config || { region: process.env.AWS_REGION || "eu-west-1" };
        this.branch = branch || process.env.BRANCH || "local";
        this.tableName = `cvs-${this.branch.toLowerCase()}-activities`;
        this.numOfScanners = numOfScanners;
    }

    /**
     * Returns the date formatted to CVS project standard.
     * @param {DateTime} date A Luxon Datetime.
     * @returns {string}
     */
    public static async toCVSDate(date: DateTime): Promise<string> {
        return await date.toISO({ includeOffset: false }) + "Z";
    }

    /**********************************************************
     * Runs a scan against a DynamoDB table specified in {@link ScanInput}.
     * @private
     * @see getVisits()
     * @see getOldVisits()
     * @param {ScanInput} query The scan input for the request.
     * @returns {Promise<number>} Count of records from the scan.
     */
    private async scan(query: ScanInput): Promise<number> {
        const client: DynamoDB = AWSXRay.captureAWSClient(new DynamoDB(this.config));
        const scanners: Array<Promise<number>> = [];
        while (scanners.length < this.numOfScanners) {
            const scanInput = query;
            scanInput.Segment = scanners.length;
            scanInput.TotalSegments = this.numOfScanners;
            scanners.push(client.scan(scanInput).promise().then((r) => r.Count || 0));
        }
        const result = await Promise.all(scanners);
        return result.reduce((total, num) => total + num, 0);
    }

    /**
     * Retrieves the number of visits since 00:00 UTC today.
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
                ":today": { S: await Dynamo.toCVSDate(startOfDay) }
            }
        };
        const result = await this.scan(query);
        dynamoLogger.info(`Total visits for ${startOfDay}: ${result}`);
        return result;
    }

    /**
     * Retrieves the number of visits opened older than 10 hours.
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
                ":tenHours": { S: await Dynamo.toCVSDate(tenHoursAgo) },
                ":NULL": { NULL: true }
            }
        };
        const result = await this.scan(query);
        dynamoLogger.info(`Total old visits older than ${tenHoursAgo}: ${result}`);
        return result;
    }
}
