import { ClientConfiguration as cwConfig, PutMetricDataInput } from "aws-sdk/clients/cloudwatch";
import { ClientConfiguration as logConfig, FilterLogEventsRequest } from "aws-sdk/clients/cloudwatchlogs";
import { CloudWatch, CloudWatchLogs } from "aws-sdk";
import { DateTime } from "luxon";
import { cwLogger } from "./handler";
// @ts-ignore
// tslint:disable-next-line:no-var-requires
const AWSXRay = require("aws-xray-sdk");

export class CW {
    private readonly cwConfig: cwConfig;
    private readonly logConfig: logConfig;
    private readonly branch: string = process.env.BRANCH!.toLocaleLowerCase() || "local";
    private readonly now: DateTime = DateTime.utc();

    public constructor(cwConf?: cwConfig, logConf?: logConfig) {
        this.cwConfig = cwConf || { region: process.env.AWS_REGION || "eu-west-1" };
        this.logConfig = logConf || { region: process.env.AWS_REGION || "eu-west-1" };
    }

    /**
     * Get count of log events returned by filterLogEvents
     * @param {FilterLogEventsRequest} req The request to be counted.
     */
    private async getLogEventsCount(req: FilterLogEventsRequest): Promise<[string, number]> {
        cwLogger.info(`Retrieving count of events for ${req.logGroupName} with the filter: ${req.filterPattern}`);
        const client: CloudWatchLogs = AWSXRay.captureAWSClient(new CloudWatchLogs(this.logConfig));
        const eventCount: number[] = [];
        let events = await client.filterLogEvents(req).promise();
        eventCount.push(events.events!.length);
        while (events.nextToken) {
            req.nextToken = events.nextToken;
            events = await client.filterLogEvents(req).promise();
            eventCount.push(events.events!.length);
        }
        return [req.logGroupName, eventCount.reduce((total, num) => total + num, 0)];
    }

    /**
     * Get total timeouts today
     * @returns {Array<[string,number]>} An array of tuples containing the name of the lambda and the number of timeouts today.
     */
    public async getTimeouts(): Promise<Array<[string, number]>> {
        const groups: string[] = [
            `/aws/lambda/activities-${this.branch}`,
            `/aws/lambda/atf-report-gen-${this.branch}`,
            `/aws/lambda/atf-report-gen-init-${this.branch}`,
            `/aws/lambda/auth-${this.branch}`,
            `/aws/lambda/cert-gen-${this.branch}`,
            `/aws/lambda/cert-gen-init-${this.branch}`,
            `/aws/lambda/cert-gov-notify-${this.branch}`,
            `/aws/lambda/defects-${this.branch}`,
            `/aws/lambda/dlq-handler-${this.branch}`,
            `/aws/lambda/doc-gen-${this.branch}`,
            `/aws/lambda/logs-${this.branch}`,
            `/aws/lambda/metrics-collector-${this.branch}`,
            `/aws/lambda/preparers-${this.branch}`,
            `/aws/lambda/retro-gen-${this.branch}`,
            `/aws/lambda/retro-gen-init-${this.branch}`,
            `/aws/lambda/technical-records-${this.branch}`,
            `/aws/lambda/test-number-${this.branch}`,
            `/aws/lambda/test-results-${this.branch}`,
            `/aws/lambda/test-stations-${this.branch}`,
            `/aws/lambda/test-types-${this.branch}`
        ];
        const dayMillis: number = this.now.startOf("day").toMillis();
        return await Promise.all(groups.map(async (logGroup) => {
            const filterReq: FilterLogEventsRequest = {
                logGroupName: logGroup,
                startTime: dayMillis,
                filterPattern: "Task timed out"
            };
            return this.getLogEventsCount(filterReq);
        }));
    }

    /**
     * Pushes the metrics to CloudWatch.
     * @public
     * @async
     * @param visitsToday Number of visits since 00:00 UTC today.
     * @param oldVisits Number of visits since now UTC - 10 hours.
     * @returns {string} Combination of visit metrics for response.
     */
    public async sendMetrics(visitsToday: number, oldVisits: number): Promise<string> {
        const client: CloudWatch = AWSXRay.captureAWSClient(new CloudWatch(this.cwConfig));
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
                }
            ]
        };
        const timeouts: Array<[string, number]> = await this.getTimeouts();
        const promises: Array<Promise<object>> = [];
        timeouts.map((timeout) => {
            params.MetricData.push({
                MetricName: "Timeouts",
                Dimensions: [
                    {
                        Name: "Environment",
                        Value: this.branch
                    },
                    {
                        Name: "Service",
                        Value: timeout[0]
                    }
                ],
                Timestamp: timestamp,
                Value: timeout[1],
                Unit: "Count"
            });
            if (params.MetricData.length === 20) {
                promises.push(client.putMetricData(params).promise());
                params.MetricData = [];
            }
        });
        promises.push(client.putMetricData(params).promise());
        await Promise.all(promises);
        const resp: string = `visits: ${visitsToday}, oldVisits: ${oldVisits}, timeouts: ${JSON.stringify(timeouts)}`;
        cwLogger.info(resp);
        return resp;
    }
}

