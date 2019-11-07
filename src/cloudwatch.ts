import { ClientConfiguration as cwConfig, PutMetricDataInput } from "aws-sdk/clients/cloudwatch";
import { CloudWatch } from "aws-sdk";
import { DateTime } from "luxon";
import { cwLogger } from "./handler";
import { CloudWatchLogsLogEvent } from "aws-lambda";
// @ts-ignore
// tslint:disable-next-line:no-var-requires
const AWSXRay = require("aws-xray-sdk");

export class CW {
    private readonly config: cwConfig;
    private readonly branch: string = (process.env.BRANCH || "local").toLocaleLowerCase();
    private readonly now: DateTime = DateTime.utc();

    public constructor(cwConf?: cwConfig) {
        this.config = cwConf || { region: process.env.AWS_REGION || "eu-west-1", retryDelayOptions: { base: 500 } };
    }

    /**
     * Pushes the visit metrics to CloudWatch.
     * @public
     * @async
     * @param visitsToday Number of visits since 00:00 UTC today.
     * @param oldVisits Number of visits since now UTC-10 hours.
     * @param openVisits Amount of open visits right now.
     * @returns {string} Combination of visit metrics for response.
     */
    public async sendVisits(visitsToday: number, oldVisits: number, openVisits: number): Promise<string> {
        const client: CloudWatch = AWSXRay.captureAWSClient(new CloudWatch(this.config));
        const timestamp: Date = this.now.toJSDate();
        const params: PutMetricDataInput = {
            Namespace: "CVS",
            MetricData: [
                {
                    MetricName: "VisitsToday",
                    Dimensions: [
                        {
                            Name: "Environment",
                            Value: this.branch
                        }
                    ],
                    Timestamp: timestamp,
                    Value: visitsToday,
                    Unit: "Count"
                },
                {
                    MetricName: "OldVisits",
                    Dimensions: [
                        {
                            Name: "Environment",
                            Value: this.branch
                        }
                    ],
                    Timestamp: timestamp,
                    Value: oldVisits,
                    Unit: "Count"
                },
                {
                    MetricName: "OpenVisits",
                    Dimensions: [
                        {
                            Name: "Environment",
                            Value: this.branch
                        }
                    ],
                    Timestamp: timestamp,
                    Value: openVisits,
                    Unit: "Count"
                }
            ]
        };
        await client.putMetricData(params).promise();
        const resp: string = `visits: ${visitsToday}, oldVisits: ${oldVisits}, openVisits: ${openVisits}`;
        cwLogger.info(resp);
        return resp;
    }

    /**
     * Pushes Timeout metrics to CloudWatch
     * @param {string} logGroup
     * @param {CloudWatchLogsLogEvent[]} logEvents
     * @returns {string} Total timeout count for the service
     */
    public async sendTimeouts(logGroup: string, logEvents: CloudWatchLogsLogEvent[]): Promise<string> {
        const client: CloudWatch = AWSXRay.captureAWSClient(new CloudWatch(this.config));
        const timestamp: Date = this.now.toJSDate();
        let timeoutCount: number = 0;
        for (const logEvent of logEvents) {
            if (/.*Task timed out.*/.test(logEvent.message)) {
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
                            Value: this.branch
                        },
                        {
                            Name: "Service",
                            Value: logGroup
                        }
                    ],
                    Timestamp: timestamp,
                    Value: timeoutCount,
                    Unit: "Count"
                }
            ]
        };
        await client.putMetricData(params).promise();
        const resp: string = `${logGroup}: ${timeoutCount}`;
        cwLogger.info(resp);
        return resp;
    }
}

