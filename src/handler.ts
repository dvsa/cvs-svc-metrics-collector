import { CloudWatchLogsDecodedData, Context, FirehoseTransformationEvent, FirehoseTransformationResult } from "aws-lambda";
import { CW } from "./cloudwatch";
import { Dynamo } from "./dynamodb";
import { Category, CategoryConfiguration, CategoryServiceFactory, LogLevel } from "typescript-logging";
import { ungzip } from "node-gzip";
import AWSXRay from "aws-xray-sdk";
import RE2 from "re2";

CategoryServiceFactory.setDefaultConfiguration(new CategoryConfiguration(LogLevel.Info));
export const handlerLogger = new Category("Handler");
export const dynamoLogger = new Category("DynamoDB", handlerLogger);
export const cwLogger = new Category("CloudWatch", handlerLogger);

/**
 * Decodes the base64 event data and decompresses it.
 *
 * @param {string} data Base64 encoded data from firehose
 * @returns {CloudWatchLogsDecodedData} The decoded data
 */
async function decodeEventData(data: string): Promise<CloudWatchLogsDecodedData> {
  const unzipped = (await ungzip(Buffer.from(data, "base64"))).toString();
  handlerLogger.info(unzipped);
  return JSON.parse(unzipped);
}

/**
 * The lambda handler for metrics collector, no transformation of the data happens as this only generates metrics.
 *
 * @param {FirehoseTransformationEvent} event The expected event from Firehose
 * @param {Context | undefined} context The context of the running lambda
 * @returns {FirehoseTransformationResult} The result to return to Firehose after processing.
 */
export const handler = async (event: FirehoseTransformationEvent, context?: Context | undefined): Promise<FirehoseTransformationResult> => {
  try {
    const decodeSS = AWSXRay.getSegment()?.addNewSubsegment("decodeEvent");
    handlerLogger.info(`context: ${JSON.stringify(context)}`);
    const logs: CloudWatchLogsDecodedData[] = await Promise.all(
      event.records.map((record) => {
        return decodeEventData(record.data);
      })
    );
    decodeSS?.addMetadata("decodedEvent", logs);
    decodeSS?.close();
    const cw = new CW();
    const promises: Promise<void>[] = [];
    const activityPattern = new RE2(/\/aws\/lambda\/activities-[\w-]+/);
    const sendMetricsSS = AWSXRay.getSegment()?.addNewSubsegment("sendMetrics");
    // Prevent activities metrics being sent more than once.
    let activitiesSent = false;
    for (const log of logs) {
      if (!activitiesSent && activityPattern.test(log.logGroup)) {
        const visitsSS = AWSXRay.getSegment()?.addNewSubsegment("getVisits");
        const dynamo = new Dynamo();
        const [visits, oldVisits, openVisits] = await Promise.all([dynamo.getVisits(visitsSS), dynamo.getOldVisits(visitsSS), dynamo.getOpenVisits(visitsSS)]);
        promises.push(cw.sendVisits(visits, oldVisits, openVisits, sendMetricsSS));
        activitiesSent = true;
        visitsSS?.close();
      }
      promises.push(cw.sendTimeouts(log.logGroup, log.logEvents, sendMetricsSS));
    }
    await Promise.all(promises);
    sendMetricsSS?.close();
    return {
      records: event.records.map((record) => ({
        recordId: record.recordId,
        result: "Ok",
        data: record.data,
      })),
    } as FirehoseTransformationResult;
  } catch (e) {
    handlerLogger.error("Handler error:", e);
    handlerLogger.info(JSON.stringify(event));
    AWSXRay.getSegment()?.addError(e);
    return {
      records: event.records.map((record) => ({
        recordId: record.recordId,
        result: "ProcessingFailed",
        data: record.data,
      })),
    } as FirehoseTransformationResult;
  }
};
