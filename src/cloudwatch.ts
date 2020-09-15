import CloudWatch, { ClientConfiguration as cwConfig, PutMetricDataInput } from "aws-sdk/clients/cloudwatch";
import { DateTime } from "luxon";
import { cwLogger } from "./handler";
import { CloudWatchLogsLogEvent } from "aws-lambda";
import AWSXRay from "aws-xray-sdk";
import RE2 = require("re2");

export class CW {
  private readonly config: cwConfig = { region: "eu-west-1", retryDelayOptions: { base: 500 } };
  private readonly branch: string = (process.env.BRANCH ?? "local").toLocaleLowerCase();
  private readonly now: DateTime = DateTime.utc();

  /**
   * Pushes the visit metrics to CloudWatch.
   *
   * @public
   * @async
   * @param {number} visitsToday Number of visits since 00:00 UTC today.
   * @param {number} oldVisits Number of visits since now UTC-10 hours.
   * @param {number} openVisits Amount of open visits right now.
   */
  public async sendVisits(visitsToday: number, oldVisits: number, openVisits: number): Promise<void> {
    const client = AWSXRay.captureAWSClient(new CloudWatch(this.config));
    const timestamp: Date = this.now.toJSDate();
    const params: PutMetricDataInput = {
      Namespace: "CVS",
      MetricData: [
        {
          MetricName: "VisitsToday",
          Dimensions: [
            {
              Name: "Environment",
              Value: this.branch,
            },
          ],
          Timestamp: timestamp,
          Value: visitsToday,
          Unit: "Count",
        },
        {
          MetricName: "OldVisits",
          Dimensions: [
            {
              Name: "Environment",
              Value: this.branch,
            },
          ],
          Timestamp: timestamp,
          Value: oldVisits,
          Unit: "Count",
        },
        {
          MetricName: "OpenVisits",
          Dimensions: [
            {
              Name: "Environment",
              Value: this.branch,
            },
          ],
          Timestamp: timestamp,
          Value: openVisits,
          Unit: "Count",
        },
      ],
    };
    await client.putMetricData(params).promise();
    cwLogger.info(`visits: ${visitsToday}, oldVisits: ${oldVisits}, openVisits: ${openVisits}`);
  }

  /**
   * Pushes Timeout metrics to CloudWatch
   *
   * @param {string} logGroup The service to be measured
   * @param {CloudWatchLogsLogEvent[]} logEvents An array of logs to check
   */
  public async sendTimeouts(logGroup: string, logEvents: CloudWatchLogsLogEvent[]): Promise<void> {
    const client = AWSXRay.captureAWSClient(new CloudWatch(this.config));
    const timestamp: Date = this.now.toJSDate();
    let timeoutCount = 0;
    for (const logEvent of logEvents) {
      if (new RE2(".*Task timed out.*").test(logEvent.message)) {
        timeoutCount += 1;
      }
    }
    const params: PutMetricDataInput = {
      Namespace: "CVS",
      MetricData: [
        {
          MetricName: "Timeouts",
          Dimensions: [
            {
              Name: "Environment",
              Value: this.branch,
            },
            {
              Name: "Service",
              Value: logGroup,
            },
          ],
          Timestamp: timestamp,
          Value: timeoutCount,
          Unit: "Count",
        },
      ],
    };
    await client.putMetricData(params).promise();
    cwLogger.info(`${logGroup}: ${timeoutCount}`);
  }
}
